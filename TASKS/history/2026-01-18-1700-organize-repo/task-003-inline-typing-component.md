# Task 003: Create InlineTypingInput Component
 
## Objective
Create a document-style inline typing input component that renders as part of the chat flow (like typing in Word/Google Docs).
 
## Requirements
- Transparent/borderless TextInput that blends into chat flow
- User message bubble style while typing
- Blinking cursor animation
- Enter key sends message (Shift+Enter for newline on web)
- Smooth focus/blur transitions
- Placeholder text when empty
 
## Implementation
1. Create `components/InlineTypingInput.tsx`
2. Use TextInput with transparent background
3. Style to match user message bubble
4. Handle Enter key for sending
5. Add cursor animation with Reanimated
 
## Acceptance Criteria
- [ ] Component renders inline in chat flow
- [ ] No visible textbox border (document-like)
- [ ] Enter sends message
- [ ] Cursor blinks while focused
- [ ] Matches existing user message styling
