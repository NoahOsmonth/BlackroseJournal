# BR-004 - Add practical responsiveness and light/dark theming

Problem
- The HTML uses Tailwind with light/dark classes and a centered max-width container. React Native needs an equivalent theming + responsive layout strategy.

Impact
- Without theming, the UI will not match the HTML in dark mode.
- Without responsiveness, the UI will look awkward on tablets and Expo web.

Proposed fix
- Implement theme tokens that mirror the HTML colors.
- Use system color scheme (prefers-color-scheme equivalent) to choose theme.
- Implement a centered container with maxWidth on large screens, while keeping full width on phones.

Acceptance criteria
- Light and dark mode render correctly (background, text, borders, buttons).
- Layout scales well:
  - Phone: full width
  - Tablet/Web: centered with maxWidth (similar to max-w-md) and side borders
- Inter font used or gracefully falls back without crashing.

References
- Visual spec: chatjournal.html

Subtasks
- Choose theme implementation:
  - Simple: useColorScheme + token map
  - More structured: React context for theme
- Add responsive maxWidth logic based on window width.
- Verify scroll area and footer remain stable across sizes.

Verification
- Unit tests (if feasible):
  - Render in light/dark scheme mocks and snapshot
- Manual:
  - Toggle OS theme (or use Expo dev menu) and compare colors to the HTML intent
  - Resize web viewport and confirm centered maxWidth behavior
