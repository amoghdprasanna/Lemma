import path from 'node:path';
import { defineConfig } from 'vite';

/** Builds the mock Overleaf page script used by the e2e tests. */
export default defineConfig({
  root: import.meta.dirname,
  logLevel: 'warn',
  build: {
    outDir: path.join(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    lib: {
      entry: path.join(import.meta.dirname, 'main.ts'),
      formats: ['iife'],
      name: 'MockOverleaf',
      fileName: () => 'mock.js',
    },
  },
});
