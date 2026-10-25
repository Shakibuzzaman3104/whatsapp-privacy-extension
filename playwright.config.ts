import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  workers: 1,
  timeout: 30_000,
  reporter: 'line',
});
