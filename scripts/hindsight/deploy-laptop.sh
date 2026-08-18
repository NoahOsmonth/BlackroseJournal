#!/usr/bin/env bash
# Deploy the verified Hindsight container to the laptop (sigmund@100.107.7.52,
# Arch/CachyOS + Docker). Idempotent: re-running stops/recreates the container
# but keeps the hindsight-laptop-data volume.
#
# The env below mirrors `docker inspect hindsight-test` on the dev machine
# (2026-08-18 verified): image ghcr.io/vectorize-io/hindsight:latest, ports
# 8888+9999, volume at /home/hindsight/.pg0, OpenRouter LLM + Google embeddings
# at 768 dims. Secrets are never baked in — inject at runtime:
#   HINDSIGHT_LLM_API_KEY           (OpenRouter)
#   HINDSIGHT_GEMINI_EMBEDDINGS_API_KEY
set -euo pipefail

IMAGE="ghcr.io/vectorize-io/hindsight:latest"
NAME="hindsight-laptop"
VOLUME="hindsight-laptop-data"
CORS_NAME="hindsight-cors"
CORS_DIR="/home/sigmund/.hindsight-cors"

: "${HINDSIGHT_LLM_API_KEY:?set HINDSIGHT_LLM_API_KEY (OpenRouter)}"
: "${HINDSIGHT_GEMINI_EMBEDDINGS_API_KEY:?set HINDSIGHT_GEMINI_EMBEDDINGS_API_KEY}"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker volume create "$VOLUME" >/dev/null || true

docker run -d --name "$NAME" \
  --restart unless-stopped \
  -p 8888:8888 \
  -p 9999:9999 \
  -v "$VOLUME":/home/hindsight/.pg0 \
  -e HINDSIGHT_API_LLM_PROVIDER=openrouter \
  -e HINDSIGHT_API_LLM_API_KEY="$HINDSIGHT_LLM_API_KEY" \
  -e HINDSIGHT_API_LLM_MODEL=dots-studio/dots-3-note-preview:free \
  -e HINDSIGHT_API_EMBEDDINGS_PROVIDER=google \
  -e HINDSIGHT_API_EMBEDDINGS_GEMINI_API_KEY="$HINDSIGHT_GEMINI_EMBEDDINGS_API_KEY" \
  -e HINDSIGHT_API_EMBEDDINGS_GEMINI_MODEL=gemini-embedding-001 \
  -e HINDSIGHT_API_EMBEDDINGS_GEMINI_OUTPUT_DIMENSIONALITY=768 \
  -e HINDSIGHT_API_WORKER_ID=hindsight-laptop \
  -e HINDSIGHT_API_HOST=0.0.0.0 \
  -e HINDSIGHT_API_PORT=8888 \
  -e HINDSIGHT_API_LOG_LEVEL=info \
  -e HINDSIGHT_CP_DATAPLANE_API_URL=http://localhost:8888 \
  -e HINDSIGHT_ENABLE_API=true \
  -e HINDSIGHT_ENABLE_CP=true \
  "$IMAGE"

# Image may need pulling; wait up to 60s for health.
for i in $(seq 1 60); do
  if curl -fsS http://localhost:8888/health >/dev/null 2>&1; then
    echo "health:200 after ${i}s"
    break
  fi
  sleep 1
  if [ "$i" = 60 ]; then
    echo "health check timed out after 60s" >&2
    exit 1
  fi
done

# CORS shim: Hindsight ships with no CORS support, so browsers (Expo web)
# cannot call the container cross-origin. Native RN has no CORS and talks to
# 8888 directly; the shim on 8890 adds Access-Control-Allow-* + OPTIONS
# handling for the web build. Host-network mode so 127.0.0.1:8888 resolves to
# the published Hindsight port.
mkdir -p "$CORS_DIR"
cp "$(dirname "$0")/cors-proxy.mjs" "$CORS_DIR/proxy.mjs" 2>/dev/null || \
  scp "$(dirname "$0")/cors-proxy.mjs" sigmund@100.107.7.52:"$CORS_DIR/proxy.mjs"
docker rm -f "$CORS_NAME" >/dev/null 2>&1 || true
docker run -d --name "$CORS_NAME" \
  --restart unless-stopped \
  --network host \
  -v "$CORS_DIR/proxy.mjs":/app/proxy.mjs:ro \
  node:22-alpine node /app/proxy.mjs >/dev/null
for i in $(seq 1 30); do
  if curl -fsS http://localhost:8890/health >/dev/null 2>&1; then
    echo "cors shim health:200 after ${i}s"
    exit 0
  fi
  sleep 1
done
echo "cors shim health check timed out" >&2
exit 1
