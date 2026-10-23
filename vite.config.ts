import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` makes one self-contained HTML file for test links.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    target: 'es2020',
    outDir: mode === 'single' ? 'dist-single' : 'dist',
  },
}));
