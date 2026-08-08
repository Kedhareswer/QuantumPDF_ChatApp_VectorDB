import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    // Binary payloads Vite must not scan or pre-bundle: liteparse's native
    // .node addon and anydoc's 6MB .wasm. Tests mock both modules, so neither
    // is ever actually loaded.
    server: {
      deps: {
        external: [/@firecrawl\/anydoc-wasm/, /@llamaindex\/liteparse/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.config.{js,ts}',
        '.next/',
        'dist/',
      ]
    }
  },
  optimizeDeps: {
    exclude: ['@firecrawl/anydoc-wasm', '@llamaindex/liteparse'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
