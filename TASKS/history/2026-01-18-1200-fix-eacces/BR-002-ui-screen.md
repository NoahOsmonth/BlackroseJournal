# BR-002 - Recreate chatjournal.html UI as a React Native screen

Problem
- The HTML mock needs to be converted into React Native components.

Impact
- Without the RN screen, the app cannot display the intended chat journal design.

Proposed fix
- Implement a single screen (e.g., ChatJournalScreen) that visually matches chatjournal.html.
- Apply required text changes:
  - "Rosebud" -> "Blackrose"
  - Avatar letter "R" -> "B"
  - Remove the "Internal Family Systems" label entirely

Acceptance criteria
- Header matches the HTML structure and spacing:
  - Left pill: avatar circle + name + expand icon
  - Right area: "Drafts" label and close icon button
- "Internal Family Systems" label is not present anywhere.
- Chat content area uses a ScrollView with spacing similar to the HTML.
- AI messages use the blue color and font weight consistent with the HTML; user messages use darker text and bold.

References
- Visual spec: chatjournal.html

Subtasks
- Create components:
  - Header (Blackrose pill + Drafts + close)
  - MessageBlock (AI/User variants)
- Recreate the sample messages as static content in code.
- Match typography:
  - Font family: Inter
  - Font size ~15
  - Line height ~1.5
  - AI: semibold, blue
  - User: bold, dark

Verification
- Unit tests (preferred):
  - Render ChatJournalScreen
  - Expect to find text "Blackrose"
  - Expect NOT to find "Internal Family Systems"
- Manual:
  - Compare layout to chatjournal.html (spacing, colors, alignment)
