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
      include: [
        'src/core/**/*.ts',
        'src/messaging/**/*.ts',
        'src/adapters/**/*.ts',
        'src/ui/controller/**/*.ts',
      ],
      exclude: ['**/*.test.*', '**/*.d.ts'],
      // Set just below current coverage so regressions fail CI. Branch coverage is
      // lower because noUncheckedIndexedAccess forces many `?? ''` fallbacks
      // that cannot be reached.
      thresholds: { lines: 90, statements: 88, functions: 87, branches: 75 },
    },
  },
});
