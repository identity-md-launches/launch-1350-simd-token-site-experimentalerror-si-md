# DESIGN.md · EXPERIMENTAL ERROR ($OOPS)

Design documentation of the implemented website, extracted from the final source in `site/`.
Everything below names a real token, class or file; nothing is proposed.

## Overview

Audience: the $OOPS community and anyone landing from X or the chart. The brief asked for a loud,
maximalist meme site "crafted like a design studio made it", dark theme, with a palette of
chalkboard green, labcoat white and accidental neon spills derived from the monochrome frog-scientist
logo. The implementation is a single long page with eight sections plus a 404 page.

System-wide rules (apply to any new page):

- Dark chalkboard surfaces, chalk-white text, two loud spill colours (acid lime and pink), ink-black
  3px outlines with hard offset "sticker" shadows on every raised element.
- One display face for headings and big numbers, one text face for everything else, one mono face
  for labels, tickers, addresses and timestamps.
- A 4px spacing scale, concentric radii, and content held inside a 72rem container with
  edge-to-edge backgrounds.
- Motion is opt-in through `prefers-reduced-motion: no-preference` and is removed entirely under
  `reduce`.

Page-specific arrangements (not rules): the hero's two-column grid with floating stickers, the
marquee below the hero, the tilted section stickers, the 2×2 stats grid.

## Colors

Defined in `site/styles.css` `:root`. Components reference semantic tokens only; primitives are
named by hue.

| Semantic token | Primitive | Value | Job |
| --- | --- | --- | --- |
| `--color-bg` | `--green-900` | `#0f2a1f` | Page background (chalkboard) |
| `--color-bg-deep` | `--green-950` | `#08140f` | Sticky nav, inputs, code block, community band, SVG art backgrounds |
| `--color-surface` | `--green-800` | `#173a2c` | Cards, stat tiles, ghost buttons, legend rows, inactive tabs |
| `--color-surface-raised` | `--green-700` | `#215239` | Default `.btn` fill, nav link hover |
| `--color-border` | `--green-600` | `#2c6a4a` | Dashed fact-row separators, `.badge` border, donut track |
| `--color-text` | `--chalk-100` | `#f4f1e8` | Primary text, chalk cards and chalk stickers (labcoat white) |
| `--color-text-muted` | `--chalk-300` | `#d9d4c7` | Section intros, stat labels, hero line, footer |
| `--color-text-faint` | `--chalk-500` | `#a9a496` | Stat footnotes, lab notes, placeholders |
| `--color-accent` | `--lime-400` | `#c8ff3a` | Primary button fill, links, lime stickers, marquee, accent numbers, focus ring |
| `--color-accent-soft` | `--lime-300` | `#dcff7a` | Primary button hover, link hover |
| `--color-loud` | `--pink-500` | `#ff4fb0` | Secondary loud fill: `.btn-loud`, default `.sticker`, ticker, pink numbers, donut slice 2 |
| `--color-loud-soft` | `--pink-400` | `#ff7cc6` | `.btn-loud` hover |
| `--color-ink` | `--ink-900` | `#0a0a0a` | Outlines, sticker shadows, text on lime/pink/chalk |
| `--color-on-accent` | `--ink-900` | `#0a0a0a` | Text on the primary button |
| `--color-focus` | `--lime-400` | `#c8ff3a` | `:focus-visible` outline |

Rules: lime is the single primary-action colour per view (`.btn-primary`); pink marks secondary loud
elements and the lab's experiment button; neither is used for static body text below 20px. Donut
slice colours live in `DONUT_COLORS` in `site/app.js` and follow the same order (lime, pink, chalk,
green-600, lime-300, pink-400).

Solid-color contrast pairs from the accepted initial design review (WCAG 2.x ratio, computed
from CSS values in Chromium): chalk text on page bg 13.56:1; muted text on page bg
10.35:1; faint text on surface 5.03:1; lime on surface 10.62:1; pink on surface 4.17:1 (used only at
display sizes ≥ 20px bold, where 3:1 applies); ink on lime 16.8:1; ink on pink 6.6:1; ink on chalk
17.53:1; lime focus ring on page bg 13:1. The ring sits 3px outside the control, so it is judged
against the surrounding background, never against a lime fill. These are solid-color ratios,
not measurements of every composited grain/gradient pixel. The revision rechecked lime on the
contract card (10.62:1) and ink on the primary fill (16.80:1); see `artifacts/validation.md` for
scoped coverage and limitations.

