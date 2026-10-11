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

## Install

Requires Node 20 or newer (built with Node 24, npm 11).

```bash
npm install
```

Dependencies are development-only: Vite (bundles `site/` into `dist/`) and TypeScript (type-checks
the JavaScript through JSDoc annotations). The site itself has zero runtime dependencies.

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

Commands run on the final source (full record in `artifacts/validation.md`):

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | passed, no errors |
| Production build | `npm run build` | passed, `dist/` written |
| Export integrity | `node test/scratch/check-dist.mjs` (meta tags, relative asset URLs, alt text, footer line, contract, no wallet libs or trackers) | all checks passed |
| Browser | Playwright-driven Chromium against the served `dist/` at 320, 390 and 1440 CSS px | no console errors, no failed resources, no horizontal overflow; interactions exercised |

Interactions exercised in the browser: live stats loaded from the feed, mobile menu open/close and
anchor navigation under the sticky nav, how-to-buy tabs, copy contract address, experiment button
(OOPS counter, vibe meter, fact, confetti), meme generator PNG export (1200 × 1200 PNG verified),
meme wall PNG export, keyboard focus walk (skip link, visible focus ring), reduced-motion emulation,
404 page.

Known limitations: no real screen-reader session, no physical device test, no native 200% zoom
check, external X/pump.fun/DexScreener destinations opened but not audited. The feed exposes no X
or Telegram link for this coin, so the community section links to an X search for the ticker and
offers share intents instead of claiming an official account.
