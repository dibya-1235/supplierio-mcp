import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: [
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' },
    ],
  },
});
