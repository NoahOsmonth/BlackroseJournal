# Blackrose Design Rewrite Plan

**Mode: replace, not polish.**  
We are not iterating on the current Rosebud-derived UI. We are swapping the visual system and screen language wholesale while keeping storage, AI, and chat engine intact.

Status: planning only. No production UI changes in this document.

---

## 1. Intent

| In scope | Out of scope |
|---|---|
| Design tokens (both schemes) | Hindsight / OmniRoute / memory algorithms |
| Information architecture labels | Storage keys and service contracts |
| Tab shell + navigation chrome | Auth/business logic |
| Every user-facing screen surface | Backend / data provider |
| Chat presentation (not chat engine) | Rewriting prompts |
| Empty / loading / error chrome | Feature parity expansion |

**North star:** a quiet literary journal companion — charcoal void, bone accents, correspondence chat — not a gamified wellness dashboard.

**Product name in UI:** Blackrose (drop “Rosebud” from user-facing chrome).

---

## 2. Locked design system (source of truth)

Concepts: `example-design/concepts/generated/`  
Map: `example-design/concepts/UI_MAP.md`

### Palette (dark primary; light is first-class, not an afterthought)

| Token | Dark | Light | Role |
|---|---|---|---|
| `bg` | `#0C0C0E` | `#F4F1EB` | App void / paper |
| `surface` | `#151518` | `#FFFDF9` | Cards, sheets |
| `surface-2` | `#1A1A1E` | `#EDE8DF` | Nested / slips |
| `hairline` | `#2C2A26` | `#E2DCD2` | Dividers, borders |
| `text` | `#EDE8E0` | `#1C1917` | Primary ink |
| `text-2` | `#8A8580` | `#6B6560` | Secondary |
| `accent` (bone) | `#C9C2B6` | `#5C564C` | Interactive |
| `accent-strong` | `#EDE8E0` | `#1C1917` | Primary CTA fill contrast |
| `ok` (sage) | `#7A9E7E` | `#4F6F52` | Done / unlocked |
| `danger` | `#C97B7B` | `#9B3A3A` | Destructive only |

Banned as brand chrome: `#FF9F0A` orange, `#E91E63` pink persona, chat blue `#38BDF8`/`#3B82F6` as assistant identity, flame streak red-orange, rainbow memory-layer hexes as primary fills.

Memory graph may keep **restrained** layer differentiation (max 3 families: bone, sage, muted rose-tint) — not the current cyan/purple/pink/yellow/orange/green set.

### Typography

| Role | Face | Use |
|---|---|---|
| Display | Playfair Display (already loaded) | Dates, section titles, screen titles |
| Body | Plus Jakarta Sans | UI chrome, body, chat chrome |
| Mono/data | System mono | Timestamps optional |

Rule: **one serif moment per screen** (title/date). Body and controls stay sans. Do not set whole chat bodies in Playfair.

### Layout language

- Spacing: 4/8/12/16/24/32; `gap-*` only (never `space-y-*` — AGENTS rule 2).
- Radii: 12 (controls), 16 (cards), 28 (sheets).
- Tab bar: **Today · Threads · Insights · Archive** + compact write control (not giant center pencil FAB).
- Settings: stack route or sheet, not a fifth crowded dock icon (map from current Settings tab).
- Chat: user = right slip; companion = left rule + full paragraph; “thinking” = 3 bone dots; **no letter-by-letter typewriter**.

### Motion

- Prefer opacity/translate 150–250ms.
- One signature: gentle fade-in of completed AI paragraphs (optional).
- `prefers-reduced-motion` branch required for any animation.

### Imagery / marks

- Rose mark is a **small line silhouette** (header / empty / splash), not photographic full-bleed heroes on daily screens.
- No emoji as primary intention icons; text rows + hairlines.
- Quill/pen only for write affordance, compact.

---

## 3. Information architecture changes

### Tab rename / remap

| Current | Rewrite | Notes |
|---|---|---|
| Today | **Today** | Same slot |
| Explore | **Threads** | Memory hub + graph entry |
| (FAB chat) | **Write** | Compact, right or center-small — not 72px white + |
| Insights | **Insights** | Same slot |
| History (entries) | **Archive** | Same slot |
| Settings | **Settings** (stack/header) | Leave dock |

