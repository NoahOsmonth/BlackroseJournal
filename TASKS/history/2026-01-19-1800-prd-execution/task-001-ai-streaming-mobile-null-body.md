# Task 001: Fix AI streaming on mobile (null body)

## Problem
On mobile (iOS/Android), chat can fail with:

- `AI Error: [Error: Response body is null]`

Call stack points to `streamChat` in `services/ai.ts`, where streaming depends on `response.body.getReader()`.

## Impact
- Users cannot use chat reliably on native.
- The app throws runtime errors instead of degrading gracefully.

## Likely Root Cause
React Native's `fetch()` / `Response` implementation may not expose a web-style ReadableStream on `response.body` for streaming SSE. On native, `response.body` can be `null` even when the response is otherwise OK.

## Proposed Fix
- Make `services/ai.ts` streaming implementation capability-aware:
  - If `response.body` exists and supports `getReader()`, keep existing streaming behavior.
  - If `response.body` is `null` (or lacks `getReader()`), fall back to a non-streaming request or whole-response parsing.
- Ensure the fallback still calls `onChunk`/`onComplete` (even if it delivers everything at once).
- Harden error messages so they include actionable context (status, body preview, whether streaming was available).
- Optional: add a timeout and abort support so stuck requests do not hang forever.

## Acceptance Criteria
- On iOS/Android, chat no longer throws `Response body is null`.
- Users can complete a chat turn on mobile (even if streaming is degraded to “non-streaming” behavior).
- On web, streaming continues to work as before.
- Unit tests cover:
  - streaming path (ReadableStream reader present)
  - fallback path (`response.body === null`)
  - non-OK responses (error path)

## References
- MDN: `Response.body` can be a `ReadableStream` or `null`
  - https://developer.mozilla.org/en-US/docs/Web/API/Response/body

## Subtasks
1. Update `services/ai.ts`:
   - Add streaming capability detection.
   - Implement a fallback path for native (no stream).
   - Improve parsing robustness (invalid JSON lines, partial SSE frames).
2. Add tests under `__tests__/services/` (or existing test structure):
   - mock fetch for both streaming + non-streaming cases.
3. Run quality gate.

## Verification
### Unit tests
- Targeted (add/adjust once test file exists):
  - `npm test -- --runInBand --testPathPattern=ai`

### Manual (required)
- Run on a device/simulator and send a message:
  - confirm no redbox error
  - confirm response appears (streaming optional)
- Run on web and confirm streaming still works.
