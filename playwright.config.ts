import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: [{ command: 'node --import tsx scripts/test-server.ts', url: 'http://127.0.0.1:8788/api/health', reuseExistingServer: false }, { command: 'npm run build:live && npm run preview -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120000 }],
})
