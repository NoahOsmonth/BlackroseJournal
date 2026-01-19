# Blackrose Journal UI (Expo React Native) - Plan

Goal
- Convert the static HTML mock (chatjournal.html) into a React Native UI built with the latest Expo framework.
- Design only: no backend, no data persistence required.
- Match the UI as closely as practical: layout, spacing, typography, colors, and interactions.

Primary reference
- chatjournal.html (treat as the source-of-truth visual spec)

Key UI requirements (must-haves)
- Replace "Rosebud" with "Blackrose".
- Update avatar letter from "R" to "B" and make the avatar feel "black" (per name).
- Remove the "Internal Family Systems" label entirely.
- Recreate:
  - Outer centered phone frame look (max width on wide screens, border sides)
  - Header pill (avatar + name + expand icon), Drafts title, close button
  - Chat message typography (AI blue bold-ish, user darker bold)
  - Footer action row (mic/call, volume) and two large buttons
  - Safe-area friendly bottom spacing and home-indicator bar

Implementation approach
- Create an Expo app (TypeScript recommended).
- Build a single screen first (e.g., ChatJournalScreen) with static message content matching the HTML.
- Extract small presentational components as needed:
  - Header
  - MessageBlock (AI vs User)
  - FooterActions
- Theming:
  - Use system color scheme (light/dark) and map colors from HTML.
  - Ensure background and border colors match the HTML intent.
- Responsiveness:
  - Use SafeAreaView.
  - Use useWindowDimensions to apply a maxWidth on tablets/web while keeping full width on phones.

Quality gate (run once the Expo project exists)
- Prefer the repo-provided scripts after initialization:
  - npm run lint (if present)
  - npm run test (if present)
  - npm run typecheck (if present)
- Smoke checks:
  - npx expo start (manual: verify screen renders and scroll works)
  - npx expo start --web (if web is enabled)

Testing expectations
- Add at least one basic UI test if feasible (React Native Testing Library / jest-expo):
  - Asserts header contains "Blackrose"
  - Asserts "Internal Family Systems" is NOT present
- If automated tests are not feasible in the chosen setup, document the limitation and leave passes=false for affected stories.

Notes for Windows
- Ensure all commands and scripts work in PowerShell.
- Avoid POSIX-only shell assumptions.
