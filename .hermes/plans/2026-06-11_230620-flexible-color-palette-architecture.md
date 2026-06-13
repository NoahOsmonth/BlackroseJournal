# Flexible Color Palette Architecture — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Let users pick from multiple flexible color palettes in Settings, and independently customize (a) the body text shade, and (b) the AI and user chat message text colors. The whole app retints live. Architecture first — UI polish follows in a separate plan.

**Architecture (6 layers, strict ownership):**

1. **Types** — `types/theme/palette.ts` defines `ColorPalette`, `PaletteAccent`, `PaletteId` (palette-baked chat text colors) and `TextShade` (curated body-text shades).
2. **Registries** — `constants/theme/palettes.ts` owns preset palettes; `constants/theme/textShades.ts` owns the 4 curated text shades. Registries store **hex**; conversion to rgb triples happens in the provider.
3. **Tailwind/Theme** — accent + chat-text + body-text tokens in `tailwind.config.js` resolve to `rgb(var(--color-*-rgb) / <alpha-value>)`. Defaults live in `global.css` `:root` / `.dark` as space-separated rgb triples (`--color-primary-rgb: 255 159 10`). This is the **standard Tailwind v3+ alpha-capable CSS-var pattern** — confirmed by reading `node_modules/tailwindcss/lib/util/withAlphaVariable.js` and `parseColor.js`. Raw `var(--color-x)` breaks `bg-primary/10` and the 18+ other opacity usages in production code.
4. **Provider** — `components/theme/ThemeProvider.tsx` uses `vars()` from `nativewind` (re-exported from `react-native-css-interop`) to set CSS variables on a root `<View>`. This is the official Nativewind v4 API for runtime CSS-var injection — confirmed by reading `node_modules/react-native-css-interop/src/__tests__/vars.test.tsx` and the `vars()` implementation in `dist/runtime/native/api.js`. Web also writes to `document.documentElement` for reach outside the provider.
5. **Hooks + Storage** — extend `hooks/theme/useThemeSettings.ts` with `paletteId`/`setPaletteId` AND `textShadeId`/`setTextShadeId`; new `services/settings/paletteStorage.ts` and `services/settings/textShadeStorage.ts` each own their AsyncStorage key (serialized lock + safe parse, AGENTS.md rule 4); `services/settings/userSettingsRemote.ts` carries the whole record to Supabase.
6. **UI** — new `PalettePickerSection` (swatch grid) + `TextShadePickerSection` (4-curated-swatch row) + `ChatColorsPreview` (live preview of AI/user chat). All compose in `app/(tabs)/settings.tsx`; `app/_layout.tsx` wraps the app in `ThemeProvider`.

**Tech Stack:** React Native + NativeWind v4.2.1 (uses `react-native-css-interop@0.2.1` for runtime); AsyncStorage (existing pattern); Supabase `user_settings` table (new column); Jest + RNTL.

**Compatibility promise:** Light/dark/system mode behavior is unchanged. Components that already use `bg-primary`, `text-primary`, `text-ai-text`, `text-user-text` will reflect the new palette/shade automatically. `AGENTS.md` rules 1, 2, 3, 4, 6, 7 still apply — no `space-y-*`, dark variants on every `<Text>`, no skipping layers, serialized storage writes, files ≤ 500 lines, tests in the diff.

**Why constrained text shades, not free-form hex:** AGENTS.md rule 1 exists because bare `<Text>` is invisible in dark mode. Free-form font color picker would let users paint black-on-black. A 4-shade curated set (default / warm / cool / high-contrast) keeps every combination WCAG-AA against the mode's background while still feeling flexible.

---

## Current Context

