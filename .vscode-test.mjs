// VS Code Extension Test Configuration
// See: https://code.visualstudio.com/api/working-with-extensions/testing-extension
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    files: 'out/test/integration/**/*.test.js',
    mocha: {
        timeout: 20000,
    },
});
