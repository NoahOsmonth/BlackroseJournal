# Task 004: Journal History Screen (Design Match)

## Problem
The app needs a Journal History screen that displays past journal entries. The design must match `example-design/journal-history.html` exactly, including colors, spacing, typography, and component structure.

## Impact
- Users can view their journal history
- Creates the main navigation hub for the app
- Matches the professional design in the example

## Proposed Solution
1. Create new screen `app/(tabs)/entries.tsx`
2. Create reusable components for entry cards and week sections
3. Match exact colors from journal-history.html Tailwind config
4. Implement light/dark mode following the HTML design

## Acceptance Criteria
- [ ] New JournalHistory screen created with navigation
- [ ] Design matches journal-history.html exactly (colors, spacing, typography)
- [ ] Entries grouped by week with date headers (e.g., "May 25th – May 31st, 2025")
- [ ] Entry cards show day abbreviation (Mon, Tue, etc.), emoji, and title
- [ ] "Weekly Report" special card style is implemented
- [ ] FAB (floating action button) with pink edit icon is present and positioned correctly
- [ ] Bottom navigation bar with Today, Explore, Entries, Settings tabs
- [ ] Light and dark mode supported matching the HTML design

## Design Specifications (from journal-history.html)

### Colors
```javascript
primary: "#E91E63"          // Pink FAB
primary-dark: "#C2185B"
background-light: "#F5F5F7"
background-dark: "#121212"
surface-light: "#FFFFFF"
surface-dark: "#1E1E1E"
text-light: "#1C1C1E"
text-dark: "#E5E5E7"
subtext-light: "#8E8E93"
subtext-dark: "#8E8E93"
divider-light: "#E5E5EA"
divider-dark: "#2C2C2E"
```

### Layout Structure
1. **Header**: Sticky with gift icon (left), "Journal" title (center), menu icon (right)
2. **Content**: Scrollable with week sections
3. **Week Section**: Date range header + entry cards
4. **Entry Card**: Day abbreviation + emoji + title in a row
5. **FAB**: Centered bottom, pink with edit icon, floating above nav
6. **Bottom Nav**: 4 tabs with icons and labels

### Typography
- Header title: `text-lg font-bold tracking-tight`
- Week header: `text-xs font-semibold uppercase tracking-wide`
- Entry day: `text-xs font-bold uppercase`
- Entry title: `font-medium`
- Nav labels: `text-[10px] font-medium`

## File References
- New: `app/(tabs)/entries.tsx`
- New: `components/journal/EntryCard.tsx`
- New: `components/journal/WeekSection.tsx`
- New: `components/journal/JournalHeader.tsx`
- New: `components/journal/BottomNav.tsx`
- New: `components/journal/FAB.tsx`
- Edit: `tailwind.config.js` (add new colors)
- Edit: `app/_layout.tsx` (add tab navigation)

## Subtasks
1. [ ] Add design colors to tailwind.config.js
2. [ ] Create JournalHeader component
3. [ ] Create EntryCard component
4. [ ] Create WeekSection component
5. [ ] Create BottomNav component
6. [ ] Create FAB component
7. [ ] Create entries.tsx screen composing all components
8. [ ] Set up tab navigation in _layout.tsx
9. [ ] Test light and dark mode
10. [ ] Verify exact match with HTML design

## Verification
**Manual:**
- Visual comparison with journal-history.html
- Toggle dark mode via clicking "Journal" title
- Scroll through entries
- FAB position and styling matches

**Unit Tests:**
```bash
npm test -- --testPathPattern=entries --runInBand
```

## Notes
- Keep each component under 100 lines
- Use composition for complex layouts
- Follow AGENTS.md file size limits
