# PR3 — Provider layer + openai-compat adapter

**Goal:** Single `Provider<O, R>` interface with one built-in adapter (`openai-compat`). Reads from PR1's frozen config. Pure infrastructure — no caller changes yet.

**Depends on:** PR1 (config loader) — must be merged.

## File changes (NEW only — no modifications)

### `backend/src/services/ai/provider.ts` (~80 lines)
```ts
import type { Capabilities } from './capabilities';

export interface ChatRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface ChatResponse {
  content: string;
  reasoning: string;
  raw: unknown;
}

export interface ResolvedProfile {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  capabilities: Capabilities;
}

export interface Provider {
  readonly id: string;
  readonly capabilities: Capabilities;
  resolveProfile(profileName: 'default' | 'fast' | string): ResolvedProfile;
  chat(req: ChatRequest, profile: ResolvedProfile): Promise<ChatResponse>;
  stream(req: ChatRequest, profile: ResolvedProfile): Promise<Response>;
}
```

### `backend/src/services/ai/capabilities.ts` (~30 lines)
```ts
export type ReasoningField = 'reasoning' | 'reasoning_content';
export interface Capabilities {
  streaming: true;
  reasoning: boolean;
  reasoningField: ReasoningField | null;
  sseFormat: 'openai';
  authHeaderStyle: 'bearer';
}
```

### `backend/src/services/ai/adapters/openaiCompat.ts` (~200 lines)
- POSTs to `{apiBaseUrl}/chat/completions` with ONLY: `model`, `messages`, `stream`, `temperature`, `max_tokens`
- NO `max_context`, NO `reasoning` in body
- `Authorization: Bearer <key>` always set
- `Accept: text/event-stream` for streams
- `AbortSignal.timeout(60_000)` always set
- 1 retry on 429/503 with exponential backoff (200ms, 800ms)
- 0 retries on 4xx other than 429
- All `console.warn` / `console.error` run through `redactSecrets(key)`

### `backend/src/services/ai/retry.ts` (~40 lines)
```ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (err: unknown) => boolean,
  opts: { maxAttempts?: number; baseMs?: number } = {}
): Promise<T> { ... }
```

### `backend/src/services/ai/index.ts` (~30 lines)
Barrel re-exports.

### `backend/src/services/ai/redactSecrets.ts` (~20 lines) — NEW (referenced by adapter)
```ts
export function redactSecrets(input: string, key?: string): string {
  if (!key) return input;
  return input.split(key).join('[REDACTED]');
}
```

## New tests

### `__tests__/services/ai/openaiCompat.test.ts` (~180 lines)
- Request body contains ONLY OpenAI-standard fields (no `max_context`, no `reasoning`)
- `Authorization: Bearer <key>` set
- `Accept: text/event-stream` on streams
- `AbortSignal.timeout` passed to `fetch`
- 429 → 1 retry → 200 OK
- 503 → 1 retry → fail
- 401/400/404 → no retry, fail
- Secrets redacted in `console.warn` output

### `__tests__/services/ai/provider.test.ts` (~80 lines)
- `getProviderForProfile('default')` returns `openai-compat`
- Unknown profile throws

### `__tests__/services/ai/retry.test.ts` (~60 lines)
- Backoff timing, jitter, max-attempts cap
- Non-retryable errors propagate immediately

## Verification gates
- `npx tsc --noEmit` (root + backend)
- `npm run lint`
- `npm test -- --testPathPattern="services/ai|provider|retry"`
- `npm test` (full suite still green)
- `npm run check:design` (each file < 200 lines)

## TDD order (mandatory)
1. RED: write all 3 test files
2. Run them, paste RED output to notepad `## Findings — PR3`
3. Implement provider.ts → capabilities.ts → openaiCompat.ts → retry.ts → redactSecrets.ts → index.ts
4. Run tests, paste GREEN output
5. Run all verification gates

## Constraints
- File size: each new file ≤ 200 lines
- Functions: 5–15 lines
- No `process.env` reads inside `services/ai/`
- Pure functions where possible; only `openaiCompat.ts` does I/O
- All secrets redacted in logs

## Skills
- `init-deep` if needed
- `debugging` for retry edge cases
