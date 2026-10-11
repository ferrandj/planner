# Planner

A self-hosted study / schedule planner: monthly calendar and list, assignments with per-subject
"handed in" toggles, exam dates, notes with attachments, printable A4 month sheets with stickers,
themes, and a French / English / Spanish interface.

It runs as a single small Docker container (Node.js, **no runtime dependencies**) and keeps **all** data
on the server, in one folder you mount from your NAS.

- Image: `ghcr.io/<owner>/planner` — a new GitHub Release and image is published automatically for every change on the default branch (see [Releases & CI](#releases--ci)).
- Architectures: `linux/amd64` and `linux/arm64`.

## Quick start (NAS / any Docker host)

1. Copy [`docker-compose.example.yml`](docker-compose.example.yml) to `docker-compose.yml`
   and replace `OWNER` with the GitHub account that owns this repository (lowercase).
2. `docker compose up -d`
3. Open `http://<nas-address>:8080`.

Your data lives in `./data` next to the compose file (mounted at `/data` in the container).
**Back that folder up** (Hyper Backup, rsync, …). Recreating or updating the container never touches it.

Update to the latest version:

```sh
docker compose pull && docker compose up -d
```

> **First pull from GHCR:** packages published by Actions start out private. Either make the package public once
> (GitHub → your profile → *Packages* → `planner` → *Package settings* → *Change visibility*), or
> `docker login ghcr.io` on the NAS with a personal access token that has `read:packages`.

If the container cannot write to `./data`, run it as the owner of that folder with `user: "UID:GID"`
(the container prints a clear message when `/data` is not writable).

## Your data is never reset or erased by accident

Every click, rename, checkbox, colour, sticker, note, attachment and import is saved. How that is guaranteed:

| Risk | Protection |
| --- | --- |
| Browser closed / crashed right after an edit | Each change is written synchronously to the browser's local storage **and** sent to the server (debounced 0.4 s, flushed when the tab is hidden or closed). |
| Server or Wi-Fi unreachable | The app keeps working; edits stay in the browser (status pill turns red) and are merged into the server state as soon as it is reachable again — even if the tab was closed in between. |
| Empty / fresh browser overwriting real data | The app never writes before it has loaded the server state. There is no code path that pushes defaults. |
| Two devices (phone + PC) editing at once | Optimistic revisions: a stale write is refused (HTTP 409) and the client does a **three-way merge** (different checkboxes, notes, stickers from both devices are all kept; delete-vs-edit keeps the edit). |
| Crash / power cut while writing | Atomic writes (temp file → `fsync` → rename). |
| Corrupt state file | The file is moved aside (never deleted) and the newest valid backup is loaded. If nothing valid can be recovered the server **refuses to start** rather than create an empty planner. |
| Accidental wipe / "reset" button | Automatic snapshots in `data/backups/` (at most every 15 s while editing, always before a big shrink or a restore). Retention: everything for 2 days, hourly for 2 weeks, daily for 6 months, monthly forever. Restore from the UI: *Édition → Sauvegardes et export*. |
| Attachments | Stored as immutable, content-addressed files in `data/files/`. The server never deletes them, not even when a note is removed. |
| Container updates | The image contains no user data. Initial content is only ever applied when `/data` is completely empty. |
| Cross-site requests | Writes need a custom header and a same-origin check; strict CSP; uploaded files are served as downloads (images excepted) with `nosniff`. |

Export (`Édition → Sauvegardes et export → Exporter`) downloads the full state as JSON; *Importer* merges such a file
(or a legacy export from the earlier single-file version) into the current data without deleting anything.

### What is in `/data`

```
data/
  state.json        current state (revisioned)
  backups/          automatic snapshots  state-<timestamp>-r<rev>[-tag].json
  files/            attachments (<sha256> + <sha256>.json metadata)
  seed.json         optional, only read on the very first start
```

## Loading your own schedule (privately)

The repository contains **no** personal or course data. On the very first start (empty `/data`) the app creates a small
generic demo schedule. To start with your own subjects, assignments, exams and sessions instead, put a `seed.json`
in the data folder **before the first start**:

```json
{
  "base": {
    "s": [ { "id": "math", "code": "MAT101", "name": "Mathematics", "short": "Mathematics", "ab": "Math", "c": 1 } ],
    "d": [ { "id": "d1", "ab": "D1", "title": "Assignment 1", "date": "2026-11-02", "avail": "2026-10-15" } ],
    "x": [ { "id": "ex1", "title": "Written exams", "date": "2027-04-29", "end": "2027-04-30" } ],
    "e": [ { "id": "math-live-2026-09-14", "subject": "math", "kind": "live", "date": "2026-09-14", "time": "18:30 – 21:30", "tag": "" } ]
  },
  "data": { "edits": { "app": { "title": "My planner", "eyebrow": "optional subtitle" } } }
}
```

- `s` subjects (`c` = colour slot 1–4), `d` assignments, `x` exams, `e` sessions (`kind`: `live` or `webconf`).
- `data` (optional) pre-fills saved settings such as the title.
- An invalid `seed.json` stops the server with an error instead of silently falling back to the demo.
- `seed.json` / `private/` / `data/` are in `.gitignore`. **Never commit them** — keep this repository free of personal data.

Everything in the schedule can then be renamed, re-dated or hidden from the **Édition** tab; those edits are saved as
changes on top of the seed and can be reverted individually.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port inside the container |
| `DATA_DIR` | `/data` | Where state, backups and files are stored |
| `AUTH_USER`, `AUTH_PASSWORD` | unset | Optional HTTP basic auth for the whole app (`/healthz` stays open) |
| `SNAPSHOT_INTERVAL_SEC` | `15` | Minimum time between automatic snapshots |

The app has no accounts. For access from outside your network put it behind your reverse proxy / VPN
(it works under a sub-path such as `https://host/planner/` because all URLs are relative).

## Releases & CI

[`.github/workflows/docker.yml`](.github/workflows/docker.yml) runs on every push and pull request:

1. `npm test` (merge logic, storage guarantees, HTTP API).
2. Builds the multi-arch image (always, so a broken Dockerfile is caught early).
3. **On every push to the default branch** (after the tests pass): picks the next version, pushes the image to GHCR,
   then creates a **GitHub Release** `vX.Y.Z` with generated notes. Uses the built-in `GITHUB_TOKEN`; no secrets to set up.

| Tag | Meaning |
| --- | --- |
| `1.4.2` | exact release (never changes) |
| `1.4` / `1` | newest patch / minor of that line |
| `latest` | newest release |
| `sha-<short>` | a specific commit |

Version bump is **patch** by default (`v1.0.0`, `v1.0.1`, …). For a bigger step put `[minor]` or `[major]` in the first line of
the commit (or PR squash) message, or run the workflow manually (*Actions → Run workflow*) and choose the bump.
Pull requests and other branches never publish anything.

### Connect the NAS to GitHub

Point your NAS at `ghcr.io/<owner>/planner` like any other registry image:

- `:latest` follows every new release; `:1` follows only non-breaking `1.x` releases; `:1.4.2` pins one release.
- To update automatically, run [Watchtower](https://containrrr.dev/watchtower/) (or your NAS's built-in "auto update" /
  "check for updates" option) and enable it for this container — the compose example has the label.
- Your data folder is never touched by an update.

## Development

```sh
npm test                          # unit + API tests, no dependencies to install
DATA_DIR=./data node server/index.js   # http://localhost:8080
```

Layout: `server/` (HTTP API + storage), `public/` (static front-end: `app.js`, `sync.js`, `merge.js`), `test/`.

## License

See [LICENSE](LICENSE).
