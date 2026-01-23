# Task 002: Memory-aware AI flows (chat/check-in/new entry/Ask Rosebud)

## Problem
AI responses do not use Supermemory context, and Ask Rosebud still uses mocked responses instead of the LLM.

## Impact
- Users do not see personalized insights.
- Ask Rosebud does not reflect real history or time range selection.
- New entries and daily check-ins feel generic.

## Proposed Fix
- Add a context builder that pulls profile + search results for each AI request.
- Inject Supermemory context into `services/ai.ts` system prompt for chat and daily check-in.
- Replace Ask Rosebud mock response with LLM call that uses Supermemory context.
- Implement time-range logic:
  - This week / this month: use profile + query search with metadata date filters.
  - This year / all-time: use hybrid RAG search for broader recall.
- Ensure new entry flows include Supermemory context before the first user message.

## Acceptance Criteria
- Chat (freeform, daily check-in, continue) uses Supermemory profile + relevant memories in system prompt.
- New entry flow includes memory context before the first user message.
- Ask Rosebud uses the LLM + Supermemory (no mocked responses).
- Time range mapping: week/month uses profile + query search; year/all-time uses hybrid RAG search.
- Memory queries include metadata filters for entry dates when available.
- Tests verify context building and Ask Rosebud time-range behavior.

## References
- https://supermemory.ai/docs/user-profiles
- https://supermemory.ai/docs/search
- https://supermemory.ai/docs/concepts/memory-vs-rag
- https://supermemory.ai/docs/concepts/super-rag
- https://supermemory.ai/docs/concepts/filtering

## Subtasks
- Add a context builder that formats profile + memories for prompt injection.
- Update `services/ai.ts` to accept external context.
- Update `app/ask-rosebud.tsx` to call the AI service with time range selection.
- Add tests for time-range queries and context injection.

## Verification
- Unit tests: `npm test -- --runInBand __tests__/services/ai.test.ts __tests__/AskRosebud.test.tsx`
- Smoke test: open Ask Rosebud, select time ranges, confirm AI response renders.
