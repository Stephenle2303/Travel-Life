const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*']),
  expoConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/diagnostics/app-diagnostics.ts', 'src/**/__tests__/**'],
    rules: { 'no-console': 'error' },
  },
]);
