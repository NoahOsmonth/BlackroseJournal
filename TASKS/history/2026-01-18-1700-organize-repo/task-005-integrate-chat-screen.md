# Task 005: Integrate Inline Typing into Chat Screen
 
## Objective
Replace the FooterActions textbox with inline document-style typing in the chat area.
 
## Requirements
- Remove textbox from FooterActions
- Add InlineTypingInput at the end of chat messages
- Keep New Chat and Finish Entry buttons
- Auto-scroll to input when typing
- Focus input automatically after AI responds
 
## Implementation
1. Update `app/index.tsx` to use InlineTypingInput
2. Modify `components/FooterActions.tsx` to remove text input
3. Ensure proper keyboard handling
4. Add auto-focus after AI response
 
## Acceptance Criteria
- [ ] User types directly in chat flow
- [ ] Textbox removed from footer
- [ ] Buttons still work (New Chat, Finish Entry)
- [ ] Auto-scroll to input
- [ ] Auto-focus after AI responds
