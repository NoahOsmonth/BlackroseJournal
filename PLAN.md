# Journal App Feature Plan: Markdown, AI Prompt, History & Drafts

## Goal
Enhance the journaling app with:
1. Markdown rendering for AI responses (properly sized for mobile)
2. Therapist-style AI system prompt (reflective, not advice-giving)
3. Journal History screen matching the example design exactly
4. Navigation flow with FAB for new chat, X to close
5. Finish Entry saves to history, X saves as draft
6. Draft management and resumption

## References
- Example design: `example-design/journal-history.html`
- Current chat screen: `app/index.tsx`
- AI service: `services/ai.ts`
- AGENTS.md (repo rules - 200-500 line files, SoC, tests required)

## Stack
- React Native with Expo Router
- NativeWind/TailwindCSS for styling
- TypeScript
- Jest for testing
- AsyncStorage for persistence (to be added)

## Architecture Decisions
1. **Markdown**: Use `react-native-markdown-display` for flexible styling
2. **Storage**: Use `@react-native-async-storage/async-storage` for persistence
3. **Navigation**: Use Expo Router tabs for main navigation
4. **State**: Keep journal entries in a context/hook for shared access

## Workflow
1. Install dependencies (markdown lib, async-storage)
2. Create storage service first (foundation for other features)
3. Add therapist system prompt to AI service
4. Integrate markdown rendering in ChatMessage
5. Build Journal History screen matching HTML design
6. Implement navigation flow (FAB, X button, tabs)
7. Add Finish Entry functionality
8. Add Draft auto-save on X close
9. Add tests for each feature

## Quality Gate
```bash
npm run lint
npm test -- --runInBand
npm run check:design
```

## File Size Compliance
- Keep all new components < 200 lines
- Split large components into subcomponents
- Hooks for business logic, components for UI only

## Testing Expectations
- Storage service: unit tests for CRUD operations
- Navigation: test that buttons trigger correct navigation
- Entry saving: test draft vs completed flow
- Markdown: visual verification (manual) + snapshot tests

## Definition of Done
- All features match acceptance criteria
- Design matches journal-history.html exactly
- Tests pass for new features
- No design/UI file exceeds 500 lines
- Lint passes with no new errors
