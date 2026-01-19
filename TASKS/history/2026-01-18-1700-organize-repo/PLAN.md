## Subtask Plan
feature: inline-document-typing
objective: Replace textbox with document-style inline typing. User types directly in chat flow like Word/Google Docs. Enter sends message.
 
context_applied:
- Existing Expo Router, NativeWind, Reanimated stack
- Current AI service at services/ai.ts
- Serene/Refined aesthetic (organic colors, subtle motion)
 
tasks:
- seq: 03, filename: task-003-inline-typing-component.md, title: Create InlineTypingInput Component
- seq: 04, filename: task-004-update-ai-settings.md, title: Update AI Settings (temp=1.0, max_tokens=16k)
- seq: 05, filename: task-005-integrate-chat-screen.md, title: Integrate Inline Typing into Chat Screen
- seq: 06, filename: task-006-create-tests.md, title: Create Tests for Inline Typing
 
dependencies:
- 04 -> none (independent)
- 03 -> none (independent)
- 05 -> 03, 04 (needs component and updated AI)
- 06 -> 05 (needs integration complete)
 
exit_criteria:
- User can type directly in chat area (no separate textbox)
- Enter key sends message
- AI uses temperature=1.0 and max_tokens=16384
- Smooth cursor/typing animations
- Tests pass for inline typing functionality
- App builds without errors
