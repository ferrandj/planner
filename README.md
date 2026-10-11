# Planner

A self-hosted study / schedule planner: monthly calendar and list, assignments with per-subject
"handed in" toggles, exam dates, notes with attachments, printable A4 month sheets with stickers,
themes, and a French / English / Spanish interface.

It runs as a single small Docker container (Node.js, **no runtime dependencies**) and keeps **all** data
on the server, in one folder you mount from your NAS.

- Image: `ghcr.io/<owner>/planner` — a new GitHub Release and image is published automatically for every change on the default branch that passes all tests (see [Releases & CI](#releases--ci)).
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

## The schedule you start with

On the very first start (empty `/data`) the app creates its content in this order:

1. `<data folder>/seed.json`, if you put one there (your own schedule, see the format below);
2. otherwise the **default schedule bundled with the image**, kept in [`seed/default.json`](seed/default.json);
3. otherwise a small generic demo (only used when the image was built without a default, e.g. in development).

After that first start the data folder is the only source of truth: changing `seed/default.json` or `seed.json` later never
touches data that already exists. To start over with a different schedule, move the data folder away (or use *Import*).

Format of `seed.json` and `seed/default.json`:

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
- A `seed.json` placed next to the repository is git-ignored on purpose, so a private schedule can be tried without committing it.

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

[`.github/workflows/docker.yml`](.github/workflows/docker.yml) runs on every push and pull request. **A release is only
published when all of these pass**:

1. **Server tests** – storage guarantees (atomic writes, snapshots, corrupt-file recovery, never re-seeding) and the HTTP API.
2. **Web: types, unit and component tests, build** – TypeScript type-check, ~150 tests with a coverage gate on the logic
   (merge, sync, schedule rules, import), and the production build.
3. **End-to-end (real browser + real server)** – ticking and renaming survive a reload, two devices editing at once,
   offline edits, server restart, backups and restore, export/import, photo upload, printing, accessibility checks, phone layout.
4. **Container smoke test** – builds the image and checks that data survives a restart and a re-created container, that a
   corrupt state file is recovered from a backup, and that a permission problem is explained.
5. Then the multi-arch image is pushed to GHCR and a **GitHub Release** `vX.Y.Z` is created (default branch only), using the
   built-in `GITHUB_TOKEN` (no secrets to set up).

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

The server has no dependencies. The web app is React + TypeScript (Vite).

```sh
npm test                                   # server tests (Node only)
cd web && npm ci
npm run dev                                # http://localhost:5173 (needs the server below for /api)
npm run typecheck && npm test              # types + unit/component tests (add :coverage for the gate)
npm run build                              # production bundle in web/dist
DATA_DIR=./data PUBLIC_DIR=./web/dist node ../server/index.js   # http://localhost:8080
npx playwright install chromium && npm run e2e   # end-to-end tests (starts its own server on a temp folder)
```

Layout:

- `server/` – HTTP API and storage (`store.js` holds the safety guarantees).
- `web/src/lib/` – pure, unit-tested logic: `merge`, `sync` (browser safety copy, offline queue, conflict merge), `model`
  (schedule rules), `normalize` (defaults and import of older exports), `edits`, `i18n`.
- `web/src/components/` – screens. `web/src/state/app.tsx` – app state and theme.
- `web/e2e/` – Playwright tests. `scripts/container-smoke.sh` – container test used by CI.

The saved data format did not change when the interface was rebuilt, so existing data and `seed.json` files keep working.

## License

See [LICENSE](LICENSE).
