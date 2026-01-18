# BR-001 - Initialize Expo React Native project (latest)

Problem
- The repo currently contains only chatjournal.html. There is no React Native / Expo project to host the UI.

Impact
- UI cannot be run on mobile devices.
- Cannot iterate toward pixel parity with the HTML reference.

Proposed fix
- Initialize a new Expo project in this repository using create-expo-app@latest (TypeScript).
- Keep structure simple and ready for a design-only screen implementation.

Acceptance criteria
- Expo app created with TypeScript and runs via Expo.
- Project has a clear entry point (e.g., app/(tabs) or App.tsx depending on template).
- Dependencies for UI parity are in place (icons, fonts), with minimal footprint.

References
- Visual spec: chatjournal.html

Subtasks
- Create Expo project (latest). Decide whether to use the default or blank TypeScript template.
- Add a src/ folder convention (src/screens, src/components, src/theme) if desired.
- Decide styling strategy:
  - Option A: StyleSheet (RN-native)
  - Option B: NativeWind (Tailwind-like) for faster parity with the existing Tailwind HTML
- Add fonts (Inter) using expo-font and either local assets or expo-google-fonts/inter.
- Confirm icon set choice (MaterialIcons / MaterialCommunityIcons) matches the HTML intent.

Verification
- Unit tests:
  - If jest-expo is configured, add a basic smoke test that renders the root component.
- Smoke:
  - npx expo start
  - Verify app launches and shows a placeholder screen or the target screen shell.
