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
| `site/dex-header.png` | 1500 × 500 DexScreener header: existing logo, EXPERIMENTAL ERROR and $OOPS on the site's dark chalkboard background. Copied unchanged to `dist/dex-header.png`. |
| `scripts/render-dex-header.mjs` | Optional offline banner renderer using the existing site styles, logo, fonts and Playwright. |
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
subpath or an ENS name), keeps asset file names stable, and copies `site/assets/`,
`site/dex-header.png` and `site/simd-coin.json` verbatim into `dist/` so the same relative paths work in both trees.
Both `index.html` and `404.html` are build inputs.

The banner is already saved; normal builds only copy it. To regenerate it after changing the
logo or design tokens, install Chromium once with `npx playwright install chromium`, run
`node scripts/render-dex-header.mjs` from the repository root, then rebuild. The renderer reads
only local assets and accepts the same `OOPS_CHROMIUM` executable override as the checks.

## Publish

Hosting is handled by the si-md.xyz plane: it pins the committed `dist/` directory and names it
`experimentalerror.si-md.xyz`. To publish a change:

1. Edit the source in `site/`.
2. Run `npm run typecheck && npm run build`.
3. Include the updated source, `scripts/`, `dist/`, configuration, package manifest and lockfile together in the submission.

Do not commit `node_modules/`. Nothing in the export needs a backend, a wallet library or a
private key. The data feed path `/simd-coin.json` is provided by the host origin.

### Updating the logo or the data snapshot

- Logo: replace `site/assets/logo.webp` (keep the name; the hero, nav, toasts, meme wall and
  OG image reference it). Regenerate `favicon.png`, `apple-touch-icon.png` and `og.png` if the
  artwork changes, and regenerate `site/dex-header.png` with the command above.
- Snapshot: overwrite `site/simd-coin.json` with a fresh copy of the feed, then rebuild.

## Validation summary

Banner revision validation, 2026-10-12 (full record in `artifacts/validation.md`):

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | passed, no errors |
| Production build | `npm run build` | passed, `dist/` written |
| Browser regressions | `test/revision.mjs` (the `npm run check` script; serves `dist/` under `/preview/`) | 9 groups passed, 0 failed |
| DexScreener header | Offline renderer plus PNG signature/dimensions, byte equality and HTTP checks | 1500 × 500; source/export identical; 649,669 bytes each; visual review completed |
| Caption advisory | Peer review with 60 A / 60 I characters at 390 × 844 and 1440 × 844 in Chromium 155.0.8059.12 | not reproduced; captions fit, valid PNG downloaded; generator unchanged |
| Responsive navigation | Chromium at 320, 360, 375, 390, 768, 1152, 1153, 1180, 1248, 1249, 1280, 1440 and 1920 CSS px | no horizontal overflow; brand/actions fit; menu and Escape work |
| Export integrity | Relative assets served under `/preview/`, both pages loaded; title/meta/favicon, image and anchor checks | passed; healthy-feed pages had no failed resources or uncaught page errors |
| Console/resource check | Both HTML pages at 375px and 1440px, healthy fixture | zero console errors, failed resources or page errors; images decoded; no overflow |
| Submission size | All delivery files plus existing Git history and 64 KiB metadata allowance | conservative bound below 4 MiB; within the 8 MiB limit; no dependency/cache archives or submodules |

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

The previous accepted revision addressed seven findings. This revision fixes the missing banner;
the caption advisory did not reproduce. The regression checks still cover initial feed failure,
recovery, successful refreshes, later failure, changing URLs, null tokenomics, duplicate segments,
animated price/market cap/volume, reduced motion, correct clipboard fallbacks, all eight generator
templates with long captions and 1200 × 1200 PNG downloads, Peer review wall export, menu/anchor
navigation, keyboard tabs, lab counter/fact/meter, share intents, metadata, resources and 404.

To respect the repository's dependency-directory restriction during this run, installation,
typecheck and build ran in an isolated `/tmp/oops-banner-tools` copy with the same manifest,
lockfile and source. Its export was copied to `dist/`, then the regression check ran directly
against that repository export. No dependency/cache directories or npm archives were added here.

Known limitations: no real screen-reader session, no physical device test, no native 200% zoom
check, and Chromium only. External X/pump.fun/DexScreener services were not audited or transacted
with in this revision. The local feed snapshot and existing fallback policy are unchanged; local
checks do not certify hosted market-data freshness. The feed exposes no X or Telegram account,
so the community section links to an X search and offers share intents.

### Better Interface review for this revision

Read the pinned workflow and all six domains; applied them to the new banner and the reported
caption state. Existing page design and behaviour were preserved. Findings and evidence:

- **Fixed, high:** missing `site/dex-header.png` (the previous inventory at `README.md:17`
  omitted it). The banner now exists, and `vite.config.ts:21` copies it on every production build.
  PNG size, source/export equality and delivery under `/preview/` passed.
- **Not reproduced, advisory:** `site/app.js:687`, caption width fitting. In Chromium
  155.0.8059.12, Peer review with 60 A / 60 I characters fits at both reported widths. The bottom
  caption including stroke spans x=57.29–1145.15 at 390px and x=57.00–1143.98 at 1440px within
  its 1200-unit frame. The 390px screenshot was inspected; a 1200 × 1200 PNG downloaded.
  No application rendering change was made; other browser versions may render differently.

| Domain | Coverage and limits |
| --- | --- |
| Accessibility | Checked existing keyboard menu, skip link, steps, clipboard feedback and reduced-motion regression paths. The static banner adds no controls. No screen-reader session, full automated accessibility audit or forced-colors review. |
| Layout | Checked banner bounds and visual composition; first-screen title/Buy action at 390; no page overflow across the 13 tested widths. Visually inspected mobile and desktop screenshots. No native zoom or physical device test. |
| Writing | Checked the banner's exact name/ticker and absence of small text or new claims. Existing interface copy retained. |
| Typography | Checked loaded local Lilita One, large banner type, and the reported narrow-character caption case. Existing eight-template caption/PNG regressions passed. |
| Colors | Reused site tokens. Computed solid pairs: chalk/page 13.56:1, lime/page 13.00:1, ink/pink 6.60:1. These are token contrasts, not an exhaustive measurement of composited grain or gradients. |
| UI | Checked the static sticker/outline treatments visually and reran existing interaction-state regressions. No new motion or controls; no animation-panel slow-motion review. |

Guidance attribution: Better Interface by Jakub Krehel (MIT), pinned commit
`267330e1adfc66a718fb65fa6918c1f06d0a689e`; documentation method adapted from Paul Bakaus's
Impeccable (Apache-2.0), pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`.
The review is complete for this bounded revision, subject to the limitations above.
