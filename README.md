# shader-study

Learning playground that showcases GLSL fragment shaders with Three.js.  
[https://ubiquitous-o.github.io/Shader-Study](https://ubiquitous-o.github.io/Shader-Study)

## Local Development

```bash
npm install
npm run dev
```

## Thumbnail CLI

Generate 512×512 gallery thumbnails via Playwright + Chromium.

1. Install browser binaries (first run only):
   ```bash
   npx playwright install chromium
   ```
2. Build the app to produce `dist/`:
   ```bash
   npm run build
   ```
3. Capture thumbnails:
   ```bash
   npm run generate:thumbnails -- --force
   ```
   - drop `--force` to keep existing PNGs
   - `--only=id1,id2` limits the set of shaders
   - `--size=1024` changes the resolution
4. Rebuild so the new thumbnails ship with the site:
   ```bash
   npm run build
   ```

## Deployment

Pushes to `main` (or manual dispatch) trigger `.github/workflows/pages.yaml`, which installs Playwright, builds, generates thumbnails, rebuilds, and deploys to GitHub Pages.
