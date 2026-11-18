const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../..')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, '../../node_modules')];
// Metro needs explicit asset types for the Replay soundtrack and landmark model.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'ogg', 'onnx'])];
module.exports = config;