## Typography

Self-hosted Google Fonts in `site/assets/fonts/`, declared with `@font-face` at the top of
`site/styles.css` (`font-display: swap`, woff2 only, latin subset):

| Role token | Family | Files | Weights available |
| --- | --- | --- | --- |
| `--font-display` | Lilita One, fallback Arial Black / Impact | `LilitaOne-400.woff2` | 400 |
| `--font-text` | Rubik, fallback system-ui | `Rubik-variable.woff2` (variable axis 300–900) | 400, 600, 700, 800 used |
| `--font-mono` | Space Mono, fallback ui-monospace | `SpaceMono-400.woff2`, `SpaceMono-700.woff2` | 400, 700 |

Type scale: six sizes, all in `:root`.

| Token | Value | Used for |
| --- | --- | --- |
| `--text-sm` | 0.875rem | Stat labels, footnotes, nav links, badges, stickers, status lines, small buttons |
| `--text-base` | 1.0625rem | Body, buttons, inputs |
| `--text-lg` | 1.25rem | Section intros, hero line, brand, marquee, step numbers, legend percentages |
| `--text-xl` | 1.75rem | `h3`, hero ticker, donut centre |
| `--text-2xl` | `clamp(2.25rem, 1.5rem + 3vw, 3.5rem)` | `h2`, stat values |
| `--text-3xl` | `clamp(3rem, 1.8rem + 6.5vw, 7rem)` | `h1`, OOPS counter |

The hero title is additionally capped with `min(var(--text-3xl), 13.5vw)` so the word
"EXPERIMENTAL" fits a 320px screen. Headings use `font-weight: 400` (Lilita One has one weight),
`line-height: 1.05`, `letter-spacing: -0.01em`, `text-wrap: balance`. Body uses `line-height: 1.55`
and `text-wrap: pretty`; paragraphs are capped at `--measure: 62ch`. Numbers use
`font-variant-numeric: tabular-nums` through the `.num` class. Stickers are the only uppercase text
(`text-transform: uppercase; letter-spacing: 0.04em` at `--text-sm`); headings are never small
tracked capitals. The contract address uses `overflow-wrap: anywhere`.

## Layout

Spacing scale `--space-1` … `--space-9` = 4, 8, 12, 16, 24, 32, 48, 64, 96px. Within a group use
one step (8–12px); between groups use at least double (`--space-5`/`--space-6`).

- `.container`: `width: min(100% - 2 * var(--space-5), 72rem)`, centred; at ≤ 30rem the inline
  margin drops to `--space-4`. The sticky nav uses a wider 84rem container.
- `.section`: `padding-block: var(--space-8)`, `--space-9` from 60rem. `.section-head` is a grid
  (`gap: --space-3`, `justify-items: start`, `max-width: 48rem`) holding a sticker, an `h2` and an
  intro paragraph.
- Breakpoints are content-driven and written in rem: 26rem (brand text shrinks and the `$OOPS` span
  hides), 30rem, 40rem (stats 1 → 2 columns; hero stickers move inline below 40rem), 48rem (story
  beats 1 → 3 columns), 56rem (hero becomes a 1.2fr/1fr grid and fills the viewport height; buy,
  tokenomics, generator and lab become two columns), 60rem, 78rem (mobile menu through this width,
  inline nav links above it). The content container remains 72rem.
- Meme wall: `repeat(auto-fill, minmax(min(100%, 16rem), 1fr))`.
- All anchored sections carry `scroll-margin-top: calc(var(--nav-height) + var(--space-4))`
  (`--nav-height: 4rem`).
- Overflow: `body { overflow-x: clip }`; the marquee is clipped by `.marquee-wrap`, and the
  draggable sticker is clamped to the hero's bounds in JS.
- Logical properties (`inset-inline`, `margin-inline`, `padding-inline`) are used for
  direction-dependent spacing.

