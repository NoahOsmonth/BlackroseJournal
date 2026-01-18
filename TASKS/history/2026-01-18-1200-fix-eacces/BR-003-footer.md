# BR-003 - Implement footer controls and action buttons

Problem
- The footer controls (icon row + two action buttons + home indicator) are not yet implemented in React Native.

Impact
- The UI will feel incomplete and not match the HTML reference.

Proposed fix
- Implement FooterActions component that matches the HTML:
  - Row with mic + call icons (left)
  - Volume-off icon (right)
  - Row with 2 equal-width buttons: Suggest / Finish entry
  - Bottom home-indicator bar
- Ensure safe-area spacing so it looks correct on modern phones.

Acceptance criteria
- Layout matches HTML:
  - Icon sizes and spacing are close to reference
  - Buttons are pill-ish with border, shadow, and press feedback
- Safe area is respected (no overlap with gesture bar / system UI).

References
- Visual spec: chatjournal.html

Subtasks
- Use Pressable for icons and buttons.
- Add pressed styles (e.g., opacity or background change) and active scale effect (where appropriate).
- Add hitSlop for small icon buttons.

Verification
- Manual smoke:
  - On iOS/Android, verify footer is always visible and not clipped
  - Verify buttons press states are visible
