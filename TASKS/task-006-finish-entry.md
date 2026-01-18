# Task 006: Save and Finish Journal Entry

## Problem
When users complete a journaling session, they need to save it as a finished entry. The entry should get a title, mood emoji, and appear in the journal history.

## Impact
- Journal entries are preserved for future reference
- Users get a sense of completion from their journaling
- History screen populates with real entries

## Proposed Solution
1. Add `onFinishEntry` handler to FooterActions
2. Generate title from conversation (first user message or AI-generated)
3. Extract or infer mood emoji from conversation content
4. Save entry as "completed" via storage service
5. Navigate back to history screen

## Acceptance Criteria
- [ ] Pressing 'Finish Entry' saves the chat to journal history
- [ ] Entry is marked as completed (not draft)
- [ ] Title is generated from conversation content
- [ ] Mood emoji is extracted or inferred from conversation
- [ ] Entry appears in journal history with correct date grouping
- [ ] After finishing, user is navigated back to history screen
- [ ] Empty chats cannot be finished (button disabled or shows message)

## File References
- Edit: `components/FooterActions.tsx`
- Edit: `features/chat/hooks/useChatOrchestration.ts`
- Edit: `app/chat.tsx`
- Use: `services/journalStorage.ts`
- Use: `hooks/useJournalEntries.ts`

## Subtasks
1. [ ] Add onFinishEntry prop to FooterActions
2. [ ] Create title generation logic (first user message, truncated)
3. [ ] Create emoji inference logic (keywords → emoji map)
4. [ ] Connect Finish Entry button to save entry as completed
5. [ ] Navigate to entries screen after saving
6. [ ] Disable button when chat is empty
7. [ ] Add loading state during save

## Title Generation Logic
```typescript
function generateTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return 'Untitled';
  
  // Take first ~50 chars, end at word boundary
  const text = firstUserMessage.content;
  if (text.length <= 50) return text;
  return text.substring(0, 50).replace(/\s+\S*$/, '') + '...';
}
```

## Emoji Inference Logic
```typescript
const moodKeywords: Record<string, string> = {
  'happy|joy|excited|great': '🥳',
  'sad|down|depressed': '😢',
  'stressed|overwhelmed|anxious': '😰',
  'angry|frustrated|mad': '😤',
  'tired|exhausted|sleepy': '😴',
  'peaceful|calm|relaxed': '😌',
  'confused|lost|uncertain': '🤔',
  // ... more mappings
};
```

## Verification
**Manual:**
1. Start new chat, have conversation
2. Press Finish Entry
3. Check entry appears in history with title and emoji
4. Verify entry date grouping is correct
5. Try to finish empty chat (should be prevented)

**Unit Tests:**
```bash
npm test -- --testPathPattern="finishEntry|journalStorage" --runInBand
```

## Notes
- Consider asking AI to generate title/emoji (enhancement)
- Keep finish flow fast (don't block on analytics)
- Show brief success feedback (toast or animation)
