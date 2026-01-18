# 03. Refactor ChatMessage Component

meta:
  id: ui-redesign-03
  feature: ui-redesign
  priority: P2
  depends_on: [ui-redesign-02]
  tags: [implementation, ui]

status: complete
completed: 2026-01-18T12:10:00Z

objective:
- Style chat bubbles to be organic and add entry animations.

deliverables:
- Updated `components/ChatMessage.tsx`.

steps:
- Import `Animated, { FadeInDown }` from `react-native-reanimated`.
- Wrap the message container in `Animated.View` with `entering={FadeInDown}`.
- Update styles:
  - Use new colors (Sage for AI, Muted/White for User).
  - Add rounded corners with organic feel (e.g., `rounded-2xl`).
  - Add subtle shadow/elevation.
- Update text styles to use new fonts.

tests:
- Unit: Component renders with props.
- Manual: Verify animation and styling in simulator.

acceptance_criteria:
- Messages animate in.
- Bubbles look organic and use the new palette.

validation:
- Run app and send/receive messages.
