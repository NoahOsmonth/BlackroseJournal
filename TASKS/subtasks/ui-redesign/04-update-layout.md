# 04. Update Main Layout and Background

meta:
  id: ui-redesign-04
  feature: ui-redesign
  priority: P2
  depends_on: [ui-redesign-03]
  tags: [implementation, layout]

status: complete
completed: 2026-01-18T12:15:00Z

objective:
- Add texture/gradient background and refine main layout.

deliverables:
- Updated `app/index.tsx`.

steps:
- Install `expo-linear-gradient` (if needed) or use a subtle image background.
- Update `app/index.tsx` container to use the background.
- Ensure `Header` and `FooterActions` align with the new aesthetic.
- Adjust padding/margins for a "breathing room" feel.

tests:
- Manual: Verify overall look and feel.

acceptance_criteria:
- Background is not plain white/slate.
- Layout feels spacious and refined.

validation:
- Run app and review the main screen.
