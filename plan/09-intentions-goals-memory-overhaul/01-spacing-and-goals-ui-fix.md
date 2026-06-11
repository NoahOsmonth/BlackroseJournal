# Phase A — Today's Goals UI fix + repo-wide spacing root cause

## Background: why the buttons are "magkakadikit" (stuck together)

The repo uses **NativeWind 4.2.1** (`package.json`). NativeWind v4 does **not** implement Tailwind's `space-y-*` / `space-x-*` utilities on native platforms — they compile to CSS child-combinator selectors (`> * + *`) which React Native cannot express. The classes are **silently dropped**: no error, no warning, **zero spacing rendered** on iOS/Android. (They may still appear to work in the web build, which hides the bug during web dev.)

So `app/goals.tsx` rendering goal rows inside `<View className="space-y-2">` produces rows with **0px** between them on a phone. Same story in 17 files. The fix is mechanical: **on the flex container, replace `space-y-N` → `gap-N` and `space-x-N` → `gap-N`** (RN ≥ 0.71 supports flexbox `gap`; default `View` is a column flex container, so `gap` applies vertically without extra classes; on `flex-row` it applies horizontally).

Two secondary issues compound it: the GoalsSection action row uses a minimal `gap-3`, and the quick-add modal uses `gap-2` where the app's button-row standard is `gap-3`.

---

## Task A1 — Fix `components/today/GoalsSection.tsx`

File: `/home/sarino/Desktop/BlackroseJournal/components/today/GoalsSection.tsx`

**Edit 1 — outer container (line ~31).** `space-y-3` does nothing on native; the section title, card, and button row currently touch each other.

FIND:
```tsx
        <View className="space-y-3">
```
REPLACE WITH:
```tsx
        <View className="gap-3">
```

**Edit 2 — action button row (line ~48).** Widen the gap between "Add goal" and "Manage" from 12px to 16px so the two flex-1 buttons read as separate controls.

FIND:
```tsx
            <View className="flex-row gap-3">
```
REPLACE WITH:
```tsx
            <View className="flex-row gap-4">
```

(There is exactly one occurrence of each FIND string in this file.)

---

## Task A2 — Fix `app/goals.tsx` (Goals & Habits screen)

File: `/home/sarino/Desktop/BlackroseJournal/app/goals.tsx`

This screen has **three** broken spacing containers:

**Edit 1 — sections wrapper (line ~43):**

FIND:
```tsx
                <View className="space-y-6 pb-10">
```
REPLACE WITH:
```tsx
                <View className="gap-6 pb-10">
```

**Edit 2 & 3 — the goal list and habit list (lines ~48 and ~77).** Both use the identical class string, so use replace-all semantics (2 occurrences expected):

FIND (each occurrence):
```tsx
                        <View className="space-y-2">
```
REPLACE WITH (each occurrence):
```tsx
                        <View className="gap-3">
```

Note the deliberate upgrade from 8px to 12px: 8px was below the app baseline even when it worked (web). 12px (`gap-3`) matches the rest of the app's grouped-content rhythm.

> If the exact indentation differs, match on `className="space-y-2"` within this file — there must be exactly 2 occurrences, both wrapping `.map(...)` lists of `Pressable` rows.

---

## Task A3 — Fix `components/goals/GoalQuickAddModal.tsx`

File: `/home/sarino/Desktop/BlackroseJournal/components/goals/GoalQuickAddModal.tsx`

**Edit 1 — Goal/Habit type toggle row (line ~30):**

FIND:
```tsx
            <View className="flex-row gap-2 mb-4">
```
REPLACE WITH:
```tsx
            <View className="flex-row gap-3 mb-4">
```

The Cancel/Save row in the same file already uses `gap-3` — leave it.

---

## Task A4 — Repo-wide sweep of dead `space-y-*` / `space-x-*` classes

These files currently contain the dead utilities (verified by grep on 2026-06-11):

