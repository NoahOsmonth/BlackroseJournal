const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// SDK 54 + React Native 0.81 compatibility settings
config.transformer.unstable_allowRequireContext = true;
config.resolver.unstable_enablePackageExports = true;

// Support for .cjs files (required by some deps)
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Logging for debugging
console.log('[Metro Config] Starting with config:', {
  projectRoot: __dirname,
  transformer: Object.keys(config.transformer || {}),
  resolver: Object.keys(config.resolver || {}),
});

module.exports = withNativeWind(config, { input: "./global.css" });
