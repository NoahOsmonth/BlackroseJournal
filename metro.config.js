const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// SDK 54 + React Native 0.81 compatibility settings
config.transformer.unstable_allowRequireContext = true;
config.resolver.unstable_enablePackageExports = true;

// Support for .cjs files (required by some deps)
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// phosphor-react-native@3.0.2 ships `react-native: src/index.tsx` but does not
// publish `src/` — only `lib/`. Metro would otherwise fail release bundles.
const phosphorEntry = path.resolve(
  __dirname,
  "node_modules/phosphor-react-native/lib/module/index.js"
);
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "phosphor-react-native") {
    return { filePath: phosphorEntry, type: "sourceFile" };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Logging for debugging
console.log('[Metro Config] Starting with config:', {
  projectRoot: __dirname,
  transformer: Object.keys(config.transformer || {}),
  resolver: Object.keys(config.resolver || {}),
});

module.exports = withNativeWind(config, { input: "./global.css" });
