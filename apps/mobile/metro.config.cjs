const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Bundled CC0 Replay soundtrack, decoded by the existing FFmpeg integration.
if (!config.resolver.assetExts.includes('ogg')) config.resolver.assetExts.push('ogg');
module.exports = config;
