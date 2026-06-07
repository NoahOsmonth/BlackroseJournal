// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Expo inlines every EXPO_PUBLIC_* var at build time, so a *_KEY /
    // *_SECRET / *_TOKEN with that prefix lands in the mobile bundle. The
    // companion envBundleSafety.test.ts documents the approved exceptions.
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^EXPO_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN)\\s*=/]",
          message:
            "EXPO_PUBLIC_*_KEY/_SECRET/_TOKEN vars need explicit approval. See envBundleSafety.test.ts.",
        },
      ],
    },
  },
]);
