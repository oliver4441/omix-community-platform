#!/usr/bin/env bash
#
# Local smoke test for the gateway + per-domain service architecture.
#
# Each worker runs `wrangler dev` with its OWN local D1 state (sharing one
# local D1 file across processes triggers SQLITE_BUSY in workerd). A session
# row is seeded directly into the gateway's local DB so the gateway's session
# check passes end-to-end and requests are routed to each service.
#
# Usage:  bash scripts/smoke-workers.sh
#
set -u

cd "$(dirname "$0")/.."
GW_PORT=8797
GW="http://127.0.0.1:$GW_PORT"
SEED_TOKEN="smoke-token-123"
SEED_UID="smoke-user"

# (name port) — gateway last
WORKERS=(
  "omix-chat 8791"
  "omix-auth 8792"
  "omix-social 8793"
  "omix-servers 8794"
  "omix-notifications 8795"
  "omix-uploads 8796"
  "omix-gateway 8797"
)

PIDS=()
PASS=0
FAIL=0

cleanup() {
  for p in "${PIDS[@]:-}"; do
    kill "$p" 2>/dev/null
  done
  wait 2>/dev/null
  rm -rf /tmp/omix-state
  echo "== teardown complete =="
}
trap cleanup EXIT

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1)); echo "PASS  $desc (got $actual)"
  else
    FAIL=$((FAIL + 1)); echo "FAIL  $desc — expected $expected, got $actual"
  fi
}

# Persist dirs live in /tmp (outside the project) so wrangler's esbuild file
# watcher doesn't see the other workers' writes and deadlock.
STATE_DIR="/tmp/omix-state"
rm -rf "$STATE_DIR"
mkdir -p "$STATE_DIR"

echo "== applying D1 migrations (unique local state per worker) =="
for entry in "${WORKERS[@]}"; do
  set -- $entry
  name="$1"
  out=$(timeout 45 npx wrangler d1 migrations apply omix-db --local --persist-to "$STATE_DIR/$name" -c "workers/$name/wrangler.toml" 2>&1 | tail -1)
  echo "  $name: $out"
done

echo "== seeding a session into the gateway's local DB =="
npx wrangler d1 execute omix-db --local --persist-to "$STATE_DIR/omix-gateway" -c workers/omix-gateway/wrangler.toml \
  --command "INSERT OR IGNORE INTO users (id, email, email_confirmed_at, avatar_url, full_name, github_username, created_at, updated_at) VALUES ('$SEED_UID', 'smoke@test.dev', '2026-01-01T00:00:00Z', '', 'Smoke Test', '', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');" > /dev/null
npx wrangler d1 execute omix-db --local --persist-to "$STATE_DIR/omix-gateway" -c workers/omix-gateway/wrangler.toml \
  --command "INSERT OR IGNORE INTO sessions (token, user_id, created_at, expires_at) VALUES ('$SEED_TOKEN', '$SEED_UID', '2026-01-01T00:00:00Z', '2030-01-01T00:00:00Z');" > /dev/null
echo "  seeded session token: $SEED_TOKEN"

echo
echo "== starting workers (staggered) =="
for entry in "${WORKERS[@]}"; do
  set -- $entry
  name="$1"; port="$2"
  echo "  $name on :$port"
  # --inspector-port 0 disables the workerd inspector (default 9229) so the
  # parallel workers don't fight over the port; unique --persist-to keeps each
  # worker's local D1 file separate (workerd can't share one SQLite file).
  npx wrangler dev -c "workers/$name/wrangler.toml" --port "$port" --ip 127.0.0.1 \
    --inspector-port 0 --persist-to "$STATE_DIR/$name" \
    > "/tmp/omix-smoke-$name.log" 2>&1 &
  PIDS+=($!)
  sleep 3
done