- `tailwind.config.js:13-59` — flat list of ~30 hardcoded color tokens, no palette concept.
- `constants/theme.ts:23-90` — `Colors.light` / `Colors.dark` + several group objects (`TintColors`, `PersonaColors`, `ChatColors`, `MemoryLayerColors`, `TodayIconColors`).
- `hooks/theme/useThemeSettings.ts:6-7` — only `ThemePreference = 'light'|'dark'|'system'` and `EmojiStylePreference`. No palette or text shade.
- `hooks/theme/useThemeSettings.ts:45-58` — bare `AsyncStorage.getItem` + raw `setItem` (AGENTS.md rule 4 risk). New keys must be added with proper lock + safe parse.
- `services/settings/userSettingsRemote.ts:7-20` — `RemoteUserSettings` shape carries `theme` and `emoji_style` only.
- `supabase/migrations/202601240001_init.sql:117-122` — `user_settings` table has `theme text, emoji_style text, updated_at`. No `palette_id`, no `text_shade`.
- `components/settings/AppearanceSettingsSection.tsx:55-118` — radio-button grid; renders 2 sections (Theme, Emoji Style). This is where the new pickers compose.
- `__tests__/useThemeSettings.test.ts`, `__tests__/tailwind-config.test.ts`, `__tests__/dark-mode-contrast.test.ts` — guard tests to extend.
- `global.css` — currently empty (just `@tailwind` directives). Will host the `:root` and `.dark` CSS-var defaults.
- `app/_layout.tsx:36-37` — already calls `useThemeSettings()` and `useColorScheme()`. The new `ThemeProvider` wraps the existing root return.
- `app/(tabs)/settings.tsx:25-32` — already destructures `theme, setTheme, emojiStyle, setEmojiStyle` from the hook. New pickers add to this.
- Production usage counts that constrain the design:
  - `text-text-light` / `text-text-dark`: **52+** files in `app/` — must stay backwards-compatible (re-point tokens, don't rename classes).
  - `bg-primary/10`, `bg-primary/15`, `bg-primary/20`, `bg-primary/70`, `dark:bg-primary-dark/20`: **19+** usages — the rgb-pattern is required to preserve opacity.
  - `bg-surface-light` / `bg-surface-dark`: **41+** files — these stay hex (defer surface tinting).
  - `text-ai-text` / `text-user-text` / `text-user-text-dark`: 5 files — already used by chat components, will retint automatically.

## Assumptions

- Users pick ONE palette + ONE text shade at a time. Per-token free-form hex dial is out of scope for this plan (would be a follow-up).
- The palette only overrides *accent* and *chat-text* tokens. Background/surface/divider stay tied to light/dark mode so the contrast guarantees from AGENTS.md rule 1 hold.
- AI text and user text are baked into the palette for MVP (pick palette → coherent chat colors). A later "Advanced → Custom chat color" toggle could let users override the palette's chat defaults without breaking the registry shape.
- Web dark mode stays `class`-based (already configured in `tailwind.config.js:2`).
- Emoji style interaction: no change. Emoji style is independent.
- `bg-primary/10` opacity modifiers continue to work via the rgb-pattern (verified by reading Tailwind's `withAlphaVariable.js` — when a color value contains `var(--*)`, Tailwind cannot pre-compute alpha, so the value MUST be a color that Tailwind can parse; the `rgb(var(--x-rgb) / <alpha-value>)` form satisfies this).

## Open Questions (decide before Task 2)

1. **Palette set:** Default + Rose + Ocean + Forest + Midnight (5)? Recommend 5 — proves the registry pattern, keeps the picker grid at 5 columns.
2. **Default palette for new users:** "Default" (current orange) or match existing brand? Recommend keep current brand as Default so existing users see no change.
3. **Text shade set:** `default` (iOS gray), `warm` (sepia), `cool` (slate blue), `high-contrast` (pure B/W)? Recommend all 4.
4. **AI text customization depth:** For MVP, AI text comes from the palette. Do you also want a separate "AI text color" override sub-picker? Recommend deferring to a follow-up plan — palette-baked keeps the architecture clean and prevents chaos combos (rose palette + cyan AI text = weird).
5. **Per-palette text shade pairing:** Should some palettes force a different text shade (e.g. "Midnight" → "cool")? Recommend no — palette and text shade are independent choices. The user composes them.
6. **Surface tinting (deferred):** The original draft included `surfaceTintDark` per palette (so "Forest" could shift dark-mode surface to a forest-tinted dark). Removing it from MVP because `surface-dark` is hex in tailwind.config.js and used in 41+ files — re-pointing it to a CSS var would require touching every one to confirm contrast. Defer to a follow-up.

---

## Task 0: Recon (read-only, 5 min)

### Task 0.1: Read `global.css` and `app/_layout.tsx` + verify Nativewind API

**Objective:** Confirm the `vars()` API is exported from the `nativewind` package and matches the expected signature.

**Files:** Read `global.css`, `nativewind-env.d.ts`, `app/_layout.tsx`, `app/(tabs)/settings.tsx`.

**Verification steps (no edits):**
- `node_modules/nativewind/dist/index.d.ts` should re-export `vars` from `react-native-css-interop`. Confirm with:
  ```bash
  grep -E "vars|useUnstableNativeVariable" /home/sarino/Desktop/BlackroseJournal/node_modules/nativewind/dist/index.d.ts
  ```
  Expected: a line matching `...vars, useUnstableNativeVariable, ...`
- `node_modules/nativewind/package.json` version: `4.2.1` (already confirmed).
- `node_modules/react-native-css-interop/package.json` version: `0.2.1` (already confirmed).
- `node_modules/tailwindcss/package.json` version: `^3.4.19` — must be v3+ for the `<alpha-value>` pattern.
- Verify `global.css` is currently empty (just `@tailwind` directives).
- Verify `app/_layout.tsx:36-37` already calls `useThemeSettings()` and `useColorScheme()`.

**Verify:** No edits. Produce a 5-line summary (in chat) of findings before Task 1. If `vars` is NOT exported from `nativewind`, fall back to importing from `react-native-css-interop` directly.

---

## Task 1: Palette types (TDD, ~10 min)

### Task 1.1: Define the `ColorPalette` schema (with chat text fields)

**Files:**
- Create: `types/theme/palette.ts`
- Create: `__tests__/types/palette.test.ts`

**Step 1: Write failing test**

```ts
import type { ColorPalette, PaletteAccent, PaletteId } from '../../types/theme/palette';

describe('ColorPalette schema', () => {
    it('PaletteAccent requires all accent fields including chat text', () => {
        const a: PaletteAccent = {
            primary: '#FF9F0A',
            primaryDark: '#FF8C00',
            accentBlue: '#3B82F6',
            accentGreen: '#34C759',
            accentYellow: '#FFD60A',
            personaRose: '#E91E63',
            aiText: '#38BDF8',
            userText: '#7C2D12',
            userTextDark: '#FDBA74',
        };
        expect(a.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('PaletteId is a string literal union', () => {
        const id: PaletteId = 'default';
        expect(typeof id).toBe('string');
    });

    it('ColorPalette composes id + label + light + dark', () => {
        const p: ColorPalette = {
            id: 'default',
            label: 'Default',
            light: { primary: '#000', primaryDark: '#000', accentBlue: '#000', accentGreen: '#000', accentYellow: '#000', personaRose: '#000', aiText: '#000', userText: '#000', userTextDark: '#000' },
            dark:  { primary: '#fff', primaryDark: '#fff', accentBlue: '#fff', accentGreen: '#fff', accentYellow: '#fff', personaRose: '#fff', aiText: '#fff', userText: '#fff', userTextDark: '#fff' },
        };
        expect(p.id).toBe('default');
    });
});
```

**Step 2: Run test, expect failure**

```bash
npm test -- --testPathPattern="types/palette"
```

Expected: `Cannot find module '../../types/theme/palette'`.

**Step 3: Implement minimal types**

`types/theme/palette.ts`:
```ts
/**
 * Color palette schema — the unit of "look and feel" the user picks in Settings.
 *
 * A palette is a coherent set of colors that overrides *accent* and *chat-text* tokens
 * in tailwind.config.js (primary, primary-dark, accent-blue, accent-green, accent-yellow,
 * persona-rose, ai-text, user-text, user-text-dark). It does NOT touch
 * background/surface/divider — those remain driven by light/dark mode so contrast
 * guarantees hold (AGENTS.md §1).
 */
export type PaletteAccent = {
    /** Main accent / CTA / focus / active tab */
    readonly primary: string;
    /** Dark-mode primary variant (kept separate so dark-mode contrast can differ) */
    readonly primaryDark: string;
    /** AI text / links */
    readonly accentBlue: string;
    /** Success states */
    readonly accentGreen: string;
    /** Warning / streak flame */
    readonly accentYellow: string;
    /** Rosebud persona accent */
    readonly personaRose: string;
    /** AI chat message text color (light + dark variants) */
    readonly aiText: string;
    /** User chat message text color in light mode */
    readonly userText: string;
    /** User chat message text color in dark mode */
    readonly userTextDark: string;
};

export interface ColorPalette {
    /** Stable id, used as the storage key */
    readonly id: string;
    /** Display label (English) */
    readonly label: string;
    /** Optional 1-line description shown in the picker */
    readonly description?: string;
    /** Accent tokens used when mode resolves to 'light' */
    readonly light: PaletteAccent;
    /** Accent tokens used when mode resolves to 'dark' */
    readonly dark: PaletteAccent;
};

export type PaletteId = ColorPalette['id'];
```

**Step 4: Run test, expect pass**

```bash
npm test -- --testPathPattern="types/palette"
```

Expected: 3 passed.

**Step 5: Commit**

```bash
git add types/theme/palette.ts __tests__/types/palette.test.ts
git commit -m "feat(theme): add ColorPalette type schema with chat text fields"
```

### Task 1.2: Define the `TextShade` schema

**Files:**
- Create: `types/theme/textShade.ts`
- Create: `__tests__/types/textShade.test.ts`

**Step 1: Write failing test**

```ts
import type { TextShade, TextShadeId, TextShadeTone } from '../../types/theme/textShade';

describe('TextShade schema', () => {
    it('TextShadeTone is light + dark', () => {
        const t: TextShadeTone = { light: '#111111', dark: '#FFFFFF' };
        expect(t.light).toMatch(/^#/);
    });

    it('TextShade has id, label, description, tone', () => {
        const s: TextShade = {
            id: 'default',
            label: 'Default',
            description: 'iOS neutral gray',
            tone: { light: '#111827', dark: '#F9FAFB' },
        };
        expect(s.id).toBe('default');
    });

    it('TextShadeId is a string literal union', () => {
        const id: TextShadeId = 'default';
        expect(typeof id).toBe('string');
    });
});
```

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="types/textShade"
```

**Step 3: Implement**

`types/theme/textShade.ts`:
```ts
/**
 * Text shade — the body-text color tier. Curated (not free-form hex) so every
 * combination meets contrast against the mode's background (AGENTS.md §1).
 */
export type TextShadeId = 'default' | 'warm' | 'cool' | 'high-contrast';

export interface TextShadeTone {
    /** Body text color when mode resolves to 'light' */
    readonly light: string;
    /** Body text color when mode resolves to 'dark' */
    readonly dark: string;
}

export interface TextShade {
    /** Stable id, used as the storage key */
    readonly id: TextShadeId;
    /** Display label (English) */
    readonly label: string;
    /** Optional 1-line description shown in the picker */
    readonly description?: string;
    /** The actual tone values for light + dark */
    readonly tone: TextShadeTone;
}
```

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="types/textShade"
```

**Step 5: Commit**

```bash
git add types/theme/textShade.ts __tests__/types/textShade.test.ts
git commit -m "feat(theme): add TextShade type schema"
```

---

## Task 2: Registries (TDD, ~25 min)

### Task 2.1: Implement 5 preset palettes with chat text fields

**Files:**
- Create: `constants/theme/palettes.ts`
- Create: `__tests__/palettes-registry.test.ts`

**Step 1: Write failing test**

```ts
import { PALETTES, DEFAULT_PALETTE_ID, getPalette, isPaletteId } from '../../constants/theme/palettes';

describe('palette registry', () => {
    it('exports at least 4 preset palettes', () => {
        expect(Object.keys(PALETTES).length).toBeGreaterThanOrEqual(4);
    });

    it('DEFAULT_PALETTE_ID resolves to a registered palette', () => {
        expect(PALETTES[DEFAULT_PALETTE_ID]).toBeDefined();
    });

    it('every palette has all 9 accent fields in light AND dark', () => {
        const hex = /^#[0-9A-Fa-f]{6}$/;
        const keys = ['primary', 'primaryDark', 'accentBlue', 'accentGreen', 'accentYellow', 'personaRose', 'aiText', 'userText', 'userTextDark'] as const;
        for (const p of Object.values(PALETTES)) {
            for (const k of keys) {
                expect(p.light[k]).toMatch(hex);
                expect(p.dark[k]).toMatch(hex);
            }
        }
    });

    it('every palette has a unique id', () => {
        const ids = Object.values(PALETTES).map(p => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('isPaletteId narrows correctly', () => {
        expect(isPaletteId('default')).toBe(true);
        expect(isPaletteId('nope')).toBe(false);
    });

    it('getPalette returns undefined for unknown id', () => {
        expect(getPalette('nope')).toBeUndefined();
    });

    it('ai text and user text are distinct within each palette', () => {
        // Guard against a future bug where someone copies user text into ai text
        for (const p of Object.values(PALETTES)) {
            expect(p.light.aiText).not.toBe(p.light.userText);
            expect(p.dark.aiText).not.toBe(p.dark.userTextDark);
        }
    });
});
```

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="palettes-registry"
```

**Step 3: Implement registry**

`constants/theme/palettes.ts`:
```ts
import type { ColorPalette, PaletteId } from '@/types/theme/palette';

const palette = (
    id: string,
    label: string,
    description: string,
    light: ColorPalette['light'],
    dark: ColorPalette['dark'],
): ColorPalette => ({ id, label, description, light, dark });

export const PALETTES: Record<string, ColorPalette> = {
    default: palette(
        'default', 'Default', 'Warm orange accents on a clean iOS canvas.',
        { primary: '#FF9F0A', primaryDark: '#FF8C00', accentBlue: '#3B82F6', accentGreen: '#34C759', accentYellow: '#FFD60A', personaRose: '#E91E63', aiText: '#38BDF8', userText: '#7C2D12', userTextDark: '#FDBA74' },
        { primary: '#FFB340', primaryDark: '#FF8C00', accentBlue: '#38BDF8', accentGreen: '#32D74B', accentYellow: '#FFD60A', personaRose: '#E91E63', aiText: '#38BDF8', userText: '#FDBA74', userTextDark: '#FDBA74' },
    ),
    rose: palette(
        'rose', 'Rose', 'Soft pinks and magentas — for the romantics.',
        { primary: '#E11D48', primaryDark: '#BE123C', accentBlue: '#7C3AED', accentGreen: '#10B981', accentYellow: '#F59E0B', personaRose: '#F472B6', aiText: '#A78BFA', userText: '#9F1239', userTextDark: '#FECDD3' },
        { primary: '#FB7185', primaryDark: '#E11D48', accentBlue: '#A78BFA', accentGreen: '#34D399', accentYellow: '#FBBF24', personaRose: '#F472B6', aiText: '#C4B5FD', userText: '#FECDD3', userTextDark: '#FECDD3' },
    ),
    ocean: palette(
        'ocean', 'Ocean', 'Cool teals and deep blues — calm and focused.',
        { primary: '#0EA5E9', primaryDark: '#0284C7', accentBlue: '#3B82F6', accentGreen: '#14B8A6', accentYellow: '#FBBF24', personaRose: '#F472B6', aiText: '#0EA5E9', userText: '#0C4A6E', userTextDark: '#7DD3FC' },
        { primary: '#38BDF8', primaryDark: '#0EA5E9', accentBlue: '#60A5FA', accentGreen: '#2DD4BF', accentYellow: '#FDE68A', personaRose: '#F472B6', aiText: '#38BDF8', userText: '#7DD3FC', userTextDark: '#7DD3FC' },
    ),
    forest: palette(
        'forest', 'Forest', 'Greens and earth tones — grounded and steady.',
        { primary: '#15803D', primaryDark: '#166534', accentBlue: '#0EA5E9', accentGreen: '#22C55E', accentYellow: '#CA8A04', personaRose: '#E11D48', aiText: '#0F766E', userText: '#14532D', userTextDark: '#86EFAC' },
        { primary: '#34D399', primaryDark: '#15803D', accentBlue: '#38BDF8', accentGreen: '#4ADE80', accentYellow: '#FACC15', personaRose: '#FB7185', aiText: '#2DD4BF', userText: '#86EFAC', userTextDark: '#86EFAC' },
    ),
    midnight: palette(
        'midnight', 'Midnight', 'Indigo and violet — contemplative and dreamy.',
        { primary: '#6366F1', primaryDark: '#4F46E5', accentBlue: '#3B82F6', accentGreen: '#10B981', accentYellow: '#F59E0B', personaRose: '#EC4899', aiText: '#A78BFA', userText: '#312E81', userTextDark: '#C7D2FE' },
        { primary: '#818CF8', primaryDark: '#6366F1', accentBlue: '#60A5FA', accentGreen: '#34D399', accentYellow: '#FBBF24', personaRose: '#F472B6', aiText: '#A78BFA', userText: '#C7D2FE', userTextDark: '#C7D2FE' },
    ),
};

export const DEFAULT_PALETTE_ID: PaletteId = 'default';

export function isPaletteId(value: string | null | undefined): value is PaletteId {
    return typeof value === 'string' && value in PALETTES;
}

export function getPalette(id: string | null | undefined): ColorPalette | undefined {
    return isPaletteId(id) ? PALETTES[id] : undefined;
}
```

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="palettes-registry"
```

**Step 5: Commit**

```bash
git add constants/theme/palettes.ts __tests__/palettes-registry.test.ts
git commit -m "feat(theme): add palette registry with 5 presets and chat text fields"
```

### Task 2.2: Implement 4 curated text shades

**Files:**
- Create: `constants/theme/textShades.ts`
- Create: `__tests__/textShades-registry.test.ts`

**Step 1: Write failing test**

```ts
import { TEXT_SHADES, DEFAULT_TEXT_SHADE_ID, getTextShade, isTextShadeId } from '../../constants/theme/textShades';
import { TEXT_SHADE_IDS } from '../../types/theme/textShade';

describe('text shade registry', () => {
    it('contains exactly 4 curated shades', () => {
        expect(Object.keys(TEXT_SHADES)).toHaveLength(4);
    });

    it('TEXT_SHADE_IDS lists the same 4 ids', () => {
        expect(TEXT_SHADE_IDS).toEqual(['default', 'warm', 'cool', 'high-contrast']);
    });

    it('DEFAULT_TEXT_SHADE_ID is default', () => {
        expect(DEFAULT_TEXT_SHADE_ID).toBe('default');
    });

    it('every shade has light + dark tones in valid hex', () => {
        const hex = /^#[0-9A-Fa-f]{6}$/;
        for (const s of Object.values(TEXT_SHADES)) {
            expect(s.tone.light).toMatch(hex);
            expect(s.tone.dark).toMatch(hex);
        }
    });

    it('every shade is unique by id', () => {
        const ids = Object.values(TEXT_SHADES).map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('high-contrast dark is pure white (FFFFFF)', () => {
        expect(TEXT_SHADES['high-contrast'].tone.dark.toUpperCase()).toBe('#FFFFFF');
    });

    it('isTextShadeId narrows correctly', () => {
        expect(isTextShadeId('default')).toBe(true);
        expect(isTextShadeId('warm')).toBe(true);
        expect(isTextShadeId('nope')).toBe(false);
    });

    it('getTextShade returns undefined for unknown id', () => {
        expect(getTextShade('nope')).toBeUndefined();
    });
});
```

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="textShades-registry"
```

**Step 3: Implement**

First, add `TEXT_SHADE_IDS` to the type file. Modify `types/theme/textShade.ts` by appending:
```ts
export const TEXT_SHADE_IDS: readonly TextShadeId[] = ['default', 'warm', 'cool', 'high-contrast'] as const;
```

Then create `constants/theme/textShades.ts`:
```ts
import type { TextShade, TextShadeId } from '@/types/theme/textShade';
export { TEXT_SHADE_IDS } from '@/types/theme/textShade';

const shade = (id: TextShadeId, label: string, description: string, light: string, dark: string): TextShade => ({
    id, label, description, tone: { light, dark },
});

export const TEXT_SHADES: Record<TextShadeId, TextShade> = {
    'default':       shade('default',       'Default',       'iOS neutral gray — clean and modern.', '#111827', '#F9FAFB'),
    'warm':          shade('warm',          'Warm',          'Sepia tones — easier on the eyes at night.', '#3F2A1E', '#F5E6D3'),
    'cool':          shade('cool',          'Cool',          'Slate blue — pairs with Midnight/Ocean palettes.', '#0F1E2E', '#D6E4F0'),
    'high-contrast': shade('high-contrast', 'High Contrast', 'Pure black & white — maximum legibility.', '#000000', '#FFFFFF'),
};

export const DEFAULT_TEXT_SHADE_ID: TextShadeId = 'default';

export function isTextShadeId(value: string | null | undefined): value is TextShadeId {
    return typeof value === 'string' && value in TEXT_SHADES;
}

export function getTextShade(id: string | null | undefined): TextShade | undefined {
    return isTextShadeId(id) ? TEXT_SHADES[id] : undefined;
}
```

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="textShades-registry"
```

**Step 5: Commit**

```bash
git add types/theme/textShade.ts constants/theme/textShades.ts __tests__/textShades-registry.test.ts
git commit -m "feat(theme): add text shade registry with 4 curated shades"
```

---

## Task 3: Tailwind + global.css wiring (rgb/alpha pattern, ~15 min)

### Task 3.1: Re-point accent + chat-text + body-text tokens to CSS variables

**Why the rgb/alpha pattern is required:** Tailwind's `withAlphaVariable` (verified in `node_modules/tailwindcss/lib/util/withAlphaVariable.js`) calls `parseColor(color)`, which only recognizes hex, rgb(), hsl(), and color names. A raw `var(--color-primary)` value returns `null` from `parseColor`, so the opacity path is skipped — meaning `bg-primary/10` would silently render as solid `bg-primary`. The 19+ opacity-modifier usages in production code would all break. The standard Tailwind v3+ workaround is the `rgb(var(--x-rgb) / <alpha-value>)` form: Tailwind can parse the outer `rgb(...)` and substitutes `<alpha-value>` with the modifier.

**Files:**
- Modify: `tailwind.config.js` (lines 22-23, 24, 33-34, 38-39, 41, 43-45; replace with rgb-pattern tokens)
- Modify: `global.css` (add `:root` and `.dark` CSS variable defaults)

**Step 1: Write failing test (extend existing)**

`__tests__/tailwind-config.test.ts` — modify the "all color values are valid hex strings" test to only assert hex for non-themed tokens, and add a new test that themed tokens use the rgb pattern:

```ts
it('themed tokens use rgb(var(--*-rgb) / <alpha-value>) pattern', () => {
    const themedTokens = [
        'primary', 'primary-dark', 'persona-rose',
        'accent-blue', 'accent-green', 'accent-green-dark', 'accent-yellow',
        'ai-text', 'user-text', 'user-text-dark',
        'text-light', 'text-dark',
    ];
    for (const token of themedTokens) {
        expect(colors[token]).toBe(`rgb(var(--color-${token}-rgb) / <alpha-value>)`);
    }
});

it('non-themed tokens stay as hex (background, surface, divider, subtext)', () => {
    const stableHex = [
        'background-light', 'background-dark',
        'surface-light', 'surface-dark', 'card-dark',
        'divider-light', 'divider-dark',
        'text-main-light', 'text-main-dark',
        'text-primary-light', 'text-primary-dark',
        'text-secondary-light', 'text-secondary-dark',
        'subtext-light', 'subtext-dark',
        'secondary-dark',
    ];
    for (const token of stableHex) {
        expect(colors[token]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
});
```

Also update the existing test `"user text uses a warm darker tone distinct from AI text"` — those hex assertions are now wrong (the tokens are no longer hex). Replace with assertions on the palette registry:
```ts
// In __tests__/palettes-registry.test.ts (add this block):
describe('default palette preserves brand colors', () => {
    it('default palette user text matches the previous hardcoded values', () => {
        expect(PALETTES.default.light.userText).toBe('#7C2D12');
        expect(PALETTES.default.dark.userTextDark).toBe('#FDBA74');
    });
});
```

In `__tests__/tailwind-config.test.ts`, remove the now-obsolete assertions:
```ts
// REMOVE these:
//   expect(colors["user-text"]).toBe("#7C2D12");
//   expect(colors["user-text-dark"]).toBe("#FDBA74");
//   expect(colors["user-text"]).not.toBe(colors["ai-text"]);
```
The `it("ai text matches the intention chat reference cyan", ...)` test still passes (the token is rgb pattern, not '#38BDF8' anymore) — update:
```ts
// REMOVE: expect(colors["ai-text"]).toBe("#38BDF8");
```

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="tailwind-config"
```

**Step 3: Update `tailwind.config.js`**

Replace just the themed token values (the `primary`, `primary-dark`, `persona-rose`, `accent-*`, `ai-text`, `user-text*`, `text-light`, `text-dark` keys):
```js
'primary': 'rgb(var(--color-primary-rgb) / <alpha-value>)',
'primary-dark': 'rgb(var(--color-primary-dark-rgb) / <alpha-value>)',
'persona-rose': 'rgb(var(--color-persona-rose-rgb) / <alpha-value>)',
'accent-blue': 'rgb(var(--color-accent-blue-rgb) / <alpha-value>)',
'accent-green': 'rgb(var(--color-accent-green-rgb) / <alpha-value>)',
'accent-green-dark': 'rgb(var(--color-accent-green-dark-rgb) / <alpha-value>)',
'accent-yellow': 'rgb(var(--color-accent-yellow-rgb) / <alpha-value>)',
'ai-text': 'rgb(var(--color-ai-text-rgb) / <alpha-value>)',
'user-text': 'rgb(var(--color-user-text-rgb) / <alpha-value>)',
'user-text-dark': 'rgb(var(--color-user-text-dark-rgb) / <alpha-value>)',
'text-light': 'rgb(var(--color-text-shade-light-rgb) / <alpha-value>)',
'text-dark': 'rgb(var(--color-text-shade-dark-rgb) / <alpha-value>)',
```

Leave `text-main-light`, `text-main-dark`, `text-primary-light`, `text-primary-dark`, `text-secondary-light`, `text-secondary-dark`, `subtext-light`, `subtext-dark`, `background-light/dark`, `surface-light/dark`, `card-dark`, `divider-light/dark`, `secondary-dark` as hardcoded hex. The contrast guarantees in AGENTS.md rule 1 and the existing `dark-mode-contrast.test.ts` depend on these staying stable — text shade is a parallel "tier" the user can swap, not a token rewrite.

**Step 4: Add CSS variable defaults to `global.css`**

Replace the current `global.css` (3 lines) with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Accent tokens — overridden by ThemeProvider at runtime */
  --color-primary-rgb: 255 159 10;
  --color-primary-dark-rgb: 255 140 0;
  --color-persona-rose-rgb: 233 30 99;
  --color-accent-blue-rgb: 59 130 246;
  --color-accent-green-rgb: 52 199 89;
  --color-accent-green-dark-rgb: 50 215 75;
  --color-accent-yellow-rgb: 255 214 10;

  /* Chat text tokens */
  --color-ai-text-rgb: 56 189 248;
  --color-user-text-rgb: 124 45 18;
  --color-user-text-dark-rgb: 253 186 116;

  /* Body text shade */
  --color-text-shade-light-rgb: 17 24 39;
  --color-text-shade-dark-rgb: 249 250 251;
}

.dark {
  --color-primary-rgb: 255 179 64;
  --color-primary-dark-rgb: 255 140 0;
  --color-persona-rose-rgb: 233 30 99;
  --color-accent-blue-rgb: 56 189 248;
  --color-accent-green-rgb: 50 215 75;
  --color-accent-green-dark-rgb: 50 215 75;
  --color-accent-yellow-rgb: 255 214 10;
  --color-ai-text-rgb: 56 189 248;
  --color-user-text-rgb: 253 186 116;
  --color-user-text-dark-rgb: 253 186 116;
  --color-text-shade-light-rgb: 17 24 39;
  --color-text-shade-dark-rgb: 249 250 251;
}
```

These are the Default palette values as space-separated rgb triples. The `ThemeProvider` overrides them at runtime via `vars()` (Task 4). Before `ThemeProvider` mounts, the app looks identical to today.

**Step 5: Run, expect pass**

```bash
npm test -- --testPathPattern="tailwind-config"
npx tsc --noEmit
```

Expected: tests pass, TS clean.

**Step 6: Commit**

```bash
git add tailwind.config.js global.css __tests__/tailwind-config.test.ts __tests__/palettes-registry.test.ts
git commit -m "feat(theme): route themed tokens through rgb-pattern CSS variables"
```

---

## Task 4: ThemeProvider using `vars()` (~20 min)

### Task 4.1: Build the provider with palette × textShade

**Why `vars()`:** The official Nativewind v4 API for runtime CSS-var injection is `vars()` from `react-native-css-interop` (re-exported via `nativewind`). Verified by reading `node_modules/react-native-css-interop/src/__tests__/vars.test.tsx` and the implementation in `dist/runtime/native/api.js`. Raw `style={{ '--color-primary': '...' }}` does NOT work — the interop runtime ignores inline CSS custom properties unless they're passed through `vars()`.

**Files:**
- Create: `components/theme/ThemeProvider.tsx`
- Create: `__tests__/components/theme/ThemeProvider.test.tsx`
- Create: `__tests__/components/theme/accentToVars.test.ts` (pure helper test)

**Step 1: Write failing test for the pure helper first (no React)**

`__tests__/components/theme/accentToVars.test.ts`:
```ts
import { accentToVars, hexToRgbTriple, TYPE_KEYS_RGB } from '../../../components/theme/ThemeProvider';
import { PALETTES } from '../../../constants/theme/palettes';
import { TEXT_SHADES } from '../../../constants/theme/textShades';

describe('accentToVars', () => {
    it('hexToRgbTriple converts #FF9F0A to "255 159 10"', () => {
        expect(hexToRgbTriple('#FF9F0A')).toBe('255 159 10');
    });

    it('hexToRgbTriple is case-insensitive', () => {
        expect(hexToRgbTriple('#ff9f0a')).toBe('255 159 10');
    });

    it('hexToRgbTriple returns the input unchanged for malformed hex', () => {
        expect(hexToRgbTriple('not-a-color')).toBe('not-a-color');
    });

    it('accentToVars emits every RGB token in TYPE_KEYS_RGB', () => {
        const out = accentToVars(PALETTES.default.dark, TEXT_SHADES.default.tone.dark, 'dark');
        for (const key of TYPE_KEYS_RGB) {
            expect(out[`--color-${key}-rgb`]).toBeDefined();
            expect(out[`--color-${key}-rgb`]).toMatch(/^\d+ \d+ \d+$/);
        }
    });

    it('accentToVars picks dark accent when mode=dark', () => {
        const out = accentToVars(PALETTES.default.dark, TEXT_SHADES.default.tone.dark, 'dark');
        expect(out['--color-primary-rgb']).toBe('255 179 64');
    });

    it('accentToVars picks light accent when mode=light', () => {
        const out = accentToVars(PALETTES.default.light, TEXT_SHADES.default.tone.light, 'light');
        expect(out['--color-primary-rgb']).toBe('255 159 10');
    });

    it('accentToVars uses the supplied text shade tone, not the palette default', () => {
        const out = accentToVars(PALETTES.default.light, TEXT_SHADES.warm.tone.light, 'light');
        // warm light tone is #3F2A1E = 63 42 30
        expect(out['--color-text-shade-light-rgb']).toBe('63 42 30');
    });
});
```

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="accentToVars"
```

**Step 3: Implement the ThemeProvider with the pure helper extracted**

`components/theme/ThemeProvider.tsx`:
```tsx
import React, { useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { vars } from 'nativewind';

import { getPalette, DEFAULT_PALETTE_ID, type PaletteId } from '@/constants/theme/palettes';
import { getTextShade, DEFAULT_TEXT_SHADE_ID, type TextShadeId } from '@/constants/theme/textShades';
import type { ThemePreference } from '@/hooks/theme/useThemeSettings';
import type { PaletteAccent } from '@/types/theme/palette';

/**
 * List of every themed Tailwind token that has a `-rgb` CSS var.
 * Keep in sync with the tokens re-pointed in tailwind.config.js (Task 3.1).
 */
export const TYPE_KEYS_RGB = [
    'primary',
    'primary-dark',
    'persona-rose',
    'accent-blue',
    'accent-green',
    'accent-green-dark',
    'accent-yellow',
    'ai-text',
    'user-text',
    'user-text-dark',
    'text-shade-light',
    'text-shade-dark',
] as const;

/**
 * Convert "#RRGGBB" → "R G B" space-separated triple.
 * Pass-through for non-hex input so a bad value never crashes the app.
 */
export function hexToRgbTriple(hex: string): string {
    const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return hex;
    const r = parseInt(match[1], 16);
    const g = parseInt(match[2], 16);
    const b = parseInt(match[3], 16);
    return `${r} ${g} ${b}`;
}

interface AccentToVarsArgs {
    readonly accent: PaletteAccent;
    readonly textToneHex: string;
    readonly mode: 'light' | 'dark';
}

/**
 * Pure function: build the CSS-var map for a given palette + text-shade tone + mode.
 * Extracted from the component so it can be unit-tested without React.
 *
 * NOTE: `textToneHex` is a hex string from the TextShade registry, NOT from the palette.
 * Body text shade is a separate tier from the palette's accent chat-text colors.
 */
export function accentToVars(
    accent: PaletteAccent,
    textToneHex: string,
    mode: 'light' | 'dark',
): Record<string, string> {
    const out: Record<string, string> = {
        '--color-primary-rgb':         hexToRgbTriple(accent.primary),
        '--color-primary-dark-rgb':    hexToRgbTriple(accent.primaryDark),
        '--color-persona-rose-rgb':    hexToRgbTriple(accent.personaRose),
        '--color-accent-blue-rgb':     hexToRgbTriple(accent.accentBlue),
        '--color-accent-green-rgb':    hexToRgbTriple(accent.accentGreen),
        '--color-accent-green-dark-rgb': hexToRgbTriple(accent.accentGreen),
        '--color-accent-yellow-rgb':   hexToRgbTriple(accent.accentYellow),
        '--color-ai-text-rgb':         hexToRgbTriple(accent.aiText),
        '--color-user-text-rgb':       hexToRgbTriple(accent.userText),
        '--color-user-text-dark-rgb':  hexToRgbTriple(accent.userTextDark),
    };
    const toneKey = mode === 'dark' ? '--color-text-shade-dark-rgb' : '--color-text-shade-light-rgb';
    out[toneKey] = hexToRgbTriple(textToneHex);
    return out;
}

interface ThemeProviderProps {
    readonly mode: ThemePreference;
    readonly paletteId: PaletteId;
    readonly textShadeId: TextShadeId;
    readonly children: React.ReactNode;
}

function applyWebDocumentVars(vars: Record<string, string>) {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    for (const [k, v] of Object.entries(vars)) {
        document.documentElement.style.setProperty(k, v);
    }
}

function clearWebDocumentVars(vars: Record<string, string>) {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    for (const k of Object.keys(vars)) {
        document.documentElement.style.removeProperty(k);
    }
}

export function ThemeProvider({ mode, paletteId, textShadeId, children }: ThemeProviderProps) {
    // Note: mode === 'system' is pre-resolved by the hook to 'light' or 'dark' before reaching this component.
    const resolvedMode: 'light' | 'dark' = mode === 'light' ? 'light' : 'dark';

    const palette = getPalette(paletteId) ?? PALETTES[DEFAULT_PALETTE_ID];
    const shade = getTextShade(textShadeId) ?? TEXT_SHADES[DEFAULT_TEXT_SHADE_ID];
    const accent = resolvedMode === 'dark' ? palette.dark : palette.light;
    const textToneHex = resolvedMode === 'dark' ? shade.tone.dark : shade.tone.light;

    const cssVars = useMemo(
        () => accentToVars(accent, textToneHex, resolvedMode),
        [accent, textToneHex, resolvedMode],
    );

    useEffect(() => {
        applyWebDocumentVars(cssVars);
        return () => clearWebDocumentVars(cssVars);
    }, [cssVars]);

    return (
        <View testID="theme-provider-root" style={vars(cssVars)} className="flex-1">
            {children}
        </View>
    );
}
```

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="accentToVars"
```

**Step 5: Write smoke test for the component (no assertion on style internals — `vars()` returns an opaque object)**

`__tests__/components/theme/ThemeProvider.test.tsx`:
```tsx
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '../../../components/theme/ThemeProvider';
import { PALETTES } from '../../../constants/theme/palettes';
import { TEXT_SHADES } from '../../../constants/theme/textShades';

describe('ThemeProvider (component smoke)', () => {
    it('renders children without crashing', () => {
        const { getByText } = render(
            <ThemeProvider mode="dark" paletteId="default" textShadeId="default">
                <Text>hi</Text>
            </ThemeProvider>
        );
        expect(getByText('hi')).toBeTruthy();
    });

    it('renders without crashing for unknown palette and shade ids (falls back to defaults)', () => {
        const { getByTestId } = render(
            <ThemeProvider mode="light" paletteId="bogus" textShadeId="bogus">
                <Text testID="x">x</Text>
            </ThemeProvider>
        );
        expect(getByTestId('theme-provider-root')).toBeTruthy();
    });

    it('renders without crashing for mode="system" (hook pre-resolves, but defensive)', () => {
        const { getByTestId } = render(
            <ThemeProvider mode="system" paletteId="default" textShadeId="default">
                <Text testID="x">x</Text>
            </ThemeProvider>
        );
        expect(getByTestId('theme-provider-root')).toBeTruthy();
    });

    it('renders a root View that contains the children', () => {
        const { getByTestId } = render(
            <ThemeProvider mode="dark" paletteId="default" textShadeId="default">
                <Text testID="child">child</Text>
            </ThemeProvider>
        );
        const root = getByTestId('theme-provider-root');
        expect(getByTestId('child').parent).toBe(root);
    });
});
```

> Note: We don't assert the `style` prop's internals — `vars()` returns an opaque object handled by `react-native-css-interop`'s runtime. The actual style application is verified by the integration test in Task 10 (manually in the running app or via a Playwright smoke test on web). The pure `accentToVars` test in Step 1 covers the logic.

**Step 6: Run, expect pass**

```bash
npm test -- --testPathPattern="ThemeProvider"
```

**Step 7: Commit**

```bash
git add components/theme/ThemeProvider.tsx __tests__/components/theme/ThemeProvider.test.tsx __tests__/components/theme/accentToVars.test.ts
git commit -m "feat(theme): ThemeProvider injects rgb-pattern CSS vars via vars()"
```

---

## Task 5: Storage services (TDD, ~30 min)

### Task 5.1: paletteStorage (AsyncStorage owner for palette preference)

**Files:**
- Create: `services/settings/paletteStorage.ts`
- Create: `__tests__/services/paletteStorage.test.ts`

**Why a new file:** AGENTS.md rule 4 — "One module owns each storage key." `user-palette-preference` is a new key, so it gets a new owner. The new module also exports a serialized queue to prevent read-modify-write races.

**Step 1: Write failing test**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadPalettePreference, savePalettePreference, PALETTE_STORAGE_KEY } from '../../services/settings/paletteStorage';
import { DEFAULT_PALETTE_ID } from '../../constants/theme/palettes';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn().mockResolvedValue(undefined),
    },
}));

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

