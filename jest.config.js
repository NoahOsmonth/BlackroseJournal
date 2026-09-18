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
