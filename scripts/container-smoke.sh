#!/usr/bin/env bash
# Smoke test of the built image. Usage: scripts/container-smoke.sh <image>
# Proves: it starts, serves the app, saves data to the mounted folder, keeps it across restart AND recreate,
# never re-seeds over existing data, and explains a permission problem instead of failing silently.
set -euo pipefail
IMG="${1:?image name}"
NAME="planner-smoke-$$"
DATA="$(mktemp -d)"
chmod 777 "$DATA"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$DATA" 2>/dev/null || sudo rm -rf "$DATA" || true; }
trap cleanup EXIT
fail() { echo "FAIL: $*"; docker logs "$NAME" 2>&1 | tail -20 || true; exit 1; }

run() { docker run -d --name "$NAME" -p 18088:8080 -v "$DATA:/data" "$@" "$IMG" >/dev/null; }
wait_up() { for _ in $(seq 1 40); do curl -fs http://127.0.0.1:18088/healthz >/dev/null 2>&1 && return 0; sleep 0.5; done; fail "server did not come up"; }
api() { curl -fsS -H 'X-Planner-Client: 1' -H 'Content-Type: application/json' "$@"; }
rev() { api http://127.0.0.1:18088/api/state | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).rev))'; }
field() { api http://127.0.0.1:18088/api/state | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const f=eval(process.argv[1]);console.log(JSON.stringify(f(JSON.parse(s))))})' "$1"; }

echo "== start"
run; wait_up
curl -fs http://127.0.0.1:18088/ | grep -q '<div id="root">' || fail "app page not served"
curl -fs http://127.0.0.1:18088/ | grep -qE 'assets/index-[A-Za-z0-9_-]+\.js' || fail "built bundle not referenced"
JS=$(curl -fs http://127.0.0.1:18088/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -fs "http://127.0.0.1:18088/$JS" -o /dev/null || fail "bundle not served"
docker logs "$NAME" 2>&1 | grep -q "version ci-smoke" || fail "version not reported in the log"
[ "$(docker inspect -f '{{.State.Health.Status}}' "$NAME" 2>/dev/null || echo none)" != "unhealthy" ] || fail "unhealthy"

echo "== first start uses the schedule bundled in the image (seed/default.json)"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
EXPECT=$(node -e 'const s=require(process.argv[1]);console.log(JSON.stringify([s.base.s.map(x=>x.id),s.base.e.length,s.base.d.length]))' "$HERE/seed/default.json")
GOT=$(field 's => [s.base.s.map(x=>x.id),s.base.e.length,s.base.d.length]')
[ "$EXPECT" = "$GOT" ] || fail "image does not start with the bundled default schedule (expected $EXPECT, got $GOT)"

echo "== save data (state + an uploaded file)"
R=$(rev)
api -X PUT http://127.0.0.1:18088/api/state -d "{\"baseRev\":$R,\"data\":{\"done\":{\"smoke\":true},\"edits\":{\"app\":{\"title\":\"Smoke test\"}}}}" >/dev/null
FID=$(curl -fsS -H 'X-Planner-Client: 1' -H 'Content-Type: text/plain' --data-binary 'hello from the smoke test' http://127.0.0.1:18088/api/files | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))')
[ -n "$FID" ] || fail "upload failed"
ls "$DATA/state.json" >/dev/null || fail "state.json not written to the mounted folder"
ls "$DATA/files/$FID" >/dev/null || fail "file not written to the mounted folder"

echo "== restart the same container"
docker restart "$NAME" >/dev/null; wait_up
[ "$(field 's => s.data.done.smoke')" = "true" ] || fail "data lost after restart"
curl -fs "http://127.0.0.1:18088/api/files/$FID?name=a.txt" | grep -q 'hello from the smoke test' || fail "file lost after restart"

echo "== destroy the container and create a new one on the same folder (like an update)"
docker rm -f "$NAME" >/dev/null; run; wait_up
[ "$(field 's => s.data.done.smoke')" = "true" ] || fail "data lost after recreate"
[ "$(field 's => s.data.edits.app.title')" = '"Smoke test"' ] || fail "title lost after recreate (the demo seed must never overwrite saved data)"

echo "== a corrupt state file is moved aside and recovered from a backup"
docker rm -f "$NAME" >/dev/null
ls "$DATA/backups" | grep -q . || fail "no automatic backup was made"
# the file belongs to the container's user, so damage it from inside a container (as a real disk fault would)
docker run --rm -v "$DATA:/data" --entrypoint sh "$IMG" -c "echo '{ broken' > /data/state.json"
run; wait_up
ls "$DATA" | grep -q '^state.corrupt-' || fail "corrupt file was not kept for inspection"
[ "$(field 's => !!s.data')" = "true" ] || fail "no state after recovery"

echo "== a folder owned by another user (like a NAS user's shared folder) just works, and the server is not root"
docker rm -f "$NAME" >/dev/null
OWN="$(mktemp -d)"; sudo chown 1026:100 "$OWN"; sudo chmod 755 "$OWN"
docker run -d --name "$NAME" -p 18088:8080 -v "$OWN:/data" "$IMG" >/dev/null; wait_up
[ "$(stat -c %u "$OWN/state.json")" = "1026" ] || fail "files in the NAS-owned folder are not owned by the folder owner"
docker logs "$NAME" 2>&1 | grep -q "running as uid 1026" || fail "did not adopt the folder owner"
[ "$(docker exec "$NAME" sh -c 'awk "/^Uid/{print \$2}" /proc/1/status')" = "1026" ] || fail "server still runs as root"
docker rm -f "$NAME" >/dev/null; sudo rm -rf "$OWN"

echo "== a root-owned folder (what Docker creates for a missing bind path) just works"
ROOTD="$(mktemp -d)"; sudo chown 0:0 "$ROOTD"; sudo chmod 755 "$ROOTD"
docker run -d --name "$NAME" -p 18088:8080 -v "$ROOTD:/data" "$IMG" >/dev/null; wait_up
[ "$(stat -c %u "$ROOTD/state.json")" = "1000" ] || fail "root-owned folder was not handed to the unprivileged user"
docker rm -f "$NAME" >/dev/null; sudo rm -rf "$ROOTD"

echo "== existing data with the wrong owner is kept (ownership is repaired, nothing is deleted)"
KEEP="$(mktemp -d)"; sudo chown 1000:1000 "$KEEP"
docker run -d --name "$NAME" -p 18088:8080 -v "$KEEP:/data" "$IMG" >/dev/null; wait_up
R=$(rev); api -X PUT http://127.0.0.1:18088/api/state -d "{\"baseRev\":$R,\"data\":{\"done\":{\"precious\":true}}}" >/dev/null
docker rm -f "$NAME" >/dev/null; sudo chown -R 0:0 "$KEEP"
docker run -d --name "$NAME" -p 18088:8080 -v "$KEEP:/data" "$IMG" >/dev/null; wait_up
[ "$(field 's => s.data.done.precious')" = "true" ] || fail "data lost when the folder had the wrong owner"
docker rm -f "$NAME" >/dev/null; sudo rm -rf "$KEEP"

echo "== wrong permissions are explained"
docker rm -f "$NAME" >/dev/null
RO="$(mktemp -d)"; chmod 555 "$RO"
OUT=$(docker run --rm --user 4321:4321 -v "$RO:/data" "$IMG" 2>&1 || true)
rmdir "$RO" 2>/dev/null || true
echo "$OUT" | grep -q "not writable" || fail "no clear message for a read-only data folder: $OUT"

echo "OK: container smoke test passed"