echo
echo "== waiting for workers to accept connections =="
for entry in "${WORKERS[@]}"; do
  set -- $entry
  port="$2"
  ready=""
  for _ in $(seq 1 60); do
    if curl -s -m 3 -o /dev/null "http://127.0.0.1:$port/health" 2>/dev/null; then ready=1; break; fi
    sleep 1
  done
  if [ -n "$ready" ]; then echo "  :$port ready"; else echo "  :$port NOT ready (log tail)"; tail -5 "/tmp/omix-smoke-$1.log"; fi
done

echo
echo "== gateway edge + auth flow (through :$GW_PORT) =="

code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' "$GW/health")
check "GET /health (gateway edge)" "200" "$code"
grep -q '"ok":true' /tmp/smoke-body && echo "  body ok: $(cat /tmp/smoke-body)" || echo "  body WRONG: $(cat /tmp/smoke-body)"

code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' -X OPTIONS "$GW/servers")
check "OPTIONS /servers (CORS preflight)" "204" "$code"

code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' "$GW/servers")
check "GET /servers without session → 401" "401" "$code"

code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' -X POST "$GW/auth/signup" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke2@test.dev","password":"secret1","displayName":"Smoke"}')
[ "$code" = "200" ] || [ "$code" = "409" ] \
  && { PASS=$((PASS + 1)); echo "PASS  POST /auth/signup via gateway (got $code)"; } \
  || { FAIL=$((FAIL + 1)); echo "FAIL  POST /auth/signup via gateway (got $code): $(head -c 200 /tmp/smoke-body)"; }

code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' -X POST "$GW/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"smoke2@test.dev","password":"secret1"}')
check "POST /auth/login via gateway (auth binding)" "200" "$code"

AUTH="Authorization: Bearer $SEED_TOKEN"

echo
echo "== routed session routes (gateway gate → routeFor → service binding → handler) =="
for path in servers dm-channels board-posts call-log notification-settings feed presence; do
  code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' "$GW/$path" -H "$AUTH")
  if [ "$code" = "200" ]; then
    PASS=$((PASS + 1)); echo "PASS  GET /$path → 200 (routed to service)"
  elif [ "$code" = "500" ]; then
    FAIL=$((FAIL + 1)); echo "FAIL  GET /$path → 500: $(head -c 200 /tmp/smoke-body)"
  else
    echo "INFO  GET /$path → $code: $(head -c 160 /tmp/smoke-body)"
  fi
done

echo
echo "== per-service direct check (stamped headers, own local DB) =="
for entry in "omix-chat:8791:dm-channels" "omix-social:8793:board-posts" "omix-servers:8794:servers" "omix-servers:8794:call-log" "omix-notifications:8795:notification-settings"; do
  IFS=: read -r svc port path <<< "$entry"
  code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' "http://127.0.0.1:$port/$path" \
    -H "x-omix-user-id: $SEED_UID" -H "x-omix-user-email: smoke@test.dev" -H "x-omix-user-admin: 0")
  [ "$code" = "200" ] \
    && { PASS=$((PASS + 1)); echo "PASS  $svc GET /$path (direct) → 200"; } \
    || { FAIL=$((FAIL + 1)); echo "FAIL  $svc GET /$path (direct) → $code: $(head -c 160 /tmp/smoke-body)"; }
done

echo
echo "== edge cases =="

code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' "$GW/messages/nonexistent" -H "$AUTH")
echo "INFO  GET /messages/nonexistent → $code (chat): $(head -c 120 /tmp/smoke-body)"

code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' "$GW/nonsense" -H "$AUTH")
check "GET /nonsense (no route → 404)" "404" "$code"

code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' "$GW/assets/missing.png")
check "GET /assets/missing.png (uploads 404)" "404" "$code"

code=$(curl -s -m 10 -o /tmp/smoke-body -w '%{http_code}' "$GW/push/vapid-public-key")
check "GET /push/vapid-public-key (no key → 503)" "503" "$code"

echo
echo "==== SMOKE RESULT: $PASS passed, $FAIL failed ===="
[ "$FAIL" = "0" ]
