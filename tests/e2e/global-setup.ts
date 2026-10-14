import path from 'node:path';
import { build } from 'vite';

/** Builds the mock Overleaf page once before the e2e suite. The extension itself is built by `npm run build`. */
export default async function globalSetup(): Promise<void> {
  await build({ configFile: path.join(import.meta.dirname, 'mock-overleaf/vite.config.ts') });
}
