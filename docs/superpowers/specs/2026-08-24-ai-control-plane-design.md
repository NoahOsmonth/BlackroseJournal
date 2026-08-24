# Blackrose AI Control Plane Design

**Date:** 2026-08-24  
**Status:** Approved for implementation

## Outcome

Blackrose Journal gains a separately deployed admin web application and an authenticated AI gateway. Administrators can add, discover, publish, disable, archive, and reorder models backed by any supported provider. Signed-in clients receive catalog changes through the locally hosted Supabase Realtime service without an app release.

The existing custom-provider setting remains a user-controlled BYOK override. When it is off, the app uses the managed catalog and the selected managed model. When it is on, managed models disappear from the picker and requests go directly to the user's OpenRouter or OpenAI-compatible provider. Centrally funded credentials never reach the client.

Hindsight remains the long-term memory engine. Honcho is not part of the application architecture.

## Global Constraints

- Supabase is run locally through the Supabase CLI Docker stack today. All database artifacts must also deploy to hosted Supabase or a production self-hosted Supabase stack without changing application contracts.
- The mobile app is login-gated. A previously authenticated user may continue using their already downloaded, account-scoped journal data offline.
- Managed inference and Hindsight are gateway-only. User BYOK traffic remains device-direct.
- Managed chat uses the user-selected published model. Flash and structured extraction use an administrator-selected hidden model.
- There is no silent cross-model fallback. The gateway may retry the same model for bounded transient failures only.
- Provider credentials use gateway-owned envelope encryption. The master key is outside Postgres; Postgres stores ciphertext, nonce, authentication tag, key version, and safe key metadata only.
- Clients never choose a Hindsight bank. The gateway derives a stable opaque bank identifier from the authenticated Supabase user id using HMAC.
- The legacy shared `rosebud` bank is never read by authenticated users. Each user rebuilds their private bank from only their own account-scoped local history.
- Only authenticated-safe catalog tables are exposed in `public`. Providers, encrypted credentials, routes, admins, runtime controls, audits, usage, and rekey state live in a private `control` schema.
- Realtime publishes catalog rows and a singleton catalog revision only. It never publishes provider records, credentials, audits, or usage.
- UI follows the repository's UI -> hooks -> services layering, theme-token, dark-mode, spacing, and file-size rules.
- AsyncStorage ownership remains one module per key; all account-scoped persistence uses serialized mutation and corruption-safe schema-versioned envelopes.
- Every behavior change follows test-first red/green/refactor and ships with tests. Applied migrations are immutable; only new migrations may be added.

## System Boundaries

```text
Admin browser -> Admin web -> Gateway admin API -> control schema
                                             \-> provider discovery APIs

Signed-in app -> Supabase Auth
              -> public catalog + Realtime
              -> Gateway managed AI API -> provider adapter -> upstream provider
              -> Gateway memory API -> private Hindsight -> derived user bank

BYOK app mode -> user's provider directly
```

## Database Model

### Public authenticated-safe tables

- `ai_catalog_models`: stable id, public label, public model id, capabilities, context window, availability, sort order, revision timestamps. It contains no provider base URL or secret-bearing metadata.
- `ai_catalog_revision`: singleton monotonically increasing revision used to invalidate/refetch the catalog.
- `user_ai_preferences`: user id, selected managed model id, timestamps. Users may read and update only their own row; the selected model must be published and available.

### Private `control` schema

- `providers`: protocol, base URL, state, display metadata, discovery configuration, optimistic `revision`.
- `provider_credentials`: envelope-encrypted secret material and key metadata.
- `provider_models`: discovered upstream inventory and raw safe capability metadata.
- `model_routes`: mapping from a public catalog model to provider/model plus purpose (`chat` or `flash`), ceilings, state, and priority.
- `runtime_settings`: active flash route, safety ceilings, revision.
- `admins`: explicit admin user ids and roles.
- `audit_events`: actor, action, resource, before/after safe metadata, timestamp.
- `usage_events`: user, route, status, token/latency accounting without prompts or secrets.
- `rekey_jobs`: resumable credential-key rotation state.

