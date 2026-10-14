import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'entrypoints/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // Coverage targets the pure core and the adapters' pure helpers, not the UI.
      include: ['src/core/**', 'src/messaging/**', 'src/adapters/**'],
      exclude: ['**/*.test.*'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
