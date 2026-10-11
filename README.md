# Planner

A self-hosted study / schedule planner: monthly calendar and list, assignments with per-subject
"handed in" toggles, exam dates, notes with attachments, printable A4 month sheets with stickers,
themes, and a French / English / Spanish interface.

It runs as a single small Docker container (Node.js, **no runtime dependencies**) and keeps **all** data
on the server, in one folder you mount from your NAS.

- Image: `ghcr.io/ferrandj/planner` — a new GitHub Release and image is published automatically for every change on the default branch that passes all tests (see [Releases & CI](#releases--ci)).
- Architectures: `linux/amd64` and `linux/arm64`.

## Quick start (NAS / any Docker host)

1. Create the data folder, e.g. `/volume1/docker/planner/data`.
2. Use [`docker-compose.yml`](docker-compose.yml) from this repository (no secrets in it): on a Synology NAS that is
   *Container Manager → Project → Create* and paste it, or over SSH `docker compose up -d`.
   Adjust the host port (`10457`) and the data path if you like.
3. Open `http://<nas-address>:10457`.

The first start fills the planner with the default schedule bundled in the image; after that your data folder is the only
source of truth. **Back that folder up** (Hyper Backup, rsync, …). Recreating or updating the container never touches it.

Update to the latest version:

```sh
docker compose pull && docker compose up -d
```

> **First pull from GHCR:** packages published by Actions start out private. Either make the package public once
> (GitHub → your profile → *Packages* → `planner` → *Package settings* → *Change visibility*), or
> `docker login ghcr.io` on the NAS with a personal access token that has `read:packages`.

Permissions need no setup: the container runs as whoever owns the data folder, or hands a folder Docker created as root to an
unprivileged user (it drops root before it listens on the network). If you force a user with `user: "UID:GID"` in the compose
file, that user must be able to write to the folder; the container prints a clear message when it cannot.

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

## Editing, and the automatic catch-up

- **Edit mode** is the "✎ Édition" chip next to the language flags. In it you can add, rename, recolour and remove
  subjects, assignments, exams and sessions. Anything can also be edited where it is shown: the ✎ button on its tile,
  or a right-click on it (right-click also ticks a session). Nothing is ever really deleted: removed items sit in
  "Supprimés" and can be restored. Your own items are stored separately from the reference schedule, so a new
  reference schedule never touches them.
- **Today's agenda** sits under the late counter: what is planned today, in order, with what is under way and what is next.
- **Late classes counter**: under the next assignment, a coloured bar says how many live / web-conference classes are
  late (per subject), or congratulates you when you are up to date.
- **Automatic catch-up** (switch in that bar, off by default). Each day has two work periods: the morning and the
  afternoon/evening. A period that already holds anything (a class, live, web conference, a personal session, an exam)
  is never used. The other periods are filled, from now on, with the late classes: per subject from the first to the
  last, preferring the subject of the next class that is coming, and never more than N in a row for the same
  subject (N is the number next to the switch, 3 by default). The plan is recomputed on every change (a class you tick,
  a class you miss, a new session…) and is never stored: it only moves tiles around on screen, ticking a catch-up tile
  ticks the real class, and switching it off gives you your planner back exactly as it was.
  A catch-up tile starts at 09:30 (morning) or 14:00 (afternoon/evening), so within a day the morning one is listed
  first. The afternoon and the evening are **one** period: a class in the evening also takes the afternoon.
- **Calendar**: clicking a day opens a popup with everything planned that day (tick, edit, notes from there too).
  It also offers one-click buttons to add the usual class of each subject for that weekday (a subject's classes
  normally come on the same weekday at the same time every week; the planner reads that from the sessions it already
  has), plus a list to add any other subject/type. An added class is a normal tile you can edit or remove afterwards.

### Install it as an app (Android, desktop Chrome/Edge)

The planner is an installable web app named **Planner** with a calendar icon: it opens in its own window, without the
browser bars, and still opens when the server cannot be reached (your changes are then kept on the device and sent
when it is back).

Browsers only offer a real install on a **secure address (HTTPS)**. On Synology: Control Panel → Login Portal →
Advanced → Reverse Proxy, create a rule from `https://planner.your-domain` to `http://localhost:10457` (with a
certificate from Control Panel → Security → Certificate). Then open that address in Chrome on the phone and use
the **📲 Installer l'application** button in the planner (or Chrome menu → *Install app*). Over plain `http://` on
the local network Chrome only offers a shortcut, not an app.


### Reminders (sound, vibration, phone notification)

Open **🔔 Rappels** (next to the language flags). By default, 15 minutes before anything with a start time (class, live,
web conference, personal session, catch-up tile) the app shows a message with a sound and a vibration; you can change the
delay (5 to 60 min) or switch the sound off. Ticked sessions are not announced.

To be warned on the **phone while the app is closed**, press *Activer sur cet appareil* on the phone. This uses Web Push:
the planner server holds the schedule and sends an encrypted push (signed with a key pair it creates in the data folder,
`vapid.json`) to the phone's browser, which shows it with the system sound and vibration. It needs:

- the **HTTPS** address described above (browsers refuse push on plain `http://` addresses);
- the NAS able to reach the internet (the push goes through the browser vendor's push service, e.g. Google's for Chrome);
- optional: `VAPID_SUBJECT=mailto:you@example.org` in the container environment (some push services ask for a contact).

Costs: Web Push is free. WhatsApp, Telegram and SMS are not built in: SMS and the WhatsApp Business API are paid per
message; a Telegram bot is free but needs a bot token (a secret that stays in the container environment).

### Achievements (🏆 Succès tab)

Steam/PlayStation style medals, each tier with its own picture (the metal goes bronze → silver → gold → platinum → diamond,
decorations grow with it, and the subject's colour is used for subject medals):

- **Classes**: first live / first web conference **per subject**, then 2, 3, 5, 7, 10, 15, 20... up to the most that exists
  in your planner (the last tier is "all of them"), and the same for all subjects together;
- **Rhythm**: catch-ups (classes ticked after their day), streaks of 3 to 60 days with at least one class ticked each day
  (one rest day per week is tolerated), perfect weeks;
- **Assignments**: hand-ins, complete assignments;
- **Your planner**: stickers (up to 20 for the last tier), notes, things you created or changed, dark mode, language, colour,
  automatic catch-up, a class in every subject.

An unlocked medal stays unlocked for good (the date is saved with your data): unticking, a broken streak or a removed subject never
take it back. Each unlocked medal can be used as a **sticker** (Imprimer → Stickers et emojis → Succès, or on the app background);
locked ones are greyed out until you earn them. Ticks now remember the day they were made, which is what streaks and
catch-ups are counted on (older ticks count on the day of their class).

### English quiz at the door

Each time the app is opened, a question appears first: **basic English, level A1**, 50 questions that go from easy to a little
harder (words with pictures, polite phrases and introductions, "to be" / "to have", articles and plurals, numbers, days and months,
everyday words). The question is shown in the language of the app **and in English underneath**; the four answers are in English.
A wrong answer is fine: you still get in, the right answer turns **green** and a short explanation says what it means.

The course goes in order: the next question is the first one you have not answered right yet (a wrong answer comes back at the
next opening); once all 50 are done, the one asked longest ago comes back. Progress is saved with your data and earns English medals.

Turn it off or on again with the **🎓 Quiz** button next to the language flags (or "Désactiver ce quiz" under the question). It is
a learning tool, not a security lock: it only runs in the browser and does not protect the planner.

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
