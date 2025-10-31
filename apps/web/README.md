# Overlay & Clash Check (Web)

MVP to align two PDF pages via 2-point similarity transform and produce a raster overlap preview + simple area/bbox metrics.

## Develop

- pnpm install
- pnpm --filter overlay-web dev

Open http://localhost:5179 and use the sample paths under `public/sample` (add your own PDFs).

## Tests

- pnpm --filter overlay-web test

## Build

- pnpm --filter overlay-web build

## Notes

- `alignAndOverlay` currently uses a raster fallback path for overlap metrics. Vector path extraction via pdf.js and boolean clipping can be added later (martinez-polygon-clipping).
- Supply your own sample PDFs at `apps/web/public/sample/base.pdf` and `overlay.pdf` (or change URLs on the page).
