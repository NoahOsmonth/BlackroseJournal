#!/usr/bin/env bash
# Deploy the verified Hindsight container to the laptop (sigmund@100.107.7.52,
# Arch/CachyOS + Docker). Idempotent: re-running stops/recreates the container
# but keeps the hindsight-laptop-data volume.
#
# The env below mirrors `docker inspect hindsight-laptop` on the laptop
# (2026-08-18 verified): image ghcr.io/vectorize-io/hindsight:latest, ports
# 8888+9999, volume at /home/hindsight/.pg0, OpenRouter LLM + VOYAGE AI
# embeddings (voyage-4-lite, 1024 dims) via Hindsight's OpenAI-compatible
# provider with a custom base URL (https://api.voyageai.com/v1). Voyage
# replaced local MiniLM/Gemini after free-tier quota issues; it returns an
# OpenAI-shaped response and auto-detects 1024 dims via a startup test embed
# — do NOT set HINDSIGHT_API_EMBEDDINGS_OPENAI_DIMENSIONS (Voyage rejects
# OpenAI's `dimensions` param; its own knob is `output_dimension`).
# NOTE: switching the embedding space does NOT migrate stored vectors — the
# dimension guard refuses to boot with rows in the old space, so reset the
# volume (or bank) after a switch and re-retain facts.
# Secrets are never baked in — inject at runtime:
#   HINDSIGHT_LLM_API_KEY                 (OpenRouter)
#   HINDSIGHT_VOYAGE_EMBEDDINGS_API_KEY   (Voyage AI, pa-...)
# POSIX-safe strict mode: the laptop's bash is dash-like and rejects pipefail.
set -eu

IMAGE="ghcr.io/vectorize-io/hindsight:latest"
NAME="hindsight-laptop"
VOLUME="hindsight-laptop-data"
CORS_NAME="hindsight-cors"
CORS_DIR="/home/sigmund/.hindsight-cors"

: "${HINDSIGHT_LLM_API_KEY:?set HINDSIGHT_LLM_API_KEY (OpenRouter)}"
: "${HINDSIGHT_VOYAGE_EMBEDDINGS_API_KEY:?set HINDSIGHT_VOYAGE_EMBEDDINGS_API_KEY (Voyage AI)}"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker volume create "$VOLUME" >/dev/null || true

docker run -d --name "$NAME" \
  --restart unless-stopped \
  -p 8888:8888 \
  -p 9999:9999 \
  -v "$VOLUME":/home/hindsight/.pg0 \
  -e HINDSIGHT_API_LLM_PROVIDER=openrouter \
  -e HINDSIGHT_API_LLM_BASE_URL=http://100.71.25.3:8877/v1 \
  -e HINDSIGHT_API_LLM_API_KEY="$HINDSIGHT_LLM_API_KEY" \
  -e HINDSIGHT_API_LLM_MODEL=deepseek/deepseek-v4-flash \
  -e HINDSIGHT_API_EMBEDDINGS_PROVIDER=openai \
  -e HINDSIGHT_API_EMBEDDINGS_OPENAI_API_KEY="$HINDSIGHT_VOYAGE_EMBEDDINGS_API_KEY" \
  -e HINDSIGHT_API_EMBEDDINGS_OPENAI_BASE_URL=https://api.voyageai.com/v1 \
  -e HINDSIGHT_API_EMBEDDINGS_OPENAI_MODEL=voyage-4-lite \
  -e HINDSIGHT_API_WORKER_ID=hindsight-laptop \
  -e HINDSIGHT_API_HOST=0.0.0.0 \
  -e HINDSIGHT_API_PORT=8888 \
  -e HINDSIGHT_API_LOG_LEVEL=info \
  -e HINDSIGHT_CP_DATAPLANE_API_URL=http://localhost:8888 \
  -e HINDSIGHT_ENABLE_API=true \
  -e HINDSIGHT_ENABLE_CP=true \
  "$IMAGE"

# Voyage needs no local model download; just wait up to 300s for health.
for i in $(seq 1 300); do
  if curl -fsS http://localhost:8888/health >/dev/null 2>&1; then
    echo "health:200 after ${i}s"
    break
  fi
  sleep 1
  if [ "$i" = 300 ]; then
    echo "health check timed out after 300s" >&2
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
