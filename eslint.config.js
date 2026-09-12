// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // `.pi/**` is the installed agent harness (own runtime, own lint rules) —
    // linting it with this config produced 1445 bogus errors.
    ignores: ['dist/*', 'dist-prod/*', 'backend/dist/**', '.agents/**', '.superpowers/**', 'supabase/.temp/**', '.worktrees/**', '.pi/**'],
  },
  {
    // Playwriter snippets are evaluated by the Playwriter CLI, which injects this
    // sandbox API. They are not standalone ES modules.
    files: ['scripts/e2e/**/*.mjs'],
    languageOptions: {
      globals: {
        state: 'writable',
        context: 'readonly',
        snapshot: 'readonly',
        getLatestLogs: 'readonly',
        importModule: 'readonly',
      },
    },
  },
  {
    // CommonJS entry points executed by `node` (screenshots, tooling), never bundled.
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
      },
    },
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
