import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    globals: true,
    // jsdom globally so component (.test.tsx) render tests have a DOM.
    // Vitest 4 removed `environmentMatchGlobs`; a node-only test can opt out
    // with a `// @vitest-environment node` docblock.
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['test/setup.ts'],
  },
});
