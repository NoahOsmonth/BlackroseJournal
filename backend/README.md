# JournalApp Optional Local Backend

The app now talks to NanoGPT directly from the phone. This backend is kept as
an optional local development harness for route/provider testing only.

## Setup

```bash
cd backend
npm install
npm run dev
```

## Environment

Create `.env` in `backend/`:

- `PORT=8787`
- `ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081`
- `AGENT_API_KEY=` (optional; if set, client must send `Authorization: Bearer ...`)

### Authenticated Hindsight memory gateway

Memory routes are disabled when all Hindsight settings are absent and return
`503` after authentication. A partial configuration fails startup. Configure:

- `HINDSIGHT_BASE_URL=http://127.0.0.1:8888` — private, gateway-reachable URL;
  do not publish it to the app or bind the host port publicly.
- `HINDSIGHT_API_KEY=` — optional Hindsight bearer credential, server-side only.
- `HINDSIGHT_MEMORY_BANK_HMAC_KEY_BASE64=` — stable secret with at least 32
  random bytes (`openssl rand -base64 32`).
- `HINDSIGHT_MEMORY_BANK_KEY_VERSION=1` — positive version prefix for derived
  bank identifiers. Changing the key or version starts a new bank namespace;
  coordinate rotation with an account-owned rebuild.

`POST /v1/memory/retain`, `/recall`, `/reflect`, `/rebuild`, and
`DELETE /v1/memory` require a verified Supabase bearer token. The gateway
derives the bank from that token's `sub`; clients cannot submit or receive a
bank field. `rebuild` clears only the derived authenticated-user bank and then
retains the supplied bounded item set.

The old shared bank is quarantined. Never read it, copy it, or use it as a
rebuild source. Account banks are rebuilt only from that account's own
account-scoped history after the mobile migration is deployed. Hindsight
failures return generic gateway errors; optional mobile memory flows must keep
their existing soft-fail behavior.

### Model (LLM)
- `NANO_GPT_API_KEY=`
- `NANO_GPT_API_BASE_URL=https://nano-gpt.com/api/v1`
- `NANO_GPT_MODEL=nvidia/nemotron-3-ultra-550b-a55b`
- `NANO_GPT_FLASH_MODEL=nvidia/nemotron-3-ultra-550b-a55b`

## Scripts

- `npm run dev` - watch mode
- `npm run build` - compile
- `npm start` - start compiled server
