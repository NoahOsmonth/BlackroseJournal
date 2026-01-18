# Task 005: Navigation Flow (FAB, X, Tabs)

## Problem
The app needs proper navigation between the journal history and chat screens. The FAB button should create a new chat, X button should close the chat, and bottom tabs should navigate between main sections.

## Impact
- Users can navigate the app naturally
- New journal entries can be started from history
- Chat sessions can be exited cleanly

## Proposed Solution
1. Convert to Expo Router tabs layout
2. Chat screen becomes a modal or separate route
3. FAB press navigates to new chat
4. X button press returns to history
5. Tab navigation for main sections

## Acceptance Criteria
- [ ] Pressing FAB (edit button) on history screen navigates to new chat
- [ ] New chat starts with empty message history
- [ ] Pressing X button on chat header returns to journal history
- [ ] Tab navigation works for Today, Explore, Entries, Settings
- [ ] Navigation state is properly managed
- [ ] Correct tab is highlighted based on current screen

## File References
- Edit: `app/_layout.tsx` (tab navigation setup)
- New: `app/(tabs)/_layout.tsx` (tabs layout)
- New: `app/(tabs)/today.tsx` (placeholder)
- New: `app/(tabs)/explore.tsx` (placeholder)
- Move: `app/index.tsx` → `app/chat.tsx` (chat as separate route)
- Edit: `components/journal/FAB.tsx` (navigation action)
- Edit: `components/Header.tsx` (X button navigation)

## Subtasks
1. [ ] Create tabs layout with Expo Router
2. [ ] Create placeholder screens for Today, Explore, Settings
3. [ ] Move chat screen to separate route (not in tabs)
4. [ ] Update FAB to navigate to chat with router.push
5. [ ] Update Header X button to navigate back to entries
6. [ ] Ensure new chat clears previous messages
7. [ ] Test navigation flow end-to-end

## Navigation Structure
```
app/
├── _layout.tsx          # Root layout (ThemeProvider, fonts)
├── chat.tsx             # Chat screen (modal or push)
└── (tabs)/
    ├── _layout.tsx      # Tab navigator
    ├── today.tsx        # Today tab (placeholder)
    ├── explore.tsx      # Explore tab (placeholder)
    ├── entries.tsx      # Journal History (main)
    └── settings.tsx     # Settings tab (placeholder)
```

## Verification
**Manual:**
1. Open app → lands on entries tab
2. Tap FAB → navigates to chat with empty state
3. Type message and get AI response
4. Tap X → returns to entries
5. Tap FAB again → new empty chat (not previous)
6. Navigate between tabs → correct tab highlighted

**Unit Tests:**
```bash
npm test -- --testPathPattern=navigation --runInBand
```

## Notes
- Use `router.push('/chat')` for FAB
- Use `router.back()` or `router.replace('/(tabs)/entries')` for X
- Consider passing entry ID for resuming drafts later