describe('paletteStorage', () => {
    beforeEach(() => {
        getItem.mockReset();
        setItem.mockReset();
    });

    it('PALETTE_STORAGE_KEY is the user-palette-preference key', () => {
        expect(PALETTE_STORAGE_KEY).toBe('user-palette-preference');
    });

    it('loadPalettePreference returns DEFAULT_PALETTE_ID when nothing stored', async () => {
        getItem.mockResolvedValue(null);
        await expect(loadPalettePreference()).resolves.toBe(DEFAULT_PALETTE_ID);
    });

    it('loadPalettePreference returns DEFAULT_PALETTE_ID on corrupt JSON', async () => {
        getItem.mockResolvedValue('not-json');
        await expect(loadPalettePreference()).resolves.toBe(DEFAULT_PALETTE_ID);
    });

    it('loadPalettePreference returns DEFAULT_PALETTE_ID when stored id is unknown', async () => {
        getItem.mockResolvedValue(JSON.stringify('bogus'));
        await expect(loadPalettePreference()).resolves.toBe(DEFAULT_PALETTE_ID);
    });

    it('loadPalettePreference returns the stored id when valid', async () => {
        getItem.mockResolvedValue(JSON.stringify('ocean'));
        await expect(loadPalettePreference()).resolves.toBe('ocean');
    });

    it('savePalettePreference writes serialized JSON', async () => {
        await savePalettePreference('rose');
        expect(setItem).toHaveBeenCalledWith('user-palette-preference', JSON.stringify('rose'));
    });
});
```

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="paletteStorage"
```

