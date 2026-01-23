# Task 001: Finish Entry -> Entry Reflection screen

## Problem
Right now, pressing **Finish entry** ends the flow quickly (save + navigate away). The desired UX is a richer post-finish experience: show an **Entry Reflection** screen with AI-generated reflection and a Key Insight, matching the provided screenshots.

## Impact
- Creates a satisfying “wrap-up” moment after journaling
- Provides immediate value from AI (reflection + insight)
- Sets up the downstream Suggestions/Habits loop

## Proposed Fix
- Add a new route/screen: `app/entry-reflection.tsx`.
- After `handleFinishEntry` completes saving, navigate to `entry-reflection` with `entryId`.
- Implement a hook `hooks/useEntryReflection.ts` that:
  - loads the entry from storage via `services/journalStorage.ts`
  - calls `services/ai.ts` to generate structured reflection content
  - exposes loading/error states
- UI should match screenshots:
  - Title: "Entry Reflection"
  - Card with reflection text
  - "Key Insight" section
  - Share button and light feedback controls (thumb up/down) (can be non-functional initially if documented)
  - A "Suggestions" row/CTA that opens Task 002
  - A sticky bottom "Continue" button

## Acceptance Criteria
- Finish entry still saves the entry as completed (no regressions to Entries/continue-entry).
- After saving, the app navigates to `entry-reflection` for that entry.
- Screen renders reflection body + Key Insight content (AI-generated; can be mocked in tests).
- "Suggestions" CTA navigates to a Suggestions list screen (Task 002).
- Continue button proceeds to the next step (Task 003) or exits gracefully if Task 003 isn’t implemented yet.
- No “Add to long-term memory” UI is added anywhere.

## References
- User-provided screenshots: Entry Reflection UI and layout
- Finish entry handler: `app/chat.tsx` (search `handleFinishEntry`)
- Footer button source: `components/FooterActions.tsx`
- Storage: `services/journalStorage.ts`

## Subtasks
1. Add `app/entry-reflection.tsx` route and minimal layout.
2. Create `hooks/useEntryReflection.ts` orchestration.
3. Add `services/ai.ts` helper:
   - `generateEntryReflection({ entryText, messages, ... }) -> { reflection, keyInsight, suggestions }`
   - Prefer a JSON response to reduce parsing brittleness.
4. Wire Finish entry navigation to the new screen.
5. Add tests for navigation + rendering.

## Verification
### Unit/Component Tests
- Add `__tests__/screens/EntryReflection.test.tsx`
- Update existing chat tests to assert finish navigates to reflection:
  - likely extend `__tests__/ChatScreen.test.tsx`

Targeted run:
- `npm test -- --testPathPattern=EntryReflection --runInBand`

### Manual
- Finish an entry; confirm Reflection appears and content loads.
- Confirm no long-term memory card exists.
