# Plan: Fix mobile AI streaming error + safe area warning

## Goal
1) Fix the mobile runtime error:
	- `AI Error: [Error: Response body is null]` originating from `services/ai.ts` streaming.
2) Eliminate the runtime warning:
	- `SafeAreaView has been deprecated... Please use 'react-native-safe-area-context' instead.`
3) Add guardrails so these issues do not regress (tests + safer configuration).

## Primary Symptoms (Current)
- On mobile (iOS/Android), chat streaming can crash because `response.body` is `null`.
- A SafeAreaView deprecation warning is logged at runtime.

## Working Hypotheses
- React Native's `fetch()` implementation may not support web ReadableStreams/SSE in the same way as browsers.
	- On native, `Response.body` may be `null` even when the request succeeds.
	- Streaming SSE parsing that works on web may need a fallback path on native.
- Some code path (app code or a dependency) still imports `SafeAreaView` from `react-native`.

## Key References
- react-native-safe-area-context docs:
	- https://appandflow.github.io/react-native-safe-area-context/usage
- MDN `Response.body` (ReadableStream or null):
	- https://developer.mozilla.org/en-US/docs/Web/API/Response/body

## Scope
- AI streaming robustness and graceful fallback:
	- `services/ai.ts` (streaming reader, fallback to non-streaming, error messages)
	- tests under `__tests__/services/`
- AI configuration hygiene:
	- remove hardcoded API key from source
	- load key from env/config in a way that works on web + native
- SafeArea deprecation warning:
	- identify & remove any `SafeAreaView` imports from `react-native`
	- ensure `react-native-safe-area-context` provider/consumers are used consistently

## Quality Gate
```bash
npm run lint
npm test -- --runInBand
npm run check:design
```

## Testing Expectations
- Add unit tests for `services/ai.ts` that cover:
	- streaming path (web-like ReadableStream)
	- non-streaming fallback when `response.body` is null
	- non-OK responses and malformed payloads
- Add tests to prevent future SafeAreaView regressions:
	- a static test/guard that fails if app code imports `SafeAreaView` from `react-native`

## Definition of Done
- Mobile no longer throws `Response body is null` during chat.
- Chat still works on web (streaming remains supported where available).
- SafeAreaView deprecation warning is no longer emitted from app code.
- Automated tests exist to catch regressions.
- No new lint/test warnings, and design limits remain respected.
