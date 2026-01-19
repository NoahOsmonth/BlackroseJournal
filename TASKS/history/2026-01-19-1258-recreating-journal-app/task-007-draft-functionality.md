# Task 007: Draft Functionality for Unfinished Entries

## Problem
When users close a chat without finishing (pressing X), the conversation is lost. Instead, it should auto-save as a draft that can be resumed later.

## Impact
- No work is lost when users close the app
- Users can return to incomplete entries
- Better UX for interrupted journaling sessions

## Proposed Solution
1. Detect when X is pressed with unsaved content
2. Auto-save as draft to storage
3. Show drafts in a separate tab or section in history
4. Tapping a draft resumes the chat with previous messages
5. Finishing a draft converts it to completed entry

## Acceptance Criteria
- [ ] Pressing X on chat with content saves entry as draft automatically
- [ ] Draft entries are stored with status: 'draft'
- [ ] Drafts tab or section in header/history shows draft entries
- [ ] Tapping a draft entry resumes the chat with previous messages
- [ ] Draft is converted to completed entry when 'Finish Entry' is pressed
- [ ] Empty chats are not saved as drafts
- [ ] Draft shows "Untitled" or auto-generated title

## File References
- Edit: `components/Header.tsx` (X button triggers draft save)
- Edit: `app/chat.tsx` (handle draft ID for resumption)
- Edit: `features/chat/hooks/useChatOrchestration.ts` (draft management)
- Edit: `app/(tabs)/entries.tsx` (show drafts section)
- Use: `services/journalStorage.ts`
- Use: `hooks/useJournalEntries.ts`

## Subtasks
1. [ ] Update X button handler to check for unsaved content
2. [ ] Save as draft before navigating away
3. [ ] Add draft filtering to useJournalEntries hook
4. [ ] Display drafts section in entries screen (or header tab)
5. [ ] Pass draftId to chat route when resuming
6. [ ] Load draft messages when chat opens with draftId
7. [ ] Update draft when content changes (debounced auto-save)
8. [ ] Convert draft to completed on Finish Entry
9. [ ] Style draft entries differently (e.g., "Untitled" card at top)

## Draft Detection Logic
```typescript
function hasDraftContent(messages: Message[]): boolean {
  return messages.some(m => m.role === 'user');
}
```

## Navigation for Draft Resume
```typescript
// From entries screen
router.push({ pathname: '/chat', params: { draftId: entry.id } });

// In chat screen
const { draftId } = useLocalSearchParams();
useEffect(() => {
  if (draftId) {
    loadDraftMessages(draftId);
  }
}, [draftId]);
```

## Drafts Section Design (matching journal-history.html)
```tsx
// At top of entries list
<View className="bg-surface-light dark:bg-surface-dark rounded-xl border border-divider-light dark:border-divider-dark p-4 shadow-soft">
  <h3 className="font-semibold text-lg">Untitled</h3>
  <p className="text-sm text-subtext-light">Draft • Started 2 hours ago</p>
</View>
```

## Verification
**Manual:**
1. Start new chat, type messages
2. Press X (not Finish Entry)
3. Check draft appears in history/drafts section
4. Tap draft → chat resumes with previous messages
5. Press Finish Entry → draft becomes completed entry
6. Close empty chat → no draft saved

**Unit Tests:**
```bash
npm test -- --testPathPattern="draft|journalStorage" --runInBand
```

## Notes
- Consider auto-save on interval (every 30s) for long sessions
- Drafts should update timestamp when resumed
- Clear draft from storage after finishing
