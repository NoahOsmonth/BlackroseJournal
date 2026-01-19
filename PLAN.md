# Plan: Supermemory-powered AI + loading indicators

## Goal
1) Integrate Supermemory (profiles + hybrid RAG) so AI responses are personalized across chat, check-ins, new entries, and Ask Rosebud.
2) Replace Ask Rosebud mocks with real LLM responses grounded in Supermemory context and time ranges.
3) Add a non-clickable animated ellipsis indicator during AI responses and disable interactions while loading.

## Key References
- Supermemory Quickstart: https://supermemory.ai/docs/quickstart
- Supermemory SDK: https://supermemory.ai/docs/integrations/supermemory-sdk
- Add memories: https://supermemory.ai/docs/add-memories
- User profiles: https://supermemory.ai/docs/user-profiles
- Search (hybrid + filters): https://supermemory.ai/docs/search
- Filtering metadata: https://supermemory.ai/docs/concepts/filtering
- Memory vs RAG: https://supermemory.ai/docs/concepts/memory-vs-rag
- SuperRAG: https://supermemory.ai/docs/concepts/super-rag

## Scope
- Supermemory service + config:
  - New service under `services/` (client wrapper + helpers)
  - Env handling for `SUPERMEMORY_API_KEY` (+ optional base URL)
  - Stable user container tag storage
- Memory ingestion:
  - Journal entries (create/update) with metadata and customId
  - Chat conversation updates per session
- AI context integration:
  - `services/ai.ts` prompt context builder
  - `features/chat/hooks/useChatOrchestration.ts` and `app/chat.tsx`
  - `app/ask-rosebud.tsx` LLM response + time-range search strategy
- UI loading indicators + disabled interactions:
  - `components/ChatMessage.tsx`, `components/InlineTypingInput.tsx`
  - `app/chat.tsx`, `app/ask-rosebud.tsx`, `app/(tabs)/today.tsx`

## Quality Gate
```bash
npm run lint
npm test -- --runInBand
npm run check:design
```

## Testing Expectations
- Add service tests for Supermemory wrapper (mocked API calls).
- Add UI tests for typing indicator + disabled state in chat and Ask Rosebud.
- Add tests for time-range context selection (week/month vs year/all-time).

## Definition of Done
- Supermemory context is injected into all AI flows (chat, daily check-in, new entry, Ask Rosebud).
- Ask Rosebud uses LLM + Supermemory (no mock responses).
- Loading indicator uses animated ellipsis and click targets are disabled while AI responds.
- Tests cover service + UI + time-range behavior.