Route map (keep Expo paths; change presentation only):

```
/(tabs)/today      → Today
/(tabs)/explore    → Threads (memory hub)
/(tabs)/entries    → Archive
/(tabs)/insights   → Insights
/(tabs)/settings   → Settings
/chat              → Write / freeform correspondence
/memory-graph      → Threads graph + node sheet
/intentions/*      → keep routes, restyle
/persona/*         → keep routes, rename “Rosebud” → “Blackrose” in copy
```

### Copy renames (user-facing)

- “Rosebud” → **Blackrose**
- “History” → **Archive** (nav label)
- “Explore” / “Memory” tab → **Threads**
- “Ask Rosebud” → **Ask**
- Keep intention/check-in product language unless it collides with brand.

---

## 4. What we replace vs keep

### Replace (UI layer only)

| Area | Current | Rewrite |
|---|---|---|
| Tokens | Orange primary, iOS gray light, #0A0A0A dark | Table in §2 |
| BottomNav | Island + huge white + + sun/book icons | Four text-ish tabs + compact write |
| Today | Flame, weekday checks, sun/moon cards, emoji intention tiles | Quiet Today (see concept) |
| Chat chrome | Blue AI text, typewriter, pink persona chip | Correspondence + bone |
| Graph | Rainbow nodes + orange logo | Constellation + bone/sage |
| Node sheet | Layer-color aurora rail | Bone rule + “Linked stars” |
| Insights | Emoji moods as primary, colorful charts | Bone bars, text mood chips |
| Settings | Material icons per row | Quiet accordion rows |
| Persona | Pink lotus / orange avatar | Line rose mark |
| Intention icons | Emoji area list | Text rows |
| Auth | Orange CTAs | Bone CTA / ink on bone |

### Keep (do not rewrite)

- All of `services/**`, `hooks/**`, `features/chat/**` behavior
- Storage key ownership (AGENTS)
- `useChatOrchestration` + `InlineTypingInput` + footer actions structure
- Agent tools / Hindsight soft-fail
- Navigation route names and deep links
- WebView memory-graph **runtime** (engine.html) — only theme tokens pushed via `SET_THEME`

### Prototype policy

- New HTML prototypes go under `example-design/blackrose/**` (new tree).
- Do **not** “update” old `example-design/updated/**` in place — leave as historical Rosebud reference.
- Production never imports `example-design` (AGENTS).

---

## 5. Phased execution (shipable slices)

Each phase is a vertical slice: tokens → shell → screens. Do not start screen porting before tokens land.

### Phase 0 — Freeze + baseline (½ day)

- [ ] Capture current light/dark of Today, Chat, Archive, Insights, Threads, Settings (Playwright on Expo web or device).
- [ ] Record which components hardcode hexes (`rg` for `#FF9F0A`, `#E91E63`, `bg-black`, `text-white` without `dark:`).
- [ ] Add `example-design/blackrose/` folder scaffold.
- [ ] Confirm no worktree requirement conflict (ask user before mutating git main).
- [ ] **Agent rule shipped:** `AGENTS.md` Prototype Validation now requires opening `example-design/concepts/generated/<screen>.png` before any UI port (so other agents can see the target, not just read text).

**Exit:** baseline screenshots + hardcoded-color inventory.

### Phase 1 — Token foundation (1–2 days)

**Files**

- `tailwind.config.js` — add Blackrose token set; mark orange/pink as legacy or remove from default preset.
- `constants/theme.ts` — replace `DEFAULT_COLOR_THEME_COLORS` with Blackrose; add `presetId: 'blackrose'`; keep old `rosebud` preset temporarily for rollback via Color Studio.
- `__tests__/tailwind-config.test.ts`, `__tests__/dark-mode-contrast.test.ts` — update expected hexes.
- Fonts: keep Playfair + Plus Jakarta Sans (already in root layout).

**Rules**

- Every new token needs **both** light and dark values.
- Semantic names: `bg`, `surface`, `text`, `text-2`, `accent`, `ok`, `danger` — not `primary-orange`.
- Contrast: body ≥ 4.5:1, large text ≥ 3:1 (guard test).

