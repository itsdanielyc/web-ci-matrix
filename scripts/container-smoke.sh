#!/usr/bin/env bash
# L7 analogue for a web service: build the image, run the container the way
# production would (named volume for the database), hit the health endpoint
# and the create/list API, restart the container and check the note survived,
# then stop and remove only what this script started.
# Usage: bash scripts/container-smoke.sh   (needs docker and curl)
set -euo pipefail

image="${IMAGE:-spike:smoke}"
name="spike-smoke-$$"
volume="spike-smoke-data-$$"
port="${SMOKE_PORT:-18080}"
base="http://localhost:${port}"

cleanup() {
  docker logs "$name" > "${LOG_FILE:-container.log}" 2>&1 || true
  docker rm -f "$name" > /dev/null 2>&1 || true
  docker volume rm "$volume" > /dev/null 2>&1 || true
}
trap cleanup EXIT

wait_healthy() {
  for _ in $(seq 1 60); do
    if curl -fsS "$base/api/health" > /dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "server did not answer /api/health within 60 s" >&2
  docker logs "$name" >&2 || true
  return 1
}

echo "== build $image"
docker build -t "$image" .

echo "== run $name on port $port"
docker volume create "$volume" > /dev/null
docker run -d --name "$name" -p "${port}:8080" -v "${volume}:/data" "$image" > /dev/null
wait_healthy
health="$(curl -fsS "$base/api/health")"
echo "health: $health"
[ "$health" = '{"status":"ok"}' ] || { echo "unexpected health body" >&2; exit 1; }

text="container note $(date +%s)"
created="$(curl -fsS -X POST "$base/api/notes" -H 'content-type: application/json' -d "{\"text\":\"$text\"}")"
echo "created: $created"
echo "$created" | grep -q "\"text\":\"$text\"" || { echo "create did not echo the note" >&2; exit 1; }

curl -fsS "$base/api/notes" | grep -q "$text" || { echo "list does not contain the note" >&2; exit 1; }
echo "list contains the note"

# The page itself is served too.
curl -fsS "$base/" | grep -q "<title>" || { echo "client not served at /" >&2; exit 1; }
echo "client served at /"

echo "== restart: the note must survive on the volume"
docker restart "$name" > /dev/null
wait_healthy
curl -fsS "$base/api/notes" | grep -q "$text" || { echo "note lost across restart" >&2; exit 1; }
echo "note survived the restart"

echo "== stop"
docker stop "$name" > /dev/null
echo "container smoke passed"