Revision measurements at 320, 360, 375, 390, 768, 1152, 1153, 1180, 1248, 1249, 1280, 1440 and
1920 CSS px found no horizontal scroll. The nav keeps its full brand at the revised breakpoint;
the desktop Buy label fits at 1249px and above. Other widths were not individually inspected.

## Elevation & Depth

Flat tonal layers plus hard "sticker" shadows; no blurred elevation except the open mobile menu.

- `--outline-thick: 3px solid var(--color-ink)` on every card, button, tab, sticker, input, frame,
  nav border.
- `--shadow-sticker: 6px 6px 0 var(--color-ink)` on cards, stat tiles and meme frames;
  `--shadow-sticker-sm: 4px 4px 0` on buttons and stickers. Button hover shifts −2px and grows the
  shadow to 6px; active press shifts +2px, shadow 2px, `scale: 0.96`.
- `--shadow-raised` (soft, layered) only on the dropped-down mobile menu.
- Surfaces step up by tone: page → surface → surface-raised. Chalk cards (`.card-chalk`) invert to
  light.
- Textures: `body::before` fixed halftone dot grid (CSS radial gradient), `body::after` fixed SVG
  fractal-noise grain at 35% soft-light. Both are `pointer-events: none`.
- Stacking: sticky nav z 50, toasts z 60, confetti z 70, grain z 999 (non-interactive), skip link
  z 1000.

## Shapes

- `--radius-sm: 0.5rem` (focus ring corners, menu toggle, skip link), `--radius-md: 1rem` (inputs,
  frames, legend rows, toasts, beat art), `--radius-lg: 1.5rem` (cards, stat tiles),
  `--radius-pill: 999px` (buttons, tabs, stickers, badges, meter track).
- Concentric rule: outer = inner + padding (card 1.5rem around 1rem frames with 0.5rem padding).
- Circles: brand avatar, draggable sticker, legend swatches, donut.
- Tilt: stickers, stat tiles, beats and meme cards accept a `--tilt` custom property (±1–6deg) set
  inline; meme cards straighten to 0deg once revealed.

## Components

All in `site/styles.css`; behaviour in `site/app.js`.

- **Buttons `.btn`** (`<a>` for navigation, `<button>` for actions). Variants: `.btn-primary`
  (lime, the one filled action per view), `.btn-loud` (pink, used for the experiment button),
  `.btn-ghost` (surface), `.btn-sm` (2.5rem tall). All ≥ 3rem tall, pill, outlined, sticker shadow,
  hover lift, press scale 0.96, `:focus-visible` lime ring offset 3px. `.magnetic` adds a pointer
  follow on fine pointers only (`initMagnetic`). `[data-confetti]` triggers `burstConfetti`.
- **Stickers `.sticker`** (pink default, `.sticker-lime`, `.sticker-chalk`), uppercase labels with
  `--tilt`. Decorative: hero stickers are `aria-hidden`.
- **Cards `.card`** and inverted `.card-chalk`; **stat tiles `.stat`** with `.stat-label`,
  `.stat-value` (`.loud` for pink) and `.stat-foot`. Price, market cap, volume and liquidity share
  the 900ms `animateNumber` interpolation; price uses `renderPrice` for compact notation and a
  full-price accessible label. Reduced motion updates immediately. New updates cancel pending
  frames, including when a failed feed clears the values.
- **Sticky nav `.site-nav`**: brand, `.nav-links`, `.nav-actions`. Through 78rem the links collapse
  behind `.menu-toggle` (`aria-expanded`, `aria-controls`, Escape closes, link click closes). A
  `.skip-link` precedes it.
- **Marquee `.marquee-wrap > .marquee > .marquee-track`**: duplicated spans, 28s linear loop,
  static wrapped text under reduced motion.
- **Hero art `.hero-art`**: bouncing `.hero-logo` (`@keyframes bounce`, 1.8s), SVG scribbles,
  and the **draggable sticker `#drag-sticker`** (pointer capture, arrow keys move 12px / 40px with
  Shift, clamped to the hero).
- **Lab**: `#experiment-btn` increments `#oops-count`, drives `#vibe-meter` (`role="meter"`
  with `aria-valuenow`), writes a fact into `#fact-text` (`role="status"`), and every fifth run shows
  a `.toast` in `#toast-region` (polite live region, auto-dismiss after 3.2s, no actions inside).