**Exit:** `npx tsc --noEmit`, `npm run check:design`, `npm run lint`, theme tests green. App can flip to Blackrose default without screen rewrites looking broken (may still look “old layout, new colors”).

### Phase 2 — Shell: tabs, headers, chrome (2–3 days)

**Replace**

- `components/journal/BottomNav.tsx` — labels/icons/layout per concept; `TabName` stays `'today' | 'explore' | 'entries' | 'insights' | 'settings'` internally; display names Today/Threads/Archive/Insights.
- `components/navigation/AppHeader.tsx` — serif title + quiet actions.
- Shared empty/loading primitives: `EmptyState`, skeletons — bone/hairline, no orange.

**Tests**

- Update `__tests__/components/BottomNav.test.ts`.
- Keep `no-space-utilities` green.

**Exit:** App shell looks Blackrose on all tabs; old screens still may use old cards but inherit new tokens.

### Phase 3 — Primary tabs (4–6 days)

Order: **Today → Archive → Insights → Threads**.

| Screen | Primary files |
|---|---|
| Today | `app/(tabs)/today.tsx`, `components/today/*` |
| Archive | `app/(tabs)/entries.tsx`, `components/history/*` |
| Insights | `app/(tabs)/insights.tsx`, `components/insights/*` |
| Threads hub | `components/memory/MemoryHubScreen.tsx` + children |

**Per screen checklist (AGENTS)**

- [ ] UI only calls hooks (no services imports).
- [ ] Every `Text` has `dark:` variant.
- [ ] File ≤ 500 lines (`npm run check:design`).
- [ ] Light + dark QA.
- [ ] Tests for new components / critical interactions.
- [ ] Empty + loading + error states redesigned.

**Exit:** Four tabs match concepts; no flame/emoji tiles/rainbow on those surfaces.

### Phase 4 — Chat rewrite (presentation only) (3–4 days)

**Shared engine — do not fork** (AGENTS rule 5).

**Files**

- Chat UI shells: `app/chat.tsx`, `app/intentions/chat.tsx`
- Message presentation: `ChatMessage`, `components/ui/TypingIndicator`, intention chat body/footer
- Persona chip: `components/personas/ChatPersonaSheet.tsx`, `PersonaCard.tsx`

**Presentation rules**

1. Companion messages: left bone rule, complete paragraph; stream may still work under the hood but **no per-character typewriter**.
2. Thinking: three bone dots + optional “thinking” label.
3. User: right-aligned `surface-2` slip, no bubble tails.
4. Composer: multi-line, placeholder “Write what’s true…”, quiet send.
5. Footer actions (Finish / Go deeper / Suggest): outline text buttons, not Material orange.
6. “Note: Rosebud can make mistakes” → “Blackrose can make mistakes.”

**Tests**

- Chat flow unit tests still pass (engine untouched).
- Add UI test if message components change contracts.
- Prefer live smoke if prompts/tools touched (they should not be).

**Exit:** Freeform + intention chat share the same Blackrose conversation language.

### Phase 5 — Graph + node sheet (2–3 days)

- `assets/memory-graph/engine.html` — `SET_THEME` palette → void/surface/bone/sage; reduce rainbow.
- `MemoryGraphHeader`, `Filters`, `WebView`, `MemoryGraphSheet`.
- Sheet: bone left rule, Linked stars, Deepen CTA outline/fill per concept.
- Guard: `memoryGraphAsset.test.ts` if it asserts colors.

**Exit:** Graph matches `black-rose-threads.png` + `black-rose-graph-node-sheet.png`.

### Phase 6 — Secondary flows (3–5 days)

| Screen | Notes |
|---|---|
| Settings accordion | `components/settings/*` restyle only; keep section IDs |
| Goals | list rows, no red target |
| Drafts | drop red brand stamps |
| Intentions select/detail/edit | text rows, dark detail (no light-gray iOS) |
| Entry reflection / check-in detail | calm close |
| Ask | correspondence chat reuse |
| Persona create/edit | line mark, no pink lotus |
| Rewards / streak | quiet progress |
| Auth | bone CTA, not orange |
| Saved insights | list |