**Step 3: Implement**

`services/settings/paletteStorage.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PALETTE_ID, isPaletteId, type PaletteId } from '@/constants/theme/palettes';

export const PALETTE_STORAGE_KEY = 'user-palette-preference';

// Serialized queue: every read-modify-write goes through here.
// Prevents two interleaved load→save cycles from clobbering each other (AGENTS.md rule 4).
let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
}

export async function loadPalettePreference(): Promise<PaletteId> {
    return withLock(async () => {
        let raw: string | null = null;
        try {
            raw = await AsyncStorage.getItem(PALETTE_STORAGE_KEY);
        } catch (error) {
            console.error('paletteStorage: failed to read', error);
            return DEFAULT_PALETTE_ID;
        }
        if (raw === null) return DEFAULT_PALETTE_ID;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (typeof parsed === 'string' && isPaletteId(parsed)) return parsed;
        } catch (error) {
            console.error('paletteStorage: corrupt JSON, using default', error);
        }
        return DEFAULT_PALETTE_ID;
    });
}

export async function savePalettePreference(id: PaletteId): Promise<void> {
    await withLock(async () => {
        try {
            await AsyncStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(id));
        } catch (error) {
            console.error('paletteStorage: failed to write', error);
        }
    });
}
```

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="paletteStorage"
```

**Step 5: Commit**

```bash
git add services/settings/paletteStorage.ts __tests__/services/paletteStorage.test.ts
git commit -m "feat(theme): paletteStorage owns user-palette-preference key"
```

### Task 5.2: textShadeStorage (AsyncStorage owner for text shade preference)

**Files:**
- Create: `services/settings/textShadeStorage.ts`
- Create: `__tests__/services/textShadeStorage.test.ts`

**Step 1: Write failing test**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTextShadePreference, saveTextShadePreference, TEXT_SHADE_STORAGE_KEY } from '../../services/settings/textShadeStorage';
import { DEFAULT_TEXT_SHADE_ID } from '../../constants/theme/textShades';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn().mockResolvedValue(undefined),
    },
}));

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

describe('textShadeStorage', () => {
    beforeEach(() => {
        getItem.mockReset();
        setItem.mockReset();
    });

    it('TEXT_SHADE_STORAGE_KEY is the user-text-shade-preference key', () => {
        expect(TEXT_SHADE_STORAGE_KEY).toBe('user-text-shade-preference');
    });

    it('loadTextShadePreference returns DEFAULT_TEXT_SHADE_ID when nothing stored', async () => {
        getItem.mockResolvedValue(null);
        await expect(loadTextShadePreference()).resolves.toBe(DEFAULT_TEXT_SHADE_ID);
    });

    it('loadTextShadePreference returns DEFAULT_TEXT_SHADE_ID on corrupt JSON', async () => {
        getItem.mockResolvedValue('not-json');
        await expect(loadTextShadePreference()).resolves.toBe(DEFAULT_TEXT_SHADE_ID);
    });

    it('loadTextShadePreference returns DEFAULT_TEXT_SHADE_ID when stored id is unknown', async () => {
        getItem.mockResolvedValue(JSON.stringify('bogus'));
        await expect(loadTextShadePreference()).resolves.toBe(DEFAULT_TEXT_SHADE_ID);
    });

    it('loadTextShadePreference returns the stored id when valid', async () => {
        getItem.mockResolvedValue(JSON.stringify('warm'));
        await expect(loadTextShadePreference()).resolves.toBe('warm');
    });

    it('saveTextShadePreference writes serialized JSON', async () => {
        await saveTextShadePreference('cool');
        expect(setItem).toHaveBeenCalledWith('user-text-shade-preference', JSON.stringify('cool'));
    });
});
```

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="textShadeStorage"
```

**Step 3: Implement**

`services/settings/textShadeStorage.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_TEXT_SHADE_ID, isTextShadeId, type TextShadeId } from '@/constants/theme/textShades';

