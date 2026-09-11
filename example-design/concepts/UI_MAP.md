# Production UI Map — Blackrose Journal

Source of truth: `app/` routes + components. Prototypes in `example-design/` are visual refs only.
Inventory screenshots: `example-design/concepts/inventory/` (prototypes) and `.../inventory/production/` (live Expo web when available).
Blackrose redesigns: `example-design/concepts/` and `example-design/concepts/generated/`.

## Tab shell

| Tab | Route | Screen | Contents |
|---|---|---|---|
| Today | `/(tabs)/today` | TodayScreen | Weekday selector, streak, morning/evening ritual cards, my intentions, today's goals, entry insights, personalize |
| Explore | `/(tabs)/explore` | MemoryHubScreen | Portrait (“About you”), themes, layer filters, search, notes panel, atom list, open graph |
| Entries | `/(tabs)/entries` | EntriesScreen | Journal history list (filters, drafts entry, entry cards) |
| Insights | `/(tabs)/insights` | InsightsScreen | Week letter (locked/unlocked), writing presence, moods chart, key themes, cast of characters, ask row |
| Settings | `/(tabs)/settings` | SettingsScreen | Accordion sections (below) |

Custom `BottomNav` (not system tabs): Today · Explore · + FAB (chat) · Insights · History/Settings depending on wiring.

## Stacked / modal routes

| Route | Purpose | Key UI |
|---|---|---|
| `/chat` | Freeform journal chat | Persona chip, typewriter AI text, write surface, finish/suggest, drafts link |
| `/drafts` | Unfinished sessions | Flow labels, excerpt, restore/delete |
| `/goals` | Goals & Habits | Today goals + habits lists, quick-add modal |
| `/memory-graph` | Constellation graph | Filters (layer chips, time slider), canvas WebView, **node tap → sheet** |
| `/ask-rosebud` | Ask AI over entries | Time range cycle, suggested questions, typing indicator, chat thread |
| `/saved-insights` | Bookmarked insights | List with remove animation |
| `/rewards` | Streak & achievements | Streak stats, achievement grid, detail modal |
| `/streak-view` | Streak detail | Calendar / streak visualization |
| `/streak-haiku` | Streak celebration | Haiku card |
| `/suggestions` | Prompt suggestions | Card list |
| `/happiness-recipe` | Derived recipe view | Recipe content |
| `/entry-detail` | Single journal | Title, user transcript, analysis panel (backfill AI) |
| `/entry-reflection` | Post-finish reflection | Reflection copy, feedback thumbs, comment modal |
| `/checkin-detail` | Single check-in | Type label, last transcript messages |
| `/intentions/select` | Area picker | Compass prompt + area list |
| `/intentions/detail` | Intention detail | Hero, description, related check-ins, resume CTA |
| `/intentions/chat` | Guided check-in chat | Header/footer overlays, finish path |
| `/intentions/edit` | Edit intention | Form |
| `/persona/new` | Create persona | Avatar, name, tagline, voice, personalization |
| `/persona/[id]` | Edit persona | Same form |
| `/persona/advanced` | Advanced persona | Model, imagination slider, etc. |
| `/persona/generate` | AI-generate persona | Generate input |
| `/login` `/signup` `/forgot-password` `/update-password` | Auth | Forms |

## Settings accordion (real production)

1. **Appearance** — theme (light/dark/system) + emoji style (native/flat/3D)
2. **Color Studio** — color theme presets + custom picker modal
3. **Generation** — temperature/topP presets
4. **AI Model** — custom OmniRoute provider, model picker, free-only
5. **Data Management** — backup, restore, export JSON, clear history, demo seed (dev)
6. **Identity** — always-on identity profile rows + pending confirm/dismiss
7. **Memory** — atom count, open Memory Hub
8. **Account** — email, sign in/up/out, forgot password
9. **About** — version, about, privacy

## Interactive / detail states (must design)

| State | Where | What appears |
|---|---|---|
| Graph node selected | Memory graph | Bottom sheet: title, layer chip, source, date, content, tags, **At a glance**, source card, **Linked stars** list, **Deeper read**, **Deepen with AI** CTA |
| Graph filters | Memory graph | Episodic/Semantic/Profile chips, time slider, search |
| Week letter locked | Insights | “Unlocks Saturday / Requires N more entries” |
| Week letter unlocked | Insights | Weekly summary letter + write CTA |
| Moods unlocked | Insights | Emotional landscape chart (emoji style dependent) |
| Insights ask | `/ask-rosebud` | Range chip, suggested Qs, typing dots |
| Persona sheet | Chat | Choose persona carousel + active state |
| Persona settings sheet | Persona | Voice, model, advanced |
| Entry analysis | Entry detail | AI analysis panel (loading + filled) |
| Feedback | Reflection / chat | thumbs up/down + comment modal |
| Color picker modal | Settings → Color Studio | Sliders for accent tokens |
| Achievement modal | Rewards | Achievement detail |
| Notes panel | Explore | Add note / generate note |
| Empty states | Many | EmptyState component |
| Skeletons | Loading | Per-screen skeletons |

## Blackrose redesign status

| Screen | Concept generated |
|---|---|
| Today (quiet) | yes |
| Chat (correspondence) | yes |
| Archive/History | yes |
| Insights | yes |
| Threads/Graph | yes |
| Graph node sheet | **needed** |
| Drafts | yes |
| Intention detail | yes — `generated/black-rose-intention-detail.png` |
| Intention picker | yes — `generated/black-rose-intention-picker.png` |
| Persona | yes — `generated/black-rose-persona.png` |
| Settings | yes — `generated/black-rose-settings.png` |
| Explore / Memory hub | yes — `generated/black-rose-memory-hub.png` |
| Goals & Habits | yes — `generated/black-rose-goals.png` |
| Ask companion | yes — `generated/black-rose-ask.png` |
| Entry reflection | yes — `generated/black-rose-entry-reflection.png` |
| Rewards / streak | yes — `generated/black-rose-rewards.png` |
| Auth (login) | yes — `generated/black-rose-login.png` |
| Graph node sheet | yes — `generated/black-rose-graph-node-sheet.png` |
| Entry detail (read view) | optional next |
| Light mode variants | optional later |

### Live production capture note
Expo web on `:8081` redirects most unauthenticated routes to `forgot-password`. Screenshots in `inventory/production/` only reliably captured intention-select/chat/edit, persona-new/advanced, signup, forgot-password. Authenticated screens were mapped from source (`app/`, `components/settings`, `components/memory-graph`, `components/memory`).

## Shared Blackrose system

- Void `#0C0C0E` · surface `#151518` · hairline `#2C2A26`
- Ivory `#EDE8E0` · muted `#8A8580` · bone `#C9C2B6`
- Optional sage done `#7A9E7E`
- Tabs: Today · Threads · Insights · Archive + compact write
- No flame streak, no emoji primary tiles, no rainbow graph, no center pencil FAB
- AI: complete thoughts, left rule, thinking dots — not typewriter
