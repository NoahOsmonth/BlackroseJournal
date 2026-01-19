# Task 007: Entry Action Modal (Continue vs New)

## Problem
The Entries tab must offer an action modal when a user taps an entry: Continue Entry (edit mode, appending messages) or Create New Entry.

## Impact
- Enables revisiting and extending prior reflections
- Aligns Entries behavior with the epic spec

## Proposed Fix
- Add an action sheet/modal in the Entries screen.
- Extend chat route to accept `entryId` and `mode=continue`.
- In continue mode, render prior messages as read-only with subtle background, and append new messages to the same entry.

## Acceptance Criteria
- Tapping an entry card opens an action modal with:
  - Continue Entry
  - Create New Entry
  - Cancel
- Continue Entry:
  - Opens chat with prior messages loaded.
  - Prior messages are visually distinguished as read-only.
  - New messages append to the same entry.
- Create New Entry opens blank chat.
- Modal dismiss is smooth and accessible.

## References
- Spec: Core User Flows section 6

## Subtasks
1. Implement action modal component (reusable): `components/entries/EntryActionModal.tsx`.
2. Wire entry card press -> modal.
3. Implement continue-entry navigation to chat with params.
4. Update chat orchestration to support append-to-entry.
5. Add tests for modal behavior and navigation intent.

## Verification
### Unit/Component Tests
- Add `__tests__/screens/EntriesActionModal.test.tsx`
- Targeted run:
  - `npm test -- --testPathPattern=EntriesActionModal --runInBand`

### Manual
- Tap an existing entry, choose Continue, append messages, return to Entries, confirm the entry content updated.

