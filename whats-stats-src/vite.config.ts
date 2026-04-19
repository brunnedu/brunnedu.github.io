import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/whats-stats/',
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'src/lib'),
    },
  },
  build: {
    outDir: '../whats-stats',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/plotly.js-dist-min')) return 'plotly';
        },
      },
    },
    chunkSizeWarningLimit: 6000,
  },
});
