/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { hostedAnalytics, umamiHeadScript } from './src/app/analytics';

/** Puts the Umami tag in the hosted production build. Dev and the playtest file never get it. */
function umamiPlugin(enabled: boolean): Plugin {
  return {
    name: 'umami-prod-only',
    transformIndexHtml(html) {
      if (!enabled) return html;
      return html.replace('</head>', `    ${umamiHeadScript()}\n  </head>`);
    },
  };
}

// `npm run build` makes the hosted PWA build in dist/.
// `npm run build:single` makes one self-contained HTML file for test links.
export default defineConfig(({ mode }) => {
  const analytics = hostedAnalytics(mode, process.env.VERCEL_ENV);
  return {
    plugins: mode === 'single' ? [react(), viteSingleFile()] : [react(), umamiPlugin(analytics)],
    define: {
      'import.meta.env.VITE_ANALYTICS': JSON.stringify(analytics ? '1' : ''),
    },
    base: './',
    build: {
      target: 'es2020',
      outDir: mode === 'single' ? 'dist-single' : 'dist',
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});
