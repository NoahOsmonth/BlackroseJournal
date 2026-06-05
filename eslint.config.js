// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // PR6: SG-1 guard. Expo inlines every EXPO_PUBLIC_* var at build time,
    // so a *_KEY / *_SECRET / *_TOKEN with that prefix would land in the
    // mobile bundle. The companion envBundleSafety.test.ts reads env files
    // and uses the same regex. Both must agree (the test asserts this).
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^EXPO_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN)\\s*=/]",
          message:
            "EXPO_PUBLIC_*_KEY/_SECRET/_TOKEN vars must not be committed. Use AGENT_API_KEY server-side only. See envBundleSafety.test.ts.",
        },
      ],
    },
  },
]);