RLS is deny-by-default. The mobile authenticated role can select public catalog rows and its own preference only. Administrative mutation occurs through the gateway service role after an explicit admin check.

## Gateway API

All `/v1` routes require a valid Supabase access token except health endpoints. Authentication verifies signature, issuer, audience, expiry, and subject using the configured Supabase JWKS/issuer.

### Client API

- `GET /v1/ai/catalog` returns `{ revision, models }` with no secret provider metadata.
- `PUT /v1/ai/preferences/model` accepts `{ modelId, expectedRevision? }` and rejects unavailable models.
- `POST /v1/ai/chat/completions` accepts the app's normalized OpenAI-style request plus `purpose: chat | flash`; the server selects the route and streams a normalized response.
- `POST /v1/memory/retain`, `/recall`, `/reflect`, `/rebuild`, and `DELETE /v1/memory` proxy Hindsight. The request schema has no bank field.

### Admin API

- Provider create/read/update/archive and credential rotation.
- `POST /v1/admin/providers/:id/discover` fetches upstream model inventory after SSRF-safe URL validation.
- Model inventory selection and publish/archive operations update the catalog transactionally and increment the catalog revision.
- Runtime settings choose the hidden flash route and ceilings.
- Audit and provider-health views never return plaintext credentials.

Mutations use `expectedRevision`; stale writes return `409` with current state. Removing a provider or model archives it and withdraws dependent public models rather than deleting historical references.

## Protocol Adapters

The internal request contract contains messages, system instruction, tools, tool choice, response format, temperature, top-p, maximum output, stream flag, and abort signal. The internal event contract contains text delta, tool-call delta, usage, completion reason, and normalized error.

Mandatory v1 adapters:

1. OpenAI Chat Completions (`/chat/completions`)
2. OpenAI Responses (`/responses`)
3. Anthropic Messages (`/messages`)
4. Gemini GenerateContent (`:generateContent` and streaming equivalent)

Each adapter owns wire translation and stream parsing. Gateway policy, route choice, quota, audit, and error normalization remain protocol-independent. The gateway validates administrator base URLs, blocks loopback/link-local/private network targets by default, bounds redirects and response sizes, and applies connection/read/total timeouts.

## Mobile Behavior

An auth bootstrap gate resolves the account before protected routes mount. Account-bound services receive an account namespace derived from the authenticated user id. On account switch, in-memory caches and subscriptions are torn down before the next namespace opens.

Managed mode subscribes to `ai_catalog_revision`, refetches atomically, and keeps the last known catalog for offline use. If a selected model is withdrawn, the UI explains that it is unavailable and requires a new explicit selection; it does not silently select another model.

BYOK mode keeps the existing custom-provider data owner and direct transport. Its picker shows only the user's custom/OpenRouter models. Turning BYOK off immediately restores the managed catalog and managed route.

## Memory Isolation and Migration

The gateway computes `bank = base32(HMAC-SHA256(memoryBankKey, supabaseUserId))` with a version prefix. Hindsight is bound to a private network interface and is inaccessible from mobile clients. Retain, recall, reflect, rebuild, and clear all use the derived bank.

On first authenticated migration, the app offers/starts an idempotent rebuild from that account's own local journal and check-in history through the gateway. The shared `rosebud` bank is quarantined and never copied because ownership cannot be established. Hindsight outages remain soft-fail for chat and finish paths.

## Operational Safety

- Per-user and per-route rate, concurrency, input-size, output-token, and timeout ceilings.
- Credential values are redacted from logs, errors, audits, and API responses.
- Health checks separate gateway/database/provider/Hindsight status.
- Catalog publish and archive are transactional; revisions are monotonic.
- Export/import and deployment documentation cover local CLI, hosted Supabase, and production self-hosted Supabase.
- Production verification includes real browser admin publish/withdraw, two-user memory isolation, managed chat, BYOK direct mode, account switch, offline reopen, and a cleared-demo recall probe with verbatim assistant output.

