import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3101', browserName: 'firefox', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