- **Tabs `.steps-tabs` / `.step-tab` / `.step-panel`**: ARIA tabs with roving tabindex, arrow keys,
  Home/End, and Next/Previous buttons (`initSteps`).
- **Contract box `.contract-box`**: `<code class="contract-address">` plus `#copy-contract`;
  status in `#copy-status` (polite). Shared `copyText` failure handling renders and selects the
  requested value in a `.copy-fallback` code element inside the supplied status. It wraps long
  values and stays selectable; site-link copying uses the same pattern in `#share-status`.
- **Donut `.donut`**: SVG circles with `stroke-dasharray` animated on insert, `.legend` rows and a
  `.facts` definition list (`renderTokenomics`). When tokenomics are unavailable the layout is
  hidden and `#tokenomics-fallback` shows one card linking to the chart. Its DOM is preserved for
  recovery. Each refresh replaces `.donut-segment` circles, legend rows and facts without
  accumulating old segments.
- **Meme wall `.meme-grid > figure.meme-card`**: `.meme-frame` with inline SVG from `TEMPLATES`
  (8 compositions) and a "Download PNG" button that embeds the logo and fonts as data URLs and
  rasterises through an offscreen canvas (`downloadSvgAsPng`).
- **Meme generator `.generator`**: radio `.template-picker` (`:has(:checked)` styling, visible
  focus via `:has(:focus-visible)`), two labelled text inputs (local only, nothing is sent), live
  SVG preview in `#gen-frame`, download and shuffle buttons, status in `#gen-status`. Each input
  accepts 60 characters. `caption` measures SVG text, wraps overlong words, keeps every line and
  reduces the font size to fit its 1200px artboard. Caption bands are y=24–230 at the top,
  y=1030–1176 at the bottom, or y=1080–1176 beneath the Peer review labels; horizontal inset is
  50px including outline. Preview is remeasured after fonts load; export uses the same geometry
  and embeds the fonts and logo. These artboard font sizes are separate from the six UI sizes.
- **Community `.community`**: X search link (replaced by the official account only if the feed
  provides `x`), three share buttons opening prefilled X intents, copy-link button, status line.
- **Footer `.site-footer`**: link list and the required attribution line.
- **404 `.lost`**: logo, `h1`, one line, primary button back home (`site/404.html`).

Loading/empty states: stat values start as "—" and show "see chart" when a number is null; the
status line reports the last update time or a feed failure; tokenomics has the no-data card
described above. `renderCoin` applies links, stats and tokenomics on initial load and every
30-second poll. A failed request to both data sources clears numbers and discloses unavailability;
recovery restores all feed-driven surfaces. Repeated social-link updates reuse one Telegram
element and restore the X-search fallback when an account is absent.

## Do's and Don'ts

- Start a new page from `site/404.html`'s skeleton: skip link, `.site-nav`, `<main>` with
  `.section > .container`, `.site-footer`, the same `<head>` meta block with relative asset URLs.
- One `.btn-primary` per view. Use `.btn-ghost` for peers and `.btn-loud` only for a playful,
  non-financial action.
- Use `--color-*` semantic tokens in components; never apply `--green-*`, `--lime-*`, `--pink-*`
  or `--chalk-*` directly.
- Keep pink and the faint chalk off body-size text; both are tuned for labels ≥ 20px or display sizes.
- Add motion inside `@media (prefers-reduced-motion: no-preference)` or make sure the `reduce` block
  cancels it, and keep decorative layers `pointer-events: none`.
- Every live number comes from `simd-coin.json`; do not hard-code prices, supply or holders.
- Do not add wallet connection, data-collecting forms, trackers, external fonts or scripts; the
  export must stay fully static and relative.
- Do not introduce a seventh type size; reuse the scale or adjust via `min()`/`clamp()` on an
  existing token as the hero title does.

Recipe for one more page: copy `site/404.html`, change title/meta, add `<section class="section">`
blocks with `.section-head` (sticker + `h2` + intro) and `.card`s, link `./styles.css`, add the page
to `rollupOptions.input` in `vite.config.ts`, run `npm run build`, commit `site/` and `dist/`.
