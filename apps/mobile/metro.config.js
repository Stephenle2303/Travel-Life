const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../..')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, '../../node_modules')];
// The vetted Replay soundtrack is an offline asset. Metro does not register
// OGG by default, so preserve it in native production bundles.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'ogg'])];
module.exports = config;
