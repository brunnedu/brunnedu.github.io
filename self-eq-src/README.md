# Self-EQ (source)

Browser-based headphone EQ helper (Svelte 5 + Vite + TypeScript).

## Develop

```bash
cd self-eq-src
npm install
npm run dev
```

With `base: '/self-eq/'`, the dev server URL is usually `http://localhost:5173/self-eq/`.

## Production build (GitHub Pages)

Same layout as **Smash Up**: build output goes to **`../self-eq/`** at the repo root (sibling folder). Commit that folder so Pages serves `https://brunnedu.github.io/self-eq/`.

```bash
cd self-eq-src
npm run build
```

Then commit changes under `self-eq/` (static `index.html`, `assets/`, etc.) from the repository root.

## Check

```bash
npm run check
```