### Phase 7 — Cleanup + naming (1 day)

- [ ] Remove default orange from active preset; leave `rosebud` as optional legacy theme only if needed for one release.
- [ ] Grep user-facing “Rosebud” and replace.
- [ ] Delete dead styles tied to island FAB / typewriter.
- [ ] Update design tests + `PROGRESS.md`.
- [ ] Final light/dark QA matrix.

---

## 6. Porting method (per screen)

```
1. Open concept PNG in generated/ + UI_MAP row
2. Open production screen source
3. List tokens already in tailwind.config (add missing first)
4. Rewrite presentational components only
5. Keep hooks/props contracts
6. Light + dark screenshot compare
7. Tests + tsc + lint + check:design
8. Mark screen done in UI_MAP
```

Never “fix by adding a new hex in a component.” Token first.

---

## 7. Risk register

| Risk | Mitigation |
|---|---|
| Dual chat surfaces diverge | Only change shared message/composer components |
| Graph WebView ignores theme | Explicit `SET_THEME` bridge (AGENTS); test asset |
| Silent NativeWind drop of tokens | Add tokens to `tailwind.config.js` before use; config test |
| Contrast fail on light paper | Contrast guard test in Phase 1 |
| Scope creep into AI/services | Out of scope table; reject drive-by logic edits |
| File size blowups | Split at 450 lines; `check:design` |
| Working on main worktree | Ask before git mutations (system rule) |
| “Improve current” drift | Reject incremental orange→bone tweaks on old layout; replace layout with concepts |

---

## 8. Definition of done

- [ ] Default theme is Blackrose; light and dark both polished.
- [ ] All mapped screens in UI_MAP have a rewritten production surface (not just a PNG).
- [ ] No user-facing “Rosebud”; no flame streak; no typewriter chat; no giant center pencil FAB; no rainbow graph as default.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run check:design` green.
- [ ] `PROGRESS.md` updated with what shipped + follow-ups.
- [ ] Chat engine, storage keys, AI tools unchanged (diff review).

---

## 9. Suggested first implementation task (after plan approval)

**Phase 1 only:** introduce Blackrose tokens + default preset + contrast/tailwind tests, keep screens’ old layouts.  
Then Phase 2 shell. Do not start Today rewrite until Phase 2 dock exists.

---

## 10. Open decisions (resolve before Phase 2)

1. **Settings in dock vs stack** — concept puts Settings as stack; production currently has Settings as tab. Recommend stack + header gear.
2. **Write control geometry** — compact square quill (right of dock) vs small center pill. Recommend right-aligned compact.
3. **Legacy theme** — keep `rosebud` preset one release for rollback? Recommend yes, non-default.
4. **Tab id names** — keep `explore`/`entries` in code (less churn) vs rename to `threads`/`archive`. Recommend keep ids, change labels only.

---

## Appendix — concept ↔ production file

| Concept | Production focus |
|---|---|
| `black-rose-quiet-today.png` | `app/(tabs)/today.tsx`, `components/today/*` |
| `black-rose-chat.png` | `app/chat.tsx`, chat message components |
| `black-rose-archive.png` | `app/(tabs)/entries.tsx`, `components/history/*` |
| `black-rose-insights.png` | `app/(tabs)/insights.tsx`, `components/insights/*` |
| `black-rose-threads.png` | `MemoryHubScreen`, memory-graph shell |
| `black-rose-graph-node-sheet.png` | `MemoryGraphSheet.tsx` |
| `black-rose-settings.png` | `app/(tabs)/settings.tsx`, `components/settings/*` |
| `black-rose-drafts.png` | `app/drafts.tsx` |
| `black-rose-intention-*.png` | `app/intentions/*` |
| `black-rose-persona.png` | `app/persona/*`, `components/personas/*` |
| `black-rose-goals.png` | `app/goals.tsx` |
| `black-rose-ask.png` | `app/ask-rosebud.tsx` |
| `black-rose-entry-reflection.png` | `app/entry-reflection.tsx` |
| `black-rose-rewards.png` | `app/rewards.tsx` |
| `black-rose-login.png` | `app/(auth)/*` |
