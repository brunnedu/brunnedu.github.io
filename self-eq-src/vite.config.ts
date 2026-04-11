import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  base: '/self-eq/',
  plugins: [svelte()],
  build: {
    outDir: '../self-eq',
    emptyOutDir: true,
  },
})
