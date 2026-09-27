/**
 * NODE_ENV must be `test` before Jest transforms a single file.
 *
 * `babel-preset-expo` inlines `process.env.NODE_ENV` and `process.env.EXPO_PUBLIC_*`
 * at *transform* time, and this repo is developed inside a shell that exports
 * `NODE_ENV=production`. Two concrete consequences when that leaks in:
 *
 *  - React resolves to `react.production.js`, which does not export `act`, so
 *    every `@testing-library/react-native` render throws.
 *  - React Native's own `AnimatedProps` guard (`if (process.env.NODE_ENV === 'test')`)
 *    is baked to the string `'production'`, so a TouchableOpacity opacity
 *    animation that cannot find its host view throws instead of degrading.
 *
 * Setting it here (the main Jest process, before workers are forked) is the only
 * point early enough: `setupFiles` runs after transforms.
 */
process.env.NODE_ENV = "test";

module.exports = {
    preset: "jest-expo",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
    testPathIgnorePatterns: [
        "/node_modules/",
        "/__tests__/mocks/",
    ],
    modulePathIgnorePatterns: [
        "<rootDir>/.worktrees/",
    ],
};
