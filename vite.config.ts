/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes the hosted PWA build in dist/.
// `npm run build:single` makes one self-contained HTML file for test links.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  base: './',
  build: {
    target: 'es2020',
    outDir: mode === 'single' ? 'dist-single' : 'dist',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