```
app/saved-insights.tsx
app/goals.tsx                                   (handled in A2)
app/drafts.tsx
app/chat.tsx
app/intentions/select.tsx
components/intentions/IntentionChatBody.tsx     (rewritten in Phase B — skip here)
components/personas/PersonaSettingsSheet.tsx
components/personas/NewPersonaCard.tsx
components/intentions/IntentionChatHeader.tsx
components/intentions/IntentionChatMessage.tsx
components/today/EntryInsightsCard.tsx
components/today/MyIntentionsSection.tsx
components/today/GoalsSection.tsx               (handled in A1)
components/personas/VoicePickerModal.tsx
components/personas/ModelPickerModal.tsx
components/Header.tsx
components/today/HappinessRecipeSection.tsx
```

Procedure for **each remaining file** (everything except `goals.tsx`, `GoalsSection.tsx`, `IntentionChatBody.tsx`):

1. Re-list current offenders first (source of truth, in case the list drifted):
   ```bash
   grep -rn "space-y-\|space-x-" app components --include="*.tsx"
   ```
2. For every match, apply the mechanical conversion **on the same element**:
   - `space-y-N` → `gap-N`
   - `space-x-N` → `gap-N`
   - If the element already has a `gap-*` class, keep the **larger** of the two values and remove the `space-*` class.
   - `space-x-*` only has an effect on `flex-row` containers; if the element with `space-x-N` is NOT `flex-row`, it was double-dead — still convert to `gap-N` (harmless) and do not add `flex-row`.
   - Do **not** change any other classes, props, or structure.
3. Reversed variants (`space-y-reverse` etc.) do not exist in this repo; if you encounter one, stop and flag it in `PROGRESS.md` instead of guessing.

**Expected visual effect:** spacing that designers wrote but that never rendered on native will now render. This is intended. Do not "compensate" by shrinking values.

---

## Task A5 — Guard test so the bug can never return

Create `/home/sarino/Desktop/BlackroseJournal/__tests__/no-space-utilities.test.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';

const ROOTS = ['app', 'components'];
const PATTERN = /\bspace-[xy]-(?:\d+|px|reverse)\b/;

function collectTsxFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectTsxFiles(full);
        return entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') ? [full] : [];
    });
}

describe('NativeWind v4 dead utilities', () => {
    it('bans space-y-*/space-x-* (silently dropped on native; use gap-* on the flex container)', () => {
        const offenders: string[] = [];
        ROOTS.forEach((root) => {
            const rootPath = path.join(process.cwd(), root);
            if (!fs.existsSync(rootPath)) return;
            collectTsxFiles(rootPath).forEach((file) => {
                const content = fs.readFileSync(file, 'utf8');
                if (PATTERN.test(content)) {
                    offenders.push(path.relative(process.cwd(), file));
                }
            });
        });
        expect(offenders).toEqual([]);
    });
});
```

Note: this test will fail until Phase B rewrites `components/intentions/IntentionChatBody.tsx` (it contains `space-x-2`/`space-y-4`). Two options, pick exactly one:
- **Preferred:** do Task A5 last within Phase A, and convert `IntentionChatBody.tsx`'s two occurrences (`space-x-2` → `gap-2` on line ~67, `space-y-4` → `gap-4` on line ~76) as part of A4 after all — Phase B replaces the whole file anyway, so converting now is safe and keeps the guard green between phases.
- Or temporarily exclude that one path in the test and remove the exclusion in Phase B. **Do not ship the exclusion past Phase B.**

Take the preferred option unless something blocks it.

---

## Phase A verification

```bash
npx tsc --noEmit
npm run lint
npm run check:design
npm test -- --testPathPattern="no-space-utilities"
npm test
grep -rn "space-y-\|space-x-" app components --include="*.tsx"   # must output nothing
```

Also check no test snapshots referenced the old class strings:
```bash
grep -rn "space-y-\|space-x-" __tests__ --include="*.snap" || true
```
If snapshots match, re-run the corresponding suites with `npm test -- -u` **only** for snapshot diffs that are purely the class-string change.

Update `PROGRESS.md`:
- Root cause documented (NativeWind v4 drops `space-*`), files converted, guard test added.
