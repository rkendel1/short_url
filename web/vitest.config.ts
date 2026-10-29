import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? '' },
    testTimeout: 20000,
    hookTimeout: 120000,
  },
});
