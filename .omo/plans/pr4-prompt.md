# PR4 — Wire modelClient + agentService + askRosebud

**Goal:** Replace `modelClient.ts`, remove the inline SSE parser in `agentService.ts`, resolve profiles server-side. First PR that changes the request path.

**Depends on:** PR1 (config), PR2 (streaming/extractors), PR3 (provider).

## File changes (MODIFICATIONS — first PR to change the request path)

### `backend/src/agent/modelClient.ts` (REWRITTEN, ~120 lines)
Becomes a thin wrapper:
```ts
import { getProviderForProfile } from '../services/ai';
import { getAiConfig } from '../config/ai';
import { extractReasoning } from '../services/ai/extractors';
import { redactSecrets } from '../services/ai/redactSecrets';

export async function createChatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number; model?: string } = {}
): Promise<{ content: string; reasoning: string }> {
  // Resolve profile server-side. Ignore client-supplied model in v1.
  const profile = resolveProfileFromRequest(options.model);
  const response = await getProviderForProfile('default').chat(
    { messages, temperature: options.temperature, maxTokens: options.maxTokens },
    profile
  );
  return { content: response.content, reasoning: response.reasoning };
}

export async function createChatCompletionStream(
  messages: ChatMessage[],
  options: { ... } = {}
): Promise<Response> {
  const profile = resolveProfileFromRequest(options.model);
  return getProviderForProfile('default').stream(
    { messages, temperature: options.temperature, maxTokens: options.maxTokens, stream: true },
    profile
  );
}

function resolveProfileFromRequest(modelOverride: string | undefined): ResolvedProfile {
  // Server-side profile resolution: ignore client-supplied model in v1.
  return getProviderForProfile('default').resolveProfile('default');
}
```

### `backend/src/agent/agentService.ts` (MODIFIED, ~150 lines)
- Drop the 30-line inline SSE parser (lines 33–60 in current code)
- Replace `readAssistantContentFromSseStream` with a call to `parseSseStream` from `services/ai/streaming`
- Keep the `clone()`-tee background-persistence pattern for `simpleMemService`
- Pass `ResolvedProfile` to the model client

### `backend/src/agent/askRosebudService.ts` (MODIFIED, ~60 lines)
- No structural change. `createChatCompletion` is still called the same way.
- The model client internally uses the `default` profile (per PR4 design).

### `backend/src/agent/types.ts` (MODIFIED)
- DROP `max_context?: number` from `ChatCompletionRequest` (it's the non-standard field)
- DROP it from the body that gets sent upstream

### `backend/src/index.ts` (MODIFIED)
- Add `loadConfig()` call at the top of the file (after `dotenv/config`, before `getServerConfig`)
- A single `console.log` on success; throw on validation failure
- Add the import: `import { loadConfig } from './config/ai';`

### `backend/src/routes/healthRoutes.ts` (MODIFIED, ~25 lines)
- `/health` returns `{ status: 'ok', config: { valid: true, profiles: ['default', 'fast'], defaultProfile: 'default' } }`
- `/ready` requires at least one valid profile; returns 503 if not
- Import `getAiConfig` from `../config/ai`

### `backend/src/routes/chatRoutes.ts` (MODIFIED)
- DROP `max_context` from `parseChatRequest` (line 24 of current file)
- Keep the `model` field for now (server-side resolver ignores it in v1)

## New tests

### `__tests__/agent/modelClient.test.ts` (~140 lines)
- `createChatCompletion` returns `{ content, reasoning }` from provider
- `reasoning` empty when `capabilities.reasoning === false`
- Streaming call does not consume the response body
- Server-side profile resolution: a request body that says `model: 'hack'` is ignored
- On missing config, throws at boot (asserted via `loadConfig()` invocation, not via request)

### `__tests__/integration/aiHealth.test.ts` (gated by `RUN_INTEGRATION_TESTS=1`)
- Boots the express app, hits `/health`, expects 200 with `config.valid === true`
- Hits `/ready`, expects 200

## Updated tests
- `__tests__/backend-modelClient-stream.test.ts` — update to import from new `modelClient.ts` shape
- `__tests__/backend-stream-memory.test.ts` — update mock to new wrapper signature
- `__tests__/askRosebud-service.test.ts` — update mock to new wrapper signature

## Verification gates
- `npx tsc --noEmit` (root + backend)
- `npm run lint`
- `npm test` (all existing + ~25 new tests pass)
- `RUN_INTEGRATION_TESTS=1 npm test -- --testPathPattern="integration/aiHealth"`
- Manual smoke:
  ```bash
  cd backend && NANO_GPT_API_KEY=sk-nano-test NANO_GPT_API_BASE_URL=https://nano-gpt.com/api/v1 npm run dev
  curl -s http://localhost:8787/health | jq .
  ```
  Expect: `{ "status": "ok", "config": { "valid": true, "profiles": ["default","fast"], "defaultProfile": "default" } }`

## TDD order (mandatory)
1. RED: write `__tests__/agent/modelClient.test.ts` first
2. Run, paste RED output to notepad `## Findings — PR4`
3. Implement the modelClient rewrite
4. Update existing tests
5. Run all gates

## Constraints
- File size: each file < 200 lines; if `agentService.ts` exceeds 150, split
- The 30-line inline parser in `agentService.ts:33–60` MUST be replaced with `parseSseStream` from PR2
- NO `max_context` in the body sent upstream — verify with a test
- Server-side profile resolution: client-supplied `model` MUST be ignored

## Skills
- `debugging` (streaming has historically been fragile)
- `security-research` (verify the new adapter doesn't leak the API key in logs)
