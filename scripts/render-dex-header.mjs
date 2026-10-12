import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Offline artwork generation only. The website serves the saved PNG as-is.
const site = resolve('site');
let styles = await readFile(resolve(site, 'styles.css'), 'utf8');
for (const match of styles.matchAll(/url\("\.\/assets\/fonts\/([^"/]+)"\)/g)) {
  const font = await readFile(resolve(site, 'assets/fonts', match[1]));
  styles = styles.replace(match[0], `url("data:font/woff2;base64,${font.toString('base64')}")`);
}
const logo = await readFile(resolve(site, 'assets/logo.webp'));
const browser = await chromium.launch({ executablePath: process.env.OOPS_CHROMIUM || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">
    <title>EXPERIMENTAL ERROR ($OOPS) · DexScreener header</title>
    <style>${styles}
      .dex-header { position: relative; isolation: isolate; width: 1500px; height: 500px; overflow: hidden; }
      .dex-header::before { content: ""; position: absolute; inset: 0; z-index: -1;
        background: radial-gradient(ellipse at 18% 54%, rgb(200 255 58 / 0.12), transparent 48%); }
      .dex-scribbles { position: absolute; inset: 0; width: 100%; height: 100%; }
      .dex-logo { position: absolute; left: 100px; top: 25px; height: 450px; width: 300px; object-fit: contain;
        transform: rotate(-5deg); filter: drop-shadow(9px 9px 0 var(--color-ink)); }
      .dex-name { position: absolute; left: 500px; top: 75px; color: var(--color-text);
        font-size: 106px; line-height: 1; text-wrap: nowrap; letter-spacing: -0.01em; }
      .dex-name span { display: block; }
      .dex-name .dex-error { margin-top: 5px; font-size: 174px; color: var(--color-accent);
        text-shadow: 6px 6px 0 var(--color-ink); }
      .dex-ticker { position: absolute; left: 1065px; top: 286px; margin: 0; padding: 8px 24px 14px;
        font-family: var(--font-display); font-size: 98px; line-height: 1; color: var(--color-ink);
        background: var(--color-loud); border: 4px solid var(--color-ink); border-radius: var(--radius-md);
        box-shadow: var(--shadow-sticker); transform: rotate(-6deg); }
    </style></head><body><main class="dex-header" aria-label="EXPERIMENTAL ERROR, $OOPS">
      <svg class="dex-scribbles" viewBox="0 0 1500 500" fill="none" aria-hidden="true">
        <g stroke="var(--color-text)" stroke-width="3" stroke-linecap="round" opacity="0.2">
          <ellipse cx="250" cy="250" rx="207" ry="169" transform="rotate(-22 250 250)"/>
          <ellipse cx="250" cy="250" rx="213" ry="160" transform="rotate(20 250 250)"/>
          <path d="M473 435Q790 410 1020 429M488 447Q741 426 896 439"/>
          <path d="M1340 57l16 19m-19-2 21-16M1374 175l18 22m-22-2 25-19"/>
        </g>
        <g stroke="var(--color-loud)" stroke-width="6" stroke-linecap="round">
          <path d="M408 70l18 11m-6-30 13 4M447 83l4-17"/>
          <path d="M63 364l-18 7m13 9-13 10"/>
        </g>
        <g fill="var(--color-accent)"><circle cx="72" cy="111" r="7"/><circle cx="425" cy="416" r="5"/></g>
      </svg>
      <img class="dex-logo" src="data:image/webp;base64,${logo.toString('base64')}" alt="The lost-in-thought frog scientist">
      <h1 class="dex-name"><span>EXPERIMENTAL</span><span class="dex-error">ERROR</span></h1>
      <p class="dex-ticker">$OOPS</p>
    </main></body></html>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  assert.ok(await page.evaluate(() => document.fonts.check('106px "Lilita One"')));
  const bounds = await page.locator('.dex-name, .dex-ticker, .dex-logo').evaluateAll(elements => elements.map(element => {
    const { x, y, right, bottom } = element.getBoundingClientRect();
    return { x, y, right, bottom };
  }));
  for (const b of bounds) assert.ok(b.x >= 0 && b.y >= 0 && b.right <= 1500 && b.bottom <= 500, JSON.stringify(b));
  const png = await page.screenshot({ type: 'png', animations: 'disabled' });
  assert.equal(png.readUInt32BE(16), 1500);
  assert.equal(png.readUInt32BE(20), 500);
  await writeFile(resolve(site, 'dex-header.png'), png);
  console.log(`Saved site/dex-header.png (1500 × 500, ${png.length} bytes)`);
} finally {
  await browser.close();
}
