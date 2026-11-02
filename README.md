# blackrosejournal 📝

A React Native/Expo chat journal application with AI integration.

## Get Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure local AI environment variables

   Copy `.env.example` to `.env` and set your provider. These are a **first-run
   seed only** — once the app has launched, the provider you saved in
   Settings → AI Model is the source of truth:

   - `EXPO_PUBLIC_AI_CUSTOM_API_KEY` (your OpenAI-compatible provider's key)
   - `EXPO_PUBLIC_AI_CUSTOM_BASE` (e.g. `https://your-host/v1`)
   - `EXPO_PUBLIC_AI_CUSTOM_MODEL`
   - `EXPO_PUBLIC_AI_CUSTOM_FLASH_MODEL` (optional; falls back to the model above)

   Any OpenAI-compatible endpoint works — no vendor host, key or model id is
   baked in. Leave them blank to configure everything in-app instead.
   The key is bundled into local device builds, so keep `.env` uncommitted and
   use this setup only for the local phone build you control.

3. Start the app

   ```bash
   npm run start
   ```

In the output, you'll find options to open the app in a:

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Project Structure

This project follows a modular, separation-of-concerns (SoC) architecture:

```
├── app/                  # Routes & screens (thin, render + wiring only)
│   ├── index.tsx         # Main chat screen
│   ├── _layout.tsx       # Root layout
│   └── modal.tsx         # Modal screen
├── components/           # Reusable UI and composite components
│   ├── ui/               # Atomic UI primitives (buttons, icons, etc.)
│   ├── ChatMessage.tsx   # Chat bubble component
│   ├── Header.tsx        # App header
│   └── ...
├── features/             # Feature modules (self-contained features)
│   └── chat/             # Chat feature module
│       ├── hooks/        # Chat-specific hooks
│       ├── types.ts      # Chat types
│       └── index.ts      # Public API
├── hooks/                # Shared hooks (state, color scheme, etc.)
├── services/             # API/AI/network/storage integrations
├── constants/            # Theme and static configuration values
│   └── theme.ts          # Colors, fonts, and style constants
└── __tests__/            # Jest tests
```

### Folder Ownership

| Folder | Responsibility |
|--------|----------------|
| `app/` | Routes + screens. **No heavy business logic.** Keep thin. |
| `components/` | Reusable UI and composite components. |
| `components/ui/` | Small, atomic UI primitives only. |
| `features/<name>/` | Self-contained feature modules with own hooks/components. |
| `hooks/` | Shared hooks for state, data-flow, side-effects. |
| `services/` | API, AI, network, storage integrations. |
| `constants/` | Theme values and static configuration. |

### When to Create a Feature Folder

Create `features/<feature>/` when:
- The feature has its own state management (hooks)
- The feature has multiple related components
- The feature's code is cohesive and could be extracted independently

## Separation of Concerns (SoC)

This project enforces strict SoC boundaries:

- **UI components** render views and call hooks — they do NOT call services directly.
- **Hooks** manage state and orchestrate side effects — they MAY call services.
- **Services** perform I/O (API calls, storage) — they do NOT import UI.
- **Utilities** are pure functions with no side effects.

```
UI (components) → Hooks → Services → External APIs
```

## Quality Gates

Before committing, run these checks to ensure code quality:

```bash
# Lint the codebase
npm run lint

# Run all tests
npm test -- --runInBand

# Check design/UI file size limits (per AGENTS.md)
npm run check:design
```

### Design/UI File Limits

Per `AGENTS.md`, design/UI files must stay within these limits:

| Metric | Target | Warning | Hard Max |
|--------|--------|---------|----------|
| Design/UI files | 200–500 lines | ≥ 450 lines | 500 lines |
| Components | < 200 lines | — | 200 lines |
| Functions | 5–15 lines | — | 15 lines |
| Line width | 80–120 chars | — | 120 chars |

Design/UI files include: `app/**`, `components/**`, `global.css`, `constants/theme.ts`, and theme/style helpers.

## Testing Requirements

Every change must include **new or updated tests**:

- Use user-centric assertions (visible text, accessibility labels)
- Test success and failure paths
- Keep snapshots small and intentional
- If a test isn't feasible, document why in `PROGRESS.md`

Run targeted tests when possible:

```bash
# Run specific test file
npm test -- __tests__/ChatScreen.test.tsx

# Run all tests
npm test -- --runInBand
```

## Versioning and releases

This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(`MAJOR.MINOR.PATCH`). While the app is pre-1.0, breaking changes bump `MINOR`
and features/fixes bump `PATCH`.

### Where the version lives

The version is stored in two places and **both must change together** — Expo
reads `app.json`, and everything else (the Settings → About summary, the
`v…` label in the UI) reads the same value through `expo-constants`:

| File | Field | Read by |
|------|-------|---------|
| `package.json` | `version` | npm, tests, tooling |
| `app.json` | `expo.version` | Expo/EAS builds, `constants/appInfo.ts` (`APP_VERSION`) |

`CHANGELOG.md` records every release in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Add your
changes under `## [Unreleased]` as you work, and move them into a new
`## [X.Y.Z]` heading when you cut the release.

### Cutting a release `vX.Y.Z`

1. Decide the bump from the changes since the last tag
   (`git log $(git describe --tags --abbrev=0)..HEAD`; for the very first
   release, read the whole history instead).
2. Set the same version in `package.json` and `app.json` (`expo.version`).
3. In `CHANGELOG.md`, turn `## [Unreleased]` into `## [X.Y.Z] - YYYY-MM-DD`, leave
   a fresh empty `## [Unreleased]` above it, and point the link refs at the new tag.
4. Run the quality gates above and commit (`chore(release): vX.Y.Z`).
5. Tag and publish. The release notes are the changelog entry for that version,
   so put it in a scratch file first (it is not committed), tag from it, and let
   `gh` reuse the tag annotation as the release body:

   ```bash
   git tag -a vX.Y.Z -F release-notes.md   # the [X.Y.Z] section of CHANGELOG.md
   git push origin vX.Y.Z
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-from-tag
   ```

   Then delete `release-notes.md`.

### Android versionCode is owned by EAS

`eas.json` sets `cli.appVersionSource: "remote"`, so the Android `versionCode`
lives on EAS's servers, not in this repo — `expo.version` above is the
user-facing version name only. The `production` build profile also sets
`autoIncrement: true`, so every production build gets the next `versionCode`
automatically. **Do not hand-edit a `versionCode`**: there is nothing in the
repo to edit, and a local value would be ignored (or rejected) by EAS.

## Contributing

1. Read `AGENTS.md` for detailed coding standards
2. Follow the SoC architecture (UI → Hooks → Services)
3. Keep files within size limits (`npm run check:design`)
4. Add/update tests for every change
5. Run all quality gates before committing

## Learn More

- [Expo documentation](https://docs.expo.dev/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [NativeWind (Tailwind for RN)](https://www.nativewind.dev/)

## Community

- [Expo on GitHub](https://github.com/expo/expo)
- [Discord community](https://chat.expo.dev)
