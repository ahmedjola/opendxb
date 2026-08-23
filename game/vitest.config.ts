import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vitest does not run the app build, so the build-time flag needs a value.
  define: { __SINGLE_FILE__: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
