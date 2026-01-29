/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,js}'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/store/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
