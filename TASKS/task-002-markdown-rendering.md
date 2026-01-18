# Task 002: Markdown Rendering in React Native

## Problem
AI responses in the chat currently display as plain text. The AI may respond with markdown formatting (headers, bold, italic, lists, code blocks) that needs to render properly on mobile with appropriate sizing.

## Impact
- Better readability for AI responses
- Professional appearance for formatted content
- Improved UX for journaling reflections with structure

## Proposed Solution
1. Install `react-native-markdown-display` library
2. Create markdown style configuration matching app theme
3. Update `ChatMessage.tsx` to use markdown for AI responses
4. Ensure font sizes complement existing typography (Inter font family)

## Acceptance Criteria
- [ ] Install and configure react-native-markdown-display
- [ ] Markdown renders correctly for: headers (h1-h6), bold, italic, lists, code blocks, links
- [ ] Font sizes are proportional and complement existing app typography
- [ ] Markdown renders well in both light and dark mode
- [ ] ChatMessage component uses markdown rendering for AI responses
- [ ] User messages remain plain text (no markdown parsing)

## File References
- Edit: `components/ChatMessage.tsx`
- New: `constants/markdownStyles.ts`
- Reference: `constants/theme.ts`
- Reference: `tailwind.config.js`

## Subtasks
1. [ ] Install react-native-markdown-display
2. [ ] Create markdown style configuration in `constants/markdownStyles.ts`
3. [ ] Define light and dark mode styles for all markdown elements
4. [ ] Update ChatMessage to conditionally render markdown for AI messages
5. [ ] Test markdown rendering with sample content
6. [ ] Verify font sizes match app typography

## Verification
**Unit Tests:**
```bash
npm test -- --testPathPattern=ChatMessage --runInBand
```

**Manual:**
- Send message that triggers AI response with headers, lists, bold text
- Toggle dark mode and verify markdown remains readable
- Check code blocks have proper monospace font and background

## Markdown Size Guidelines
Based on example-design and current theme:
- Body text: 16px (base)
- H1: 28px (1.75rem)
- H2: 24px (1.5rem)
- H3: 20px (1.25rem)
- H4: 18px (1.125rem)
- H5: 16px (1rem, bold)
- H6: 14px (0.875rem, bold)
- Code: 14px monospace
- List items: 16px with proper indentation

## Dependencies
- react-native-markdown-display

## Notes
- Keep markdownStyles.ts under 100 lines
- ChatMessage.tsx must stay under 200 lines after changes