export const TEXT_SHADE_STORAGE_KEY = 'user-text-shade-preference';

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
}

export async function loadTextShadePreference(): Promise<TextShadeId> {
    return withLock(async () => {
        let raw: string | null = null;
        try {
            raw = await AsyncStorage.getItem(TEXT_SHADE_STORAGE_KEY);
        } catch (error) {
            console.error('textShadeStorage: failed to read', error);
            return DEFAULT_TEXT_SHADE_ID;
        }
        if (raw === null) return DEFAULT_TEXT_SHADE_ID;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (typeof parsed === 'string' && isTextShadeId(parsed)) return parsed;
        } catch (error) {
            console.error('textShadeStorage: corrupt JSON, using default', error);
        }
        return DEFAULT_TEXT_SHADE_ID;
    });
}

export async function saveTextShadePreference(id: TextShadeId): Promise<void> {
    await withLock(async () => {
        try {
            await AsyncStorage.setItem(TEXT_SHADE_STORAGE_KEY, JSON.stringify(id));
        } catch (error) {
            console.error('textShadeStorage: failed to write', error);
        }
    });
}
```

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="textShadeStorage"
```

**Step 5: Commit**

```bash
git add services/settings/textShadeStorage.ts __tests__/services/textShadeStorage.test.ts
git commit -m "feat(theme): textShadeStorage owns user-text-shade-preference key"
```

---

## Task 6: Supabase migration (~5 min)

### Task 6.1: Add `palette_id` and `text_shade` columns to `user_settings`

**Files:**
- Create: `supabase/migrations/20260611000001_user_settings_palette.sql`

**Step 1: Write the migration**

```sql
-- Adds palette + text shade preference columns. Existing rows get NULL (will resolve to defaults at read time).
alter table public.user_settings
    add column if not exists palette_id text;

alter table public.user_settings
    add column if not exists text_shade text;
```

Per AGENTS.md: "new migration file only; never edit an applied one."

**Step 2: Verify**

```bash
grep -r "palette_id\|text_shade" supabase/migrations/
```

Expected: only the new file.

**Step 3: Commit**

```bash
git add supabase/migrations/20260611000001_user_settings_palette.sql
git commit -m "feat(supabase): add palette_id and text_shade columns to user_settings"
```

---

## Task 7: Extend `userSettingsRemote.ts` (~10 min)

### Task 7.1: Carry `palette_id` and `text_shade` over the wire

**Files:**
- Modify: `services/settings/userSettingsRemote.ts:7-20, 43-46, 55-60`

**Step 1: Update types and serialization**

Replace lines 7-13:
```ts
type ThemePreference = 'light' | 'dark' | 'system';
type EmojiStylePreference = 'native' | 'flat' | '3d';
type PaletteId = string; // narrowed by isPaletteId at the boundary
type TextShadeId = string; // narrowed by isTextShadeId at the boundary

export interface RemoteUserSettings {
    theme?: ThemePreference;
    emojiStyle?: EmojiStylePreference;
    paletteId?: PaletteId;
    textShadeId?: TextShadeId;
}
```

Replace lines 15-20:
```ts
interface UserSettingsRecord {
    owner_id: string;
    theme?: ThemePreference | null;
    emoji_style?: EmojiStylePreference | null;
    palette_id?: PaletteId | null;
    text_shade?: TextShadeId | null;
    updated_at?: string | null;
}
```

Replace the return at lines 43-46:
```ts
return {
    theme: record.theme ?? undefined,
    emojiStyle: record.emoji_style ?? undefined,
    paletteId: record.palette_id ?? undefined,
    textShadeId: record.text_shade ?? undefined,
};
```

Replace the payload build at lines 55-60:
```ts
const payload: UserSettingsRecord = {
    owner_id: ownerId,
    theme: settings.theme ?? null,
    emoji_style: settings.emojiStyle ?? null,
    palette_id: settings.paletteId ?? null,
    text_shade: settings.textShadeId ?? null,
    updated_at: new Date().toISOString(),
};
```

**Step 2: Run TS + tests**

```bash
npx tsc --noEmit
npm test -- --testPathPattern="userSettingsRemote"
```

Expected: TS clean; existing tests still pass (no behavioral break for theme/emojiStyle).

**Step 3: Commit**

```bash
git add services/settings/userSettingsRemote.ts
git commit -m "feat(settings): carry paletteId + textShadeId through Supabase user_settings"
```

---

## Task 8: Refactor `useThemeSettings` (~25 min)

### Task 8.1: Expose `paletteId`/`setPaletteId` and `textShadeId`/`setTextShadeId` + fix test mocks

**Files:**
- Modify: `hooks/theme/useThemeSettings.ts`
- Modify: `__tests__/useThemeSettings.test.ts` (add 6 new tests AND new module mocks)

