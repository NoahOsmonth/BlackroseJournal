# Task 001: Supermemory service + ingestion pipeline

## Problem
The app does not store or retrieve user memory via Supermemory, so AI responses lack long-term context and new entries do not know the user.

## Impact
- Chat and Ask Rosebud are not personalized.
- New journal entries start without user history.
- No RAG/memory foundation exists for future AI features.

## Proposed Fix
- Add a Supermemory service wrapper (e.g., `services/supermemory.ts`) using the `supermemory` SDK.
- Add config helpers for `SUPERMEMORY_API_KEY` (and optional `SUPERMEMORY_BASE_URL`) in a dedicated config module similar to `services/aiConfig.ts`.
- Store a stable user container tag in AsyncStorage (ex: `user_<uuid>`).
- Ingest journal entries on create/update with metadata (entryId, type, createdAt, updatedAt, timeRange).
- Ingest chat conversations using `customId` or `conversationId` to append updates.
- Update `.env.example` and docs for Supermemory configuration.

## Acceptance Criteria
- A Supermemory client/service exists under services/ with add/search/profile helpers.
- SUPERMEMORY_API_KEY (and optional SUPERMEMORY_BASE_URL) are read from Expo env/config like other AI settings.
- Each user has a stable container tag (stored locally) used for profile + search.
- Journal entry create/update stores content in Supermemory with metadata (entryId, type, createdAt).
- Chat conversations are appended using customId/conversationId to enable incremental updates.
- Unit tests cover Supermemory service calls and error handling.

## References
- https://supermemory.ai/docs/quickstart
- https://supermemory.ai/docs/integrations/supermemory-sdk
- https://supermemory.ai/docs/add-memories
- https://supermemory.ai/docs/user-profiles
- https://supermemory.ai/docs/search
- https://supermemory.ai/docs/concepts/filtering

## Subtasks
- Create Supermemory config + service wrapper.
- Add user container tag storage helper.
- Add ingestion calls for journal entry create/update.
- Add ingestion calls for chat transcripts.
- Add unit tests for Supermemory service.

## Verification
- Unit tests: `npm test -- --runInBand __tests__/services/supermemory.test.ts`
- Smoke test: create/update an entry and verify no runtime errors.
