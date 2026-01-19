# Task 001: Journal Entry Storage Service

## Problem
The app currently has no persistence layer for journal entries. We need a storage service that can save, retrieve, and manage journal entries (both completed and drafts) across app sessions.

## Impact
- Foundation for all other features (history, drafts, finish entry)
- Without this, journal entries are lost when app closes
- Blocks FEAT-003, FEAT-005, FEAT-006

## Proposed Solution
1. Install `@react-native-async-storage/async-storage`
2. Create `services/journalStorage.ts` with CRUD operations
3. Define `JournalEntry` type with all required fields
4. Create a hook `hooks/useJournalEntries.ts` for React integration

## Acceptance Criteria
- [ ] JournalEntry type defined with: id, title, emoji, messages, status (draft/completed), createdAt, updatedAt
- [ ] Storage service with create, read, update, delete, list operations
- [ ] Entries persist across app restarts
- [ ] Service is testable with mock storage
- [ ] Separate methods for drafts vs completed entries

## File References
- New: `services/journalStorage.ts`
- New: `services/journalStorage.types.ts`
- New: `hooks/useJournalEntries.ts`
- New: `__tests__/journalStorage.test.ts`
- Existing types: `features/chat/types.ts`

## Subtasks
1. [ ] Install @react-native-async-storage/async-storage
2. [ ] Create JournalEntry and related types in `services/journalStorage.types.ts`
3. [ ] Implement storage service in `services/journalStorage.ts`
4. [ ] Create React hook for accessing entries in `hooks/useJournalEntries.ts`
5. [ ] Write unit tests for storage service

## Verification
**Unit Tests:**
```bash
npm test -- --testPathPattern=journalStorage --runInBand
```

**Manual:**
1. Create an entry, close app, reopen - entry persists
2. Update entry status from draft to completed
3. Delete entry and verify removal

## Dependencies
- @react-native-async-storage/async-storage

## Notes
- Keep storage service pure (no UI imports)
- Use dependency injection for AsyncStorage to enable testing
- Follow AGENTS.md: services < 200 lines, add tests