**Why also touch the test mocks:** The hook will now import from `services/settings/paletteStorage` and `services/settings/textShadeStorage`. Without mocks, the test will fail with module-not-found. We also need to fix the existing `useColorScheme` mock to include `colorScheme: 'dark'` so the new code paths (e.g. `ChatColorsPreview`'s resolved mode lookup) work in tests.

**Step 1: Update the test file — add mocks + new tests**

`__tests__/useThemeSettings.test.ts` — add these mocks near the top (after the existing mocks):
```ts
jest.mock('@/services/settings/paletteStorage', () => ({
    loadPalettePreference: jest.fn().mockResolvedValue('default'),
    savePalettePreference: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/settings/textShadeStorage', () => ({
    loadTextShadePreference: jest.fn().mockResolvedValue('default'),
    saveTextShadePreference: jest.fn().mockResolvedValue(undefined),
}));
```

Update the existing `nativewind` mock to also return `colorScheme` (so consumers of `useColorScheme()` from `@/hooks/theme/use-color-scheme` work in tests):
```ts
jest.mock('nativewind', () => ({
    useColorScheme: () => ({ setColorScheme: mockSetColorScheme, colorScheme: 'dark' as const }),
}));
```

Add these tests inside the existing `describe('useThemeSettings', ...)`:
```ts
it('defaults paletteId to default when nothing stored', async () => {
    const { result } = renderHook(() => useThemeSettings());
    await act(async () => {});
    expect(result.current.paletteId).toBe('default');
});

it('setPaletteId persists and updates state', async () => {
    const { result } = renderHook(() => useThemeSettings());
    await act(async () => {});
    await act(async () => {
        await result.current.setPaletteId('ocean');
    });
    expect(result.current.paletteId).toBe('ocean');
});

it('setPaletteId rejects unknown ids and keeps current', async () => {
    const { result } = renderHook(() => useThemeSettings());
    await act(async () => {});
    await act(async () => {
        await result.current.setPaletteId('ocean');
    });
    await act(async () => {
        await result.current.setPaletteId('bogus' as any);
    });
    expect(result.current.paletteId).toBe('ocean');
});

it('defaults textShadeId to default when nothing stored', async () => {
    const { result } = renderHook(() => useThemeSettings());
    await act(async () => {});
    expect(result.current.textShadeId).toBe('default');
});

it('setTextShadeId persists and updates state', async () => {
    const { result } = renderHook(() => useThemeSettings());
    await act(async () => {});
    await act(async () => {
        await result.current.setTextShadeId('warm');
    });
    expect(result.current.textShadeId).toBe('warm');
});

it('setTextShadeId rejects unknown ids and keeps current', async () => {
    const { result } = renderHook(() => useThemeSettings());
    await act(async () => {});
    await act(async () => {
        await result.current.setTextShadeId('cool');
    });
    await act(async () => {
        await result.current.setTextShadeId('bogus' as any);
    });
    expect(result.current.textShadeId).toBe('cool');
});
```

**Step 2: Run, expect failures**

```bash
npm test -- --testPathPattern="useThemeSettings"
```

**Step 3: Implement the hook**

`hooks/theme/useThemeSettings.ts` — additions:
- Import `loadPalettePreference`, `savePalettePreference` from `@/services/settings/paletteStorage`.
- Import `loadTextShadePreference`, `saveTextShadePreference` from `@/services/settings/textShadeStorage`.
- Import `DEFAULT_PALETTE_ID`, `isPaletteId` from `@/constants/theme/palettes`.
- Import `DEFAULT_TEXT_SHADE_ID`, `isTextShadeId` from `@/constants/theme/textShades`.
- Add state:
  ```ts
  const [paletteId, setPaletteIdState] = useState<PaletteId>(DEFAULT_PALETTE_ID);
  const [textShadeId, setTextShadeIdState] = useState<TextShadeId>(DEFAULT_TEXT_SHADE_ID);
  ```
- In the existing `loadSettings` async function, add palette + text shade loading after the emoji block:
  ```ts
  const savedPalette = await loadPalettePreference();
  if (isMounted) setPaletteIdState(savedPalette);
  const savedShade = await loadTextShadePreference();
  if (isMounted) setTextShadeIdState(savedShade);
  ```
  And in the remote merge:
  ```ts
  if (!hasLocalPalette && remote.paletteId && isPaletteId(remote.paletteId)) {
      setPaletteIdState(remote.paletteId);
      await savePalettePreference(remote.paletteId);
  }
  if (!hasLocalShade && remote.textShadeId && isTextShadeId(remote.textShadeId)) {
      setTextShadeIdState(remote.textShadeId);
      await saveTextShadePreference(remote.textShadeId);
  }
  ```
- In the remote-seed `else if` branch, include `paletteId: hasLocalPalette ? savedPalette : undefined` and `textShadeId: hasLocalShade ? savedShade : undefined`.
- Add the palette setter:
  ```ts
  const setPaletteId = useCallback(async (next: PaletteId) => {
      if (!isPaletteId(next)) return;
      setPaletteIdState(next);
      try { await savePalettePreference(next); } catch (e) { console.error('save palette', e); }
      try { await saveRemoteUserSettings({ theme, emojiStyle, paletteId: next, textShadeId }); } catch (e) { console.error('sync palette', e); }
  }, [theme, emojiStyle, textShadeId]);
  ```
- Add the text shade setter:
  ```ts
  const setTextShadeId = useCallback(async (next: TextShadeId) => {
      if (!isTextShadeId(next)) return;
      setTextShadeIdState(next);
      try { await saveTextShadePreference(next); } catch (e) { console.error('save shade', e); }
      try { await saveRemoteUserSettings({ theme, emojiStyle, paletteId, textShadeId: next }); } catch (e) { console.error('sync shade', e); }
  }, [theme, emojiStyle, paletteId]);
  ```
- Return `paletteId, setPaletteId, textShadeId, setTextShadeId` in the hook return value.

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="useThemeSettings"
```

**Step 5: Commit**

```bash
git add hooks/theme/useThemeSettings.ts __tests__/useThemeSettings.test.ts
git commit -m "feat(theme): useThemeSettings exposes paletteId + textShadeId and their setters"
```

---

## Task 9: Picker UI components (~30 min)

### Task 9.1: PalettePickerSection (swatch grid)

**Files:**
- Create: `components/settings/PalettePickerSection.tsx`
- Create: `__tests__/components/settings/PalettePickerSection.test.tsx`
- Modify: `components/settings/index.ts` (export)

**Step 1: Write failing test**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PalettePickerSection } from '../../../components/settings/PalettePickerSection';
import { PALETTES } from '../../../constants/theme/palettes';

describe('PalettePickerSection', () => {
    it('renders one option per registered palette', () => {
        const onChange = jest.fn();
        const { getAllByRole } = render(
            <PalettePickerSection paletteId="default" onPaletteChange={onChange} />
        );
        const count = Object.keys(PALETTES).length;
        expect(getAllByRole('radio')).toHaveLength(count);
    });

    it('marks the active palette as selected', () => {
        const onChange = jest.fn();
        const { getByLabelText } = render(
            <PalettePickerSection paletteId="ocean" onPaletteChange={onChange} />
        );
        expect(getByLabelText('Select Ocean palette').props.accessibilityState.selected).toBe(true);
    });

    it('fires onPaletteChange with the palette id when pressed', () => {
        const onChange = jest.fn();
        const { getByLabelText } = render(
            <PalettePickerSection paletteId="default" onPaletteChange={onChange} />
        );
        fireEvent.press(getByLabelText('Select Forest palette'));
        expect(onChange).toHaveBeenCalledWith('forest');
    });
});
```

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="PalettePickerSection"
```

**Step 3: Implement**

`components/settings/PalettePickerSection.tsx`:
```tsx
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { PALETTES, type PaletteId } from '@/constants/theme/palettes';
import { SettingsSection } from './SettingsSection';

interface PalettePickerSectionProps {
    readonly paletteId: PaletteId;
    readonly onPaletteChange: (next: PaletteId) => void;
}

interface SwatchProps {
    readonly paletteId: PaletteId;
    readonly active: boolean;
    readonly onPress: (id: PaletteId) => void;
}

function Swatch({ paletteId, active, onPress }: SwatchProps) {
    const palette = PALETTES[paletteId];
    const accent = palette.dark; // show dark accent in the swatch (matches app)
    return (
        <TouchableOpacity
            onPress={() => onPress(paletteId)}
            className={`items-center justify-center p-2 rounded-xl border ${
                active
                    ? 'border-primary'
                    : 'border-divider-light dark:border-divider-dark'
            }`}
            style={{ minWidth: 72 }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Select ${palette.label} palette`}
        >
            <View
                className="w-10 h-10 rounded-full mb-1"
                style={{ backgroundColor: accent.primary }}
                accessibilityElementsHidden
            />
            <Text className="text-xs font-medium text-text-light dark:text-text-dark">
                {palette.label}
            </Text>
        </TouchableOpacity>
    );
}

export function PalettePickerSection({ paletteId, onPaletteChange }: PalettePickerSectionProps) {
    return (
        <SettingsSection title="Color Theme" description="Choose the accent palette used across the app.">
            <View className="flex-row flex-wrap gap-3">
                {Object.values(PALETTES).map(p => (
                    <Swatch
                        key={p.id}
                        paletteId={p.id}
                        active={p.id === paletteId}
                        onPress={onPaletteChange}
                    />
                ))}
            </View>
        </SettingsSection>
    );
}
```

> Note: We use `border-primary` for the active state (not `bg-primary/10`) because the rgb-pattern means we COULD use opacity, but border-only is simpler and works equally well for the affordance.

`components/settings/index.ts` — add export:
```ts
export { PalettePickerSection } from './PalettePickerSection';
```

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="PalettePickerSection"
```

**Step 5: Commit**

```bash
git add components/settings/PalettePickerSection.tsx components/settings/index.ts __tests__/components/settings/PalettePickerSection.test.tsx
git commit -m "feat(theme): PalettePickerSection renders swatch grid"
```

### Task 9.2: TextShadePickerSection (4 curated shades)

**Files:**
- Create: `components/settings/TextShadePickerSection.tsx`
- Create: `__tests__/components/settings/TextShadePickerSection.test.tsx`
- Modify: `components/settings/index.ts` (export)

**Step 1: Write failing test**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { TextShadePickerSection } from '../../../components/settings/TextShadePickerSection';
import { TEXT_SHADES, TEXT_SHADE_IDS } from '../../../constants/theme/textShades';

describe('TextShadePickerSection', () => {
    it('renders one option per curated shade', () => {
        const onChange = jest.fn();
        const { getAllByRole } = render(
            <TextShadePickerSection textShadeId="default" onTextShadeChange={onChange} />
        );
        expect(getAllByRole('radio')).toHaveLength(TEXT_SHADE_IDS.length);
    });

    it('marks the active shade as selected', () => {
        const onChange = jest.fn();
        const { getByLabelText } = render(
            <TextShadePickerSection textShadeId="warm" onTextShadeChange={onChange} />
        );
        expect(getByLabelText('Select Warm text shade').props.accessibilityState.selected).toBe(true);
    });

    it('fires onTextShadeChange with the shade id when pressed', () => {
        const onChange = jest.fn();
        const { getByLabelText } = render(
            <TextShadePickerSection textShadeId="default" onTextShadeChange={onChange} />
        );
        fireEvent.press(getByLabelText('Select High Contrast text shade'));
        expect(onChange).toHaveBeenCalledWith('high-contrast');
    });
});
```

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="TextShadePickerSection"
```

**Step 3: Implement**

`components/settings/TextShadePickerSection.tsx`:
```tsx
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { TEXT_SHADES, TEXT_SHADE_IDS, type TextShadeId } from '@/constants/theme/textShades';
import { SettingsSection } from './SettingsSection';

interface TextShadePickerSectionProps {
    readonly textShadeId: TextShadeId;
    readonly onTextShadeChange: (next: TextShadeId) => void;
}

interface ShadeSwatchProps {
    readonly id: TextShadeId;
    readonly active: boolean;
    readonly onPress: (id: TextShadeId) => void;
}

function ShadeSwatch({ id, active, onPress }: ShadeSwatchProps) {
    const shade = TEXT_SHADES[id];
    // Show the light-mode tone on top, dark-mode tone on bottom of the swatch so the
    // user can see how it'll look in both modes.
    return (
        <TouchableOpacity
            onPress={() => onPress(id)}
            className={`items-center justify-center p-2 rounded-xl border flex-1 min-w-0 ${
                active
                    ? 'border-primary'
                    : 'border-divider-light dark:border-divider-dark'
            }`}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Select ${shade.label} text shade`}
        >
            <View className="flex-row gap-1 mb-1" accessibilityElementsHidden>
                <View className="w-4 h-4 rounded-full" style={{ backgroundColor: shade.tone.light }} />
                <View className="w-4 h-4 rounded-full border border-divider-light dark:border-divider-dark" style={{ backgroundColor: shade.tone.dark }} />
            </View>
            <Text className="text-xs font-medium text-text-light dark:text-text-dark" numberOfLines={1}>
                {shade.label}
            </Text>
        </TouchableOpacity>
    );
}

export function TextShadePickerSection({ textShadeId, onTextShadeChange }: TextShadePickerSectionProps) {
    return (
        <SettingsSection title="Text Shade" description="Body text tone across the app.">
            <View className="flex-row gap-3">
                {TEXT_SHADE_IDS.map(id => (
                    <ShadeSwatch
                        key={id}
                        id={id}
                        active={id === textShadeId}
                        onPress={onTextShadeChange}
                    />
                ))}
            </View>
        </SettingsSection>
    );
}
```

`components/settings/index.ts` — add export:
```ts
export { TextShadePickerSection } from './TextShadePickerSection';
```

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="TextShadePickerSection"
```

**Step 5: Commit**

```bash
git add components/settings/TextShadePickerSection.tsx components/settings/index.ts __tests__/components/settings/TextShadePickerSection.test.tsx
git commit -m "feat(theme): TextShadePickerSection renders 4 curated shades"
```

### Task 9.3: ChatColorsPreview (live preview in Settings)

**Files:**
- Create: `components/settings/ChatColorsPreview.tsx`
- Create: `__tests__/components/settings/ChatColorsPreview.test.tsx`
- Modify: `components/settings/index.ts` (export)

**Why:** When the user picks a palette, they should see how AI and user chat text will look *right now* in Settings. A tiny mock-chat card with one AI bubble and one user bubble gives instant feedback. This is what makes the picker feel "flexible" — the visual change is unambiguous.

**Step 1: Write failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';

import { ChatColorsPreview } from '../../../components/settings/ChatColorsPreview';
import { PALETTES } from '../../../constants/theme/palettes';
import { hexToRgbTriple } from '../../../components/theme/ThemeProvider';

describe('ChatColorsPreview', () => {
    it('renders both an AI bubble and a user bubble', () => {
        const { getByTestId } = render(
            <ChatColorsPreview paletteId="default" mode="dark" />
        );
        expect(getByTestId('chat-preview-ai')).toBeTruthy();
        expect(getByTestId('chat-preview-user')).toBeTruthy();
    });

    it('AI bubble text uses the palette aiText converted to rgb', () => {
        const { getByTestId } = render(
            <ChatColorsPreview paletteId="rose" mode="dark" />
        );
        const ai = getByTestId('chat-preview-ai-text');
        const flat = Object.assign({}, ...(Array.isArray(ai.props.style) ? ai.props.style : [ai.props.style]));
        expect(flat.color).toBe(`rgb(${hexToRgbTriple(PALETTES.rose.dark.aiText)})`);
    });

    it('user bubble text uses the userTextDark in dark mode', () => {
        const { getByTestId } = render(
            <ChatColorsPreview paletteId="ocean" mode="dark" />
        );
        const user = getByTestId('chat-preview-user-text');
        const flat = Object.assign({}, ...(Array.isArray(user.props.style) ? user.props.style : [user.props.style]));
        expect(flat.color).toBe(`rgb(${hexToRgbTriple(PALETTES.ocean.dark.userTextDark)})`);
    });

    it('user bubble text uses userText in light mode', () => {
        const { getByTestId } = render(
            <ChatColorsPreview paletteId="forest" mode="light" />
        );
        const user = getByTestId('chat-preview-user-text');
        const flat = Object.assign({}, ...(Array.isArray(user.props.style) ? user.props.style : [user.props.style]));
        expect(flat.color).toBe(`rgb(${hexToRgbTriple(PALETTES.forest.light.userText)})`);
    });
});
```

> Note: We test the color is set as `rgb(R G B)` because the test renders the actual `<Text>` with `style={{ color: ... }}`, and our preview component sets the color as an `rgb()` value (not via CSS var). This is the simplest way to test the value matches the palette's hex.

**Step 2: Run, expect failure**

```bash
npm test -- --testPathPattern="ChatColorsPreview"
```

**Step 3: Implement**

`components/settings/ChatColorsPreview.tsx`:
```tsx
import React from 'react';
import { Text, View } from 'react-native';

import { getPalette, DEFAULT_PALETTE_ID, type PaletteId } from '@/constants/theme/palettes';
import { SettingsSection } from './SettingsSection';
import { hexToRgbTriple } from '@/components/theme/ThemeProvider';

interface ChatColorsPreviewProps {
    readonly paletteId: PaletteId;
    readonly mode: 'light' | 'dark';
}

function rgbString(hex: string): string {
    return `rgb(${hexToRgbTriple(hex)})`;
}

export function ChatColorsPreview({ paletteId, mode }: ChatColorsPreviewProps) {
    const palette = getPalette(paletteId) ?? PALETTES[DEFAULT_PALETTE_ID];
    const accent = mode === 'dark' ? palette.dark : palette.light;
    const userTextColor = mode === 'dark' ? accent.userTextDark : accent.userText;

    return (
        <SettingsSection title="Chat Preview" description="How AI and user messages will look.">
            <View className="gap-3">
                <View
                    testID="chat-preview-ai"
                    className="self-start max-w-[85%] rounded-2xl px-4 py-2 bg-surface-light dark:bg-surface-dark"
                >
                    <Text testID="chat-preview-ai-text" style={{ color: rgbString(accent.aiText) }}>
                        How are you feeling today?
                    </Text>
                </View>
                <View
                    testID="chat-preview-user"
                    className="self-end max-w-[85%] rounded-2xl px-4 py-2"
                    style={{ backgroundColor: rgbString(accent.primary) + '22' /* ~13% alpha */ }}
                >
                    <Text testID="chat-preview-user-text" style={{ color: rgbString(userTextColor) }}>
                        A little overwhelmed but hopeful.
                    </Text>
                </View>
            </View>
        </SettingsSection>
    );
}
```

> Note: The bubble background uses inline alpha hex (`+ '22'`) which RN supports at runtime. The TypeScript type may need a `string` cast.

`components/settings/index.ts` — add export:
```ts
export { ChatColorsPreview } from './ChatColorsPreview';
```

**Step 4: Run, expect pass**

```bash
npm test -- --testPathPattern="ChatColorsPreview"
```

**Step 5: Commit**

```bash
git add components/settings/ChatColorsPreview.tsx components/settings/index.ts __tests__/components/settings/ChatColorsPreview.test.tsx
git commit -m "feat(theme): ChatColorsPreview shows live AI + user bubble preview"
```

---

## Task 10: Wire everything into Settings + app root (~10 min)

### Task 10.1: Render the pickers + wrap the app in `ThemeProvider`

**Files:**
- Modify: `app/(tabs)/settings.tsx:25-32, 153-158`
- Modify: `app/_layout.tsx` — wrap children in `ThemeProvider`
- Modify: `__tests__/screens/AskRosebudReachable.test.tsx:43-44`

**Step 1: Update `app/(tabs)/settings.tsx`**

- Import `PalettePickerSection`, `TextShadePickerSection`, `ChatColorsPreview` from `@/components/settings`.
- Import `useColorScheme` from `@/hooks/theme/use-color-scheme`.
- Pull `paletteId, setPaletteId, textShadeId, setTextShadeId` from `useThemeSettings()`.
- Get the resolved mode via `useColorScheme()` for the preview.

  ```tsx
  const { theme, setTheme, emojiStyle, setEmojiStyle, paletteId, setPaletteId, textShadeId, setTextShadeId } = useThemeSettings();
  const resolvedScheme: 'light' | 'dark' = (useColorScheme() ?? 'light') as 'light' | 'dark';
  ```

- Render in order, after `AppearanceSettingsSection`:
  ```tsx
  <PalettePickerSection paletteId={paletteId} onPaletteChange={setPaletteId} />
  <TextShadePickerSection textShadeId={textShadeId} onTextShadeChange={setTextShadeId} />
  <ChatColorsPreview paletteId={paletteId} mode={resolvedScheme} />
  ```

**Step 2: Wrap the app in `ThemeProvider`**

In `app/_layout.tsx`:
- Add import: `import { ThemeProvider } from '@/components/theme/ThemeProvider';`
- After calling `useThemeSettings()`, also destructure `paletteId` and `textShadeId`:
  ```tsx
  const { theme, paletteId, textShadeId } = useThemeSettings();
  ```
- Wrap the existing root return's children:
  ```tsx
  return (
      <ThemeProvider mode={theme} paletteId={paletteId} textShadeId={textShadeId}>
          {/* existing root JSX */}
      </ThemeProvider>
  );
  ```

**Step 3: Fix the test mock that broke**

`__tests__/screens/AskRosebudReachable.test.tsx:43-44` — update the mock to include the new shape:
```ts
jest.mock('../../hooks/useThemeSettings', () => ({
    useThemeSettings: () => ({
        emojiStyle: 'native',
        paletteId: 'default',
        setPaletteId: jest.fn(),
        textShadeId: 'default',
        setTextShadeId: jest.fn(),
    }),
}));
```

**Step 4: Run all gates**

```bash
npx tsc --noEmit
npm run lint
npm test
npm run check:design
```

Expected: all clean.

**Step 5: Commit**

```bash
git add app/(tabs)/settings.tsx app/_layout.tsx __tests__/screens/AskRosebudReachable.test.tsx
git commit -m "feat(theme): wire palette + text shade pickers into Settings and wrap app in ThemeProvider"
```

---

## Task 11: Documentation + guard test (~5 min)

### Task 11.1: Update `AGENTS.md` with the new guard

**Files:**
- Modify: `AGENTS.md` — replace rule 9 (or add a rule 10).

Replace the planned rule 9 (from the original draft) with this consolidated version that covers palette + text shade:

```md
### 9. Accent, chat-text, and body-text tokens come from `ThemeProvider`, not bare hex. Text shade is curated, never free-form.

`primary`, `primary-dark`, `accent-blue`, `accent-green`, `accent-yellow`, `persona-rose`,
`ai-text`, `user-text`, `user-text-dark`, `text-light`, `text-dark` are CSS-variable-backed
via the `rgb(var(--color-*-rgb) / <alpha-value>)` pattern. The default values live in
`global.css`; runtime overrides come from `ThemeProvider` reading
`paletteId` × `textShadeId` × `mode`. Never hardcode these hex values in `app/` or
`components/` — use the Tailwind classes (`bg-primary`, `text-ai-text`, etc.).

Body text color is also theme-driven, but only via the curated `TextShade` set
(`default` / `warm` / `cool` / `high-contrast`) — never via free-form hex. This protects
AGENTS.md rule 1's contrast guarantee.

New palettes go in `constants/theme/palettes.ts`; new text shades go in
`constants/theme/textShades.ts`. Never add palette-specific or shade-specific tokens to
`tailwind.config.js`.
```

Add a guard test (in `__tests__/tailwind-config.test.ts`):
```ts
it('does not contain palette-specific or shade-specific color names', () => {
    const banned = [
        'rose', 'ocean', 'forest', 'midnight',
        'warm', 'cool', 'high-contrast', 'shade',
    ];
    Object.keys(colors).forEach(key => {
        banned.forEach(name => {
            expect(key).not.toMatch(new RegExp(`(^|-)${name}(-|$)|^${name}$`));
        });
    });
});
```

### Task 11.2: Update `PROGRESS.md` and `memory.md`

Add a short entry to `PROGRESS.md` describing the architecture (palette registry + text shade registry + ThemeProvider + storage migration) and a follow-up for the per-token custom hex editor (out of scope for this plan).

**Commit:**
```bash
git add AGENTS.md __tests__/tailwind-config.test.ts PROGRESS.md memory.md
git commit -m "docs(theme): add palette + text shade guard test and AGENTS.md rule"
```

---

## Tests / Validation Summary

Per-task tests are inline. Final gates after Task 10:

```bash
npx tsc --noEmit
npm run lint
npm run check:design
npm test
```

Targeted run during development:
```bash
npm test -- --testPathPattern="palette|textShade|ThemeProvider|accentToVars|useThemeSettings|tailwind-config|dark-mode-contrast|userSettingsRemote|PalettePickerSection|TextShadePickerSection|ChatColorsPreview"
```

Manual smoke (post-merge, on device or Expo web):
- Open Settings → tap each palette → confirm the active tab in the bottom nav, the chat "Go deeper" CTA, and the AI/user chat preview all retint live.
- Tap each text shade → confirm body text in the Settings screen retints.
- Switch mode to Light/Dark/System → confirm the palette and shade both survive the mode switch (each rotates light↔dark).
- Open the journal chat (`/chat`) → confirm AI messages use the new `aiText` and your messages use the new `userText`.
- Force-quit + relaunch → confirm the last palette + shade are restored.

## Files Likely to Change

Create:
- `types/theme/palette.ts`
- `types/theme/textShade.ts`
- `constants/theme/palettes.ts`
- `constants/theme/textShades.ts`
- `components/theme/ThemeProvider.tsx`
- `components/settings/PalettePickerSection.tsx`
- `components/settings/TextShadePickerSection.tsx`
- `components/settings/ChatColorsPreview.tsx`
- `services/settings/paletteStorage.ts`
- `services/settings/textShadeStorage.ts`
- `supabase/migrations/20260611000001_user_settings_palette.sql`
- `__tests__/types/palette.test.ts`
- `__tests__/types/textShade.test.ts`
- `__tests__/palettes-registry.test.ts`
- `__tests__/textShades-registry.test.ts`
- `__tests__/components/theme/ThemeProvider.test.tsx`
- `__tests__/components/theme/accentToVars.test.ts`
- `__tests__/services/paletteStorage.test.ts`
- `__tests__/services/textShadeStorage.test.ts`
- `__tests__/components/settings/PalettePickerSection.test.tsx`
- `__tests__/components/settings/TextShadePickerSection.test.tsx`
- `__tests__/components/settings/ChatColorsPreview.test.tsx`

Modify:
- `tailwind.config.js` (themed token values → `rgb(var(--color-*-rgb) / <alpha-value>)`)
- `global.css` (`:root` and `.dark` rgb-triple defaults)
- `hooks/theme/useThemeSettings.ts` (add paletteId + textShadeId state + setters + load/save)
- `services/settings/userSettingsRemote.ts` (carry `paletteId` + `textShadeId`)
- `app/_layout.tsx` (wrap in `ThemeProvider`)
- `app/(tabs)/settings.tsx` (render 3 new sections)
- `components/settings/index.ts` (export new sections)
- `__tests__/useThemeSettings.test.ts` (extend + add 2 new module mocks + fix `useColorScheme` mock shape)
- `__tests__/tailwind-config.test.ts` (extend with rgb-pattern assertions + guard test)
- `__tests__/palettes-registry.test.ts` (add `userText`/`userTextDark` hardcoded assertion for default)
- `__tests__/screens/AskRosebudReachable.test.tsx` (mock shape fix)
- `AGENTS.md` (rule 9 expanded)
- `PROGRESS.md`, `memory.md`

## Risks, Tradeoffs, Open Questions

1. **NativeWind v4 + CSS-var pattern.** Verified by reading `node_modules/nativewind/dist/tailwind/{color,native,web}.js`, `tailwindcss/lib/util/{withAlphaVariable,color}.js`, and `react-native-css-interop/dist/runtime/native/api.js`. The `rgb(var(--color-*-rgb) / <alpha-value>)` form is the correct alpha-capable pattern; the `vars()` API is the correct runtime-injection API. If the project's `nativewind` version ever upgrades past v4.2.1, re-verify these APIs (the contract is stable per Nativewind v4.x but check the changelog).
2. **Curated text shade is opinionated.** Some users may want a free-form hex picker. That's deliberately out of scope here — it would break AGENTS.md rule 1. If you want a "Custom → type your hex" escape hatch, do it in a follow-up plan and require the user to confirm a contrast warning.
3. **Two new AsyncStorage keys.** The repo now has 4 keys for appearance (`user-theme-preference`, `user-emoji-preference`, `user-palette-preference`, `user-text-shade-preference`). A future cleanup could consolidate them into a single `user-appearance-preference` envelope, but that's a separate refactor — doing it here would expand scope.
4. **`<Text>` visibility in dark mode** (AGENTS.md rule 1) — the palette override is additive to the `dark:` variant. Components using `bg-primary` on dark mode will pick up the dark palette accent automatically. The `dark-mode-contrast.test.ts` guard still catches bare `<Text>` without `dark:` variants — it does not need to be updated, just kept green.
5. **Supabase migration ordering.** Migration filenames are timestamp-prefixed. Use `20260611000001_…` to ensure it runs after `202601240001_init.sql`. Never edit the original migration.
6. **Surface tinting** is deferred. `surface-dark` stays hex. A future plan can re-point it to a CSS var and add per-palette `surfaceTintDark` once a use case is clearer.
7. **Custom hex editor** (out of scope). A future plan could add a "Custom" palette backed by per-token AsyncStorage values, layered on top of the registry. The `getPalette('custom')` shape can become a function in a follow-up; today's `Record<string, ColorPalette>` becomes `Record<string, ColorPalette | (() => ColorPalette)>`.
8. **System mode resolution.** `ThemeProvider` receives the raw `mode` (which may be `'system'`) and internally resolves to `'light' | 'dark'`. The hook continues to call `setColorScheme(...)` from NativeWind for the `dark:` variant resolution; CSS-var injection is independent. This is intentionally a dual-track setup: NativeWind handles `dark:foo` classes; `ThemeProvider` handles accent palette + text shade. Both work simultaneously.
9. **AI text customization depth.** For MVP, AI text is palette-baked. If users ask for "let me pick the AI text color separately from the palette", that's a follow-up — add a `chatOverrides: { aiText?: string; userText?: string }` field to a future expanded preference shape.
10. **Body text in chat messages.** The chat message bubbles use `text-user-text` / `text-user-text-dark` / `text-ai-text` (palette-controlled), not `text-text-light` / `text-text-dark`. So the "Text Shade" picker does NOT retint chat message text — only the surrounding UI (Settings, Today, etc.). This is intentional: chat text has its own visual identity and is a "feature color", not a body color. If you want text shade to also affect chat, switch the chat bubbles from `text-ai-text` to a new `text-chat` token and route that through the text shade too — separate plan.
11. **Test mock coupling.** The `useThemeSettings.test.ts` mock of `nativewind` had to be updated to include `colorScheme: 'dark'` because the new code in `app/(tabs)/settings.tsx` reads the resolved mode. This is fragile — any future change to the `useColorScheme` return shape will require updating both mocks. Add a comment in the test file explaining the dual-purpose mock.

## Execution Handoff

Plan complete and saved to `.hermes/plans/2026-06-11_230620-flexible-color-palette-architecture.md`.

Verified offline against `node_modules/nativewind@4.2.1` and `node_modules/react-native-css-interop@0.2.1`:
- `vars()` is the official runtime CSS-var injection API (confirmed in `react-native-css-interop/src/__tests__/vars.test.tsx` and `dist/runtime/native/api.js`)
- `rgb(var(--x-rgb) / <alpha-value>)` is the alpha-capable CSS-var pattern (confirmed in `tailwindcss/lib/util/withAlphaVariable.js` + `parseColor.js`)
- Dark mode cascade works via `.dark` class + `:root` / `.dark` CSS rules (already in `tailwind.config.js:2`)

Ready to execute using `subagent-driven-development` — I'll dispatch a fresh subagent per task with two-stage review (spec compliance then code quality). Shall I proceed?
