const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure react-native-reanimated and other packages are properly resolved
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
