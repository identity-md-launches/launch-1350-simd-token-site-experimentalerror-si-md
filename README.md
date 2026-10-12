# EXPERIMENTAL ERROR ($OOPS) · community website

Static, single-page website for EXPERIMENTAL ERROR ($OOPS), a memecoin trading on Solana
(contract `48inyFiUUZSaWRpKT264EYWP3uzWd4q6sXLgbaeMBCPF`, launched on pump.fun).
Published at <https://experimentalerror.si-md.xyz>. Built for the community by the
Identity.md swarm on si-md.xyz. Not financial advice.

## Layout of this repository

| Path | What it is |
| --- | --- |
| `site/` | The source. Plain HTML, CSS and ES-module JavaScript with **no build step**: open `site/index.html` from any static server and it runs as-is. |
| `site/index.html` | The home page (8 sections: hero, story, live stats + lab, how to buy, tokenomics, meme wall, meme generator, community). |
| `site/404.html` | Not-found page in the same style. |
| `site/styles.css` | The design system (tokens, components, responsive rules). |
| `site/app.js` | All behaviour: live data, counters, donut, menu, tabs, copy/share, confetti, draggable sticker, meme wall and generator, PNG export. |
| `site/assets/` | Logo (`logo.webp`, bundled locally from the IPFS CID in the brief), favicon, Apple touch icon, OG image, self-hosted Google Fonts (woff2). |
| `site/simd-coin.json` | Snapshot of the live data feed, used as a fallback when `/simd-coin.json` is not served on the current origin. |
| `dist/` | The committed production export produced by `npm run build`. The publisher serves this directory; it does not rebuild. |
| `DESIGN.md` | Design documentation of the implemented tokens, typography, components and responsive behaviour. |
| `artifacts/validation.md` | Worker validation record: commands run, browser checks, Better Interface review, findings, limitations. |
| `artifacts/screenshots/` | Browser evidence from the final export. |
| `test/revision.mjs` | Repeatable Chromium regression checks for the reported defects and affected interactions. |
| `.imd-responses.json` | Verdict and reproduction/fix details for every revision finding. |

## Install

Requires Node 20 or newer (built with Node 24, npm 11).

```bash
npm ci
```

Dependencies are development-only: Vite (bundles `site/` into `dist/`), TypeScript (type-checks
the JavaScript through JSDoc annotations), and Playwright (interaction checks). The site itself
has zero runtime dependencies. Dependencies and browser downloads are not part of the export.

## Preview

Without a build (the source runs directly):

```bash
npx vite            # dev server for site/, http://localhost:5173
```

Or serve the committed export with any static file server, for example:

```bash
npx vite preview    # serves dist/ at http://localhost:4173
```

The live numbers come from `fetch('/simd-coin.json')` on the same origin. When that path does
not exist (local preview, IPFS gateway subpath), the page falls back to the committed
`./simd-coin.json` snapshot, and if neither is available it shows "see chart" with a link.

## Rebuild

```bash
npm run typecheck   # tsc --noEmit over site/app.js, site/lost.js, vite.config.ts
npm run build       # vite build -> dist/ (base "./", unhashed asset names)
```

`vite.config.ts` uses `site/` as root, `./` as base so every URL is relative (works at a gateway
subpath or an ENS name), keeps asset file names stable, and copies `site/assets/` and
`site/simd-coin.json` verbatim into `dist/` so the same relative paths work in both trees.
Both `index.html` and `404.html` are build inputs.

## Publish

Hosting is handled by the si-md.xyz plane: it pins the committed `dist/` directory and names it
`experimentalerror.si-md.xyz`. To publish a change:

1. Edit the source in `site/`.
2. Run `npm run typecheck && npm run build`.
3. Commit `site/`, `dist/`, `package.json` and `package-lock.json` together.

Do not commit `node_modules/`. Nothing in the export needs a backend, a wallet library or a
private key. The data feed path `/simd-coin.json` is provided by the host origin.

### Updating the logo or the data snapshot

- Logo: replace `site/assets/logo.webp` (keep the name; the hero, nav, toasts, meme wall and
  OG image reference it). Regenerate `favicon.png`, `apple-touch-icon.png` and `og.png` if the
  artwork changes.
- Snapshot: overwrite `site/simd-coin.json` with a fresh copy of the feed, then rebuild.

## Validation summary

Revision validation, 2026-10-12 (full record in `artifacts/validation.md`):

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | passed, no errors |
| Production build | `npm run build` | passed, `dist/` written |
| Browser regressions | `npm run check` (runs `test/revision.mjs`, serves `dist/` under `/preview/`) | 8 groups passed, 0 failed |
| Responsive navigation | Chromium at 320, 360, 375, 390, 768, 1152, 1153, 1180, 1248, 1249, 1280, 1440 and 1920 CSS px | no horizontal overflow; brand/actions fit; menu and Escape work |
| Export integrity | Relative assets served under `/preview/`, both pages loaded; title/meta/favicon, image and anchor checks | passed; healthy-feed pages had no failed resources or uncaught page errors |

Run the checks after rebuilding:

```bash
npx playwright install chromium   # once, outside the production export
npm run check
```

`OOPS_CHROMIUM=/path/to/chrome npm run check` uses an existing Chromium binary.
`OOPS_SITE_DIR=site npm run check` checks the source without a build.
`OOPS_SCREENSHOTS=artifacts/screenshots npm run check` also saves browser evidence.
The check manages its own temporary HTTP server and closes the browser/server when done. It uses
the committed feed as a deterministic fixture, injects failures and calls the actual poll callback
without waiting 30 seconds. Clipboard and X-intent tests simulate browser APIs; they send no posts.

The revision reproduced all seven findings before fixing them. Checks cover initial feed failure,
recovery, successful refreshes, later failure, changing URLs, null tokenomics, duplicate segments,
animated price/market cap/volume, reduced motion, correct clipboard fallbacks, all eight generator
templates with long captions and 1200 × 1200 PNG downloads, Peer review wall export, menu/anchor
navigation, keyboard tabs, lab counter/fact/meter, share intents, metadata, resources and 404.

To respect the repository's dependency-directory restriction during this run, installation,
typecheck and build ran in an isolated `/tmp/oops-revision-tools` copy with the same manifest,
lockfile and source. Its export was copied to `dist/`, then the regression check ran directly
against that repository export. No dependency/cache directories or npm archives were added here.

Known limitations: no real screen-reader session, no physical device test, no native 200% zoom
check, and Chromium only. External X/pump.fun/DexScreener services were not audited or transacted
with in this revision. The local feed snapshot and existing fallback policy are unchanged; local
checks do not certify hosted market-data freshness. The feed exposes no X or Telegram account,
so the community section links to an X search and offers share intents.
