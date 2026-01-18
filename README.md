# JournalApp 📝

A React Native/Expo chat journal application with AI integration.

## Get Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
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
