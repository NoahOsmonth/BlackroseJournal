#!/usr/bin/env bash
# Deploy the verified Hindsight container behind the authenticated gateway.
# Idempotent: re-running stops/recreates the container but keeps the
# hindsight-laptop-data volume. Host ports are loopback-only; never expose
# Hindsight or a CORS shim directly to mobile/web clients.
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
# Optional toggles:
#   HINDSIGHT_AUTO_CONSOLIDATION=true|false  (default true; E2E probes set false —
#     background consolidation rewrites fresh facts within ~5 min, which races
#     deterministic live-probe recall assertions)
# POSIX-safe strict mode: the laptop's bash is dash-like and rejects pipefail.
set -eu

IMAGE="ghcr.io/vectorize-io/hindsight:latest"
NAME="hindsight-laptop"
VOLUME="hindsight-laptop-data"

: "${HINDSIGHT_LLM_API_KEY:?set HINDSIGHT_LLM_API_KEY (OpenRouter)}"
: "${HINDSIGHT_VOYAGE_EMBEDDINGS_API_KEY:?set HINDSIGHT_VOYAGE_EMBEDDINGS_API_KEY (Voyage AI)}"

# Auto-consolidation toggle: on by default; E2E probes turn it off (see header).
CONSOLIDATION_FLAG="${HINDSIGHT_AUTO_CONSOLIDATION:-true}"
case "$CONSOLIDATION_FLAG" in
  true|false) ;;
  *) echo "HINDSIGHT_AUTO_CONSOLIDATION must be true or false" >&2; exit 1 ;;
esac

docker rm -f "$NAME" >/dev/null 2>&1 || true
# Remove the former direct browser exposure if this host used an older deploy.
docker rm -f hindsight-cors >/dev/null 2>&1 || true
docker volume create "$VOLUME" >/dev/null || true

docker run -d --name "$NAME" \
  --restart unless-stopped \
  -p 127.0.0.1:8888:8888 \
  -p 127.0.0.1:9999:9999 \
  -v "$VOLUME":/home/hindsight/.pg0 \
  -e HINDSIGHT_API_LLM_PROVIDER=openrouter \
  -e HINDSIGHT_API_LLM_BASE_URL=http://172.17.0.1:20128/v1 \
  -e HINDSIGHT_API_LLM_API_KEY="$HINDSIGHT_LLM_API_KEY" \
  -e HINDSIGHT_API_LLM_MODEL=merge/deepseek/deepseek-v4-flash-0731 \
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
  -e HINDSIGHT_API_ENABLE_AUTO_CONSOLIDATION="$CONSOLIDATION_FLAG" \
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

echo "hindsight is healthy on gateway-local http://127.0.0.1:8888"
