import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true
  },
  resolve: {
    alias: {
      '#shared': resolve(__dirname, './src/shared'),
      '#app': resolve(__dirname, './src/app')
    }
  }
});
