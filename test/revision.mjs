import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

// The server and browser live only for this foreground command. No production
// test hooks are needed: capture the real 30-second callback and invoke it.
const site = resolve(process.env.OOPS_SITE_DIR || 'dist');
const screenshots = process.env.OOPS_SCREENSHOTS;
const feed = JSON.parse(await readFile(resolve(site, 'simd-coin.json'), 'utf8'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/simd-coin.json' ? resolve(site, 'simd-coin.json') : resolve(site, pathname.replace(/^\/preview\//, '') || 'index.html');
  if (!file.startsWith(site + sep)) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.OOPS_CHROMIUM || undefined });
if (screenshots) await mkdir(screenshots, { recursive: true });
let passed = 0;
let failed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack}`); }
}
async function open(width = 390, initialFeed = feed, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion });
  const page = await context.newPage();
  const state = { feed: initialFeed, requests: 0 };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/simd-coin.json', route => {
    state.requests++;
    return route.fulfill(state.feed ? { status: 200, contentType: 'application/json', body: JSON.stringify(state.feed) } : { status: 503, body: 'Unavailable' });
  });
  await page.addInitScript(() => {
    const interval = window.setInterval.bind(window);
    window.setInterval = (callback, ms, ...args) => {
      if (ms === 30000) { window.__pollCoin = callback; window.__pollDelay = ms; return 1; }
      return interval(callback, ms, ...args);
    };
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      if (blob.type.startsWith('image/svg+xml')) window.__exportSvg = blob.text();
      return create(blob);
    };
  });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => typeof window.__pollCoin === 'function');
  const poll = () => page.evaluate(() => window.__pollCoin());
  return { context, page, state, errors, poll };
}
async function shot(page, name) {
  if (screenshots) await page.screenshot({ path: resolve(screenshots, name), type: 'jpeg', quality: 80, animations: 'disabled' });
}
async function captionState(page, selector = '#gen-frame') {
  return page.locator(selector).evaluate(frame => [...frame.querySelectorAll('text[paint-order]')].map(text => {
    const b = text.getBBox();
    const halfStroke = Number(text.getAttribute('stroke-width')) / 2;
    return { text: text.textContent, x: b.x - halfStroke, y: b.y - halfStroke, right: b.x + b.width + halfStroke, bottom: b.y + b.height + halfStroke };
  }));
}
function assertCaptions(captions, top, bottom) {
  const compact = value => value.toUpperCase().replace(/\s/g, '');
  assert.equal(compact(captions.filter(c => c.y < 600).map(c => c.text).join('')), compact(top));
  assert.equal(compact(captions.filter(c => c.y >= 600).map(c => c.text).join('')), compact(bottom));
  for (const c of captions) {
    assert.ok(c.x >= 45 && c.right <= 1155 && c.y >= 20 && c.bottom <= 1180, JSON.stringify(c));
  }
}
async function png(page, button) {
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), 1200);
  assert.equal(bytes.readUInt32BE(20), 1200);
  return download;
}

try {
  await check('navigation fits through both sides of the breakpoint; mobile first action', async () => {
    const { page, context, errors } = await open();
    for (const width of [320, 360, 375, 390, 768, 1152, 1153, 1180, 1248, 1249, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await page.evaluate(() => {
        const bounds = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        return { scroll: document.documentElement.scrollWidth, width: innerWidth, menu: getComputedStyle(document.querySelector('.menu-toggle')).display, nav: bounds('.nav-actions'), brand: bounds('.brand'), hero: bounds('.hero-actions [data-buy-link]'), title: bounds('h1') };
      });
      assert.equal(layout.scroll, width, JSON.stringify(layout));
      assert.ok(layout.nav.left >= 0 && layout.nav.right <= width, JSON.stringify(layout));
      assert.ok(layout.brand.right < layout.nav.left, JSON.stringify(layout));
      assert.equal(layout.menu === 'none', width > 1248);
      if (width === 390) {
        assert.ok(layout.hero.bottom < 844 && layout.title.bottom < layout.hero.top);
        await shot(page, 'revision-mobile-390.jpg');
      }
      if (width === 1153) await shot(page, 'revision-nav-1153.jpg');
      if (width === 1440) await shot(page, 'revision-desktop-1440.jpg');
    }
    await page.setViewportSize({ width: 1153, height: 844 });
    await page.locator('.menu-toggle').click();
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
    await page.locator('#nav-links a').last().focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'menu-toggle');
    await page.locator('.menu-toggle').click();
    await page.locator('#nav-links a[href="#memes"]').click();
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.ok(await page.locator('#memes').evaluate(el => el.getBoundingClientRect().top >= 64));
    assert.deepEqual(errors, []);
    await context.close();
  });

  await check('initial outage → recovery → repeated refresh → null tokenomics → recovery → outage', async () => {
    const { page, context, state, errors, poll } = await open(390, null);
    assert.equal(state.requests, 2);
    assert.match(await page.locator('#stats-status').textContent(), /unavailable/);
    assert.equal(await page.locator('#tokenomics-layout').isVisible(), false);
    assert.match(await page.locator('#tokenomics-fallback').textContent(), /Supply and holders: see the chart/);
    state.feed = feed;
    await poll();
    assert.equal(await page.locator('#stat-mcap').textContent(), '$3,118.14');
    assert.equal(await page.locator('#tokenomics-layout').isVisible(), true);
    assert.equal(await page.locator('#tokenomics-fallback').isVisible(), false);
    assert.equal(await page.locator('#donut-supply').textContent(), '1B');
    assert.equal(await page.locator('#donut .donut-segment').count(), feed.tokenomics.allocation.length);
    for (const a of await page.locator('[data-chart-link]').all()) assert.equal(await a.getAttribute('href'), feed.chartUrl);
    for (const a of await page.locator('[data-buy-link]').all()) assert.equal(await a.getAttribute('href'), feed.buyUrl);
    await poll(); await poll();
    assert.equal(await page.locator('#donut circle').count(), 1 + feed.tokenomics.allocation.length);
    assert.equal(await page.locator('#legend li').count(), feed.tokenomics.allocation.length);
    state.feed = { ...feed, chartUrl: `${feed.chartUrl}?revision-check`, buyUrl: `${feed.buyUrl}?revision-check`, tokenomics: null };
    await poll();
    assert.equal(await page.locator('#tokenomics-fallback a').getAttribute('href'), state.feed.chartUrl);
    assert.equal(await page.locator('.hero-actions [data-buy-link]').getAttribute('href'), state.feed.buyUrl);
    state.feed = feed;
    await poll();
    assert.equal(await page.locator('#tokenomics-layout').isVisible(), true);
    state.feed = null;
    await poll();
    for (const id of ['price', 'mcap', 'vol', 'liq']) assert.equal(await page.locator(`#stat-${id}`).textContent(), 'see chart');
    assert.equal(await page.locator('#stat-price').getAttribute('aria-label'), null);
    assert.match(await page.locator('#stats-status').textContent(), /unavailable/);
    assert.equal(await page.locator('#tokenomics-layout').isVisible(), false);
    assert.equal(await page.locator('#tokenomics-fallback a').getAttribute('href'), feed.chartUrl);
    await page.locator('#stats').scrollIntoViewIfNeeded();
    await shot(page, 'revision-feed-unavailable.jpg');
    state.feed = feed;
    await poll();
    await page.locator('#tokenomics').scrollIntoViewIfNeeded();
    await shot(page, 'revision-tokenomics-recovered.jpg');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await check('social destinations update without duplicates or stale official-account labels', async () => {
    const { page, context, state, poll } = await open();
    // Test-only local destinations: these never enter the production data file.
    state.feed = { ...feed, x: `${url}#community`, telegram: `${url}#community` };
    await poll(); await poll();
    assert.equal(await page.locator('#telegram-follow').count(), 1);
    assert.equal(await page.locator('#x-follow').textContent(), 'Follow $OOPS on X');
    assert.equal(await page.locator('#x-follow').getAttribute('href'), state.feed.x);
    state.feed = feed; await poll();
    assert.equal(await page.locator('#telegram-follow').count(), 0);
    assert.equal(await page.locator('#x-follow').textContent(), 'Find $OOPS on X');
    await context.close();
  });

  await check('captions retain all accepted text in all eight previews and PNG exports', async () => {
    const { page, context, errors } = await open();
    const top = 'WHEN THE EXPERIMENT FAILS AGAIN AND AGAIN PLEASE SEND HELP';
    const bottom = 'W'.repeat(60);
    await page.locator('#top-text').fill(top);
    await page.locator('#bottom-text').fill(bottom);
    for (const radio of await page.locator('#template-picker input').all()) {
      await radio.check();
      assertCaptions(await captionState(page), top, bottom);
      const expected = await page.locator('#gen-frame').evaluate(frame => [...frame.querySelectorAll('text[paint-order]')].map(t => t.outerHTML));
      await png(page, page.locator('#download-meme'));
      const exported = await page.evaluate(async () => {
        const svg = new DOMParser().parseFromString(await window.__exportSvg, 'image/svg+xml');
        return { texts: [...svg.querySelectorAll('text[paint-order]')].map(t => t.outerHTML.replace(' xmlns="http://www.w3.org/2000/svg"', '')), fonts: svg.querySelector('style').textContent.includes('base64'), images: [...svg.querySelectorAll('image')].every(i => i.getAttribute('href').startsWith('data:')) };
      });
      assert.deepEqual(exported.texts, expected);
      assert.ok(exported.fonts && exported.images);
    }
    await page.locator('#template-picker input[value="chalkboard"]').check();
    await page.locator('#gen-frame').scrollIntoViewIfNeeded();
    await shot(page, 'revision-long-caption.jpg');
    for (const [t, b] of [['', ''], ['  <B>& "SCIENCE"  ', "ONE'LONG'WORD".repeat(5).slice(0, 60)], ['É'.repeat(60), '🐸'.repeat(30)], ['W'.repeat(60), 'WORDS '.repeat(10).trim()]]) {
      await page.locator('#top-text').fill(t);
      await page.locator('#bottom-text').fill(b);
      assertCaptions(await captionState(page), t, b);
      assert.equal(await page.locator('#gen-frame script, #gen-frame b').count(), 0);
    }
    assert.deepEqual(errors, []);
    await context.close();
  });

  await check('Peer review places one scientist in each panel, including the downloaded SVG/PNG', async () => {
    const { page, context } = await open();
    const card = page.locator('#meme-grid .meme-card').nth(6);
    const boxes = await card.evaluate(card => [...card.querySelectorAll('image')].map(image => {
      const b = image.getBBox(); const m = image.transform.baseVal.consolidate()?.matrix;
      const x = m ? m.a * (b.x + b.width) + m.e : b.x;
      return { x, right: x + b.width };
    }));
    assert.deepEqual(boxes, [{ x: 90, right: 557 }, { x: 643, right: 1110 }]);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'revision-peer-review.jpg');
    const download = await png(page, card.getByRole('button'));
    assert.equal(download.suggestedFilename(), 'oops-duo.png');
    if (screenshots) await download.saveAs(resolve(screenshots, 'revision-peer-review.png'));
    assert.match(await page.evaluate(() => window.__exportSvg), /x="90" y="280" width="467" height="700"[^>]*translate\(1200 0\) scale\(-1 1\)/);
    await context.close();
  });

  await check('blocked clipboard exposes/selects the requested value; success still works', async () => {
    const { page, context } = await open();
    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new DOMException('Denied', 'NotAllowedError')); });
    for (const [button, status, value] of [['#copy-link', '#share-status', 'https://experimentalerror.si-md.xyz/'], ['#copy-contract', '#copy-status', feed.token]]) {
      await page.locator(button).click();
      assert.equal(await page.locator(`${status} code`).textContent(), value);
      assert.equal(await page.evaluate(() => getSelection().toString()), value);
      assert.ok(await page.locator(`${status} code`).isVisible());
      assert.ok(await page.locator(`${status} code`).evaluate(el => el.getBoundingClientRect().right <= innerWidth));
      if (button === '#copy-link') { await page.locator(status).scrollIntoViewIfNeeded(); await shot(page, 'revision-share-fallback.jpg'); }
    }
    await page.evaluate(() => { navigator.clipboard.writeText = async text => { window.__copied = text; }; });
    await page.locator('#copy-link').click();
    assert.equal(await page.locator('#share-status').textContent(), 'Site link copied.');
    assert.equal(await page.evaluate(() => window.__copied), 'https://experimentalerror.si-md.xyz/');
    await page.locator('#copy-contract').click();
    assert.equal(await page.evaluate(() => window.__copied), feed.token);
    await context.close();
  });

  await check('price/mcap/volume animate between values; reduced motion and interruption stay honest', async () => {
    const { page, context, state, poll } = await open(390, feed, 'no-preference');
    await page.locator('#stats').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      window.__mutations = { price: [], mcap: [], vol: [] };
      for (const name of Object.keys(window.__mutations)) {
        const el = document.querySelector(`#stat-${name}`);
        new MutationObserver(() => window.__mutations[name].push(el.textContent)).observe(el, { childList: true, subtree: true, characterData: true });
      }
    });
    state.feed = structuredClone(feed);
    state.feed.market.priceUsd *= 2; state.feed.market.marketCap *= 2; state.feed.market.volume24h *= 2;
    await poll();
    await page.waitForTimeout(1100);
    const counts = await page.evaluate(() => Object.fromEntries(Object.entries(window.__mutations).map(([k, v]) => [k, v.length])));
    for (const count of Object.values(counts)) assert.ok(count > 2, JSON.stringify(counts));
    assert.equal(await page.locator('#stat-price').getAttribute('aria-label'), '$0.000006236');
    assert.equal(await page.locator('#stat-mcap').textContent(), '$6,236.28');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { for (const key of Object.keys(window.__mutations)) window.__mutations[key] = []; });
    state.feed = feed; await poll();
    assert.equal(await page.locator('#stat-price').getAttribute('aria-label'), '$0.000003118');
    assert.equal(await page.evaluate(() => window.__mutations.price.length), 1);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    state.feed = { ...feed, market: { ...feed.market, priceUsd: 0.000006236, marketCap: 6236.28 } };
    await poll();
    await page.waitForTimeout(100);
    state.feed = null; await poll();
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('#stat-price').textContent(), 'see chart');
    assert.equal(await page.locator('#stat-mcap').textContent(), 'see chart');
    console.log(`  Animated mutation counts: ${JSON.stringify(counts)}`);
    await context.close();
  });

  await check('participation copy, keyboard steps, lab, share intents, metadata, resources and 404', async () => {
    const { page, context, errors } = await open();
    const resources = [];
    page.on('requestfailed', request => resources.push(request.url()));
    page.on('response', response => { if (response.status() >= 400) resources.push(response.url()); });
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#memes .section-head p').textContent(), 'The lab’s worst calculations, ready to share. Download a meme and pass the mistake along.');
    assert.equal(await page.locator('#generator .generator-preview .lab-note').textContent(), 'Your caption updates as you type. Download it when the mistake is ready.');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
    await page.keyboard.press('Enter');
    await page.locator('.step-tab').first().focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.step-tab').nth(1).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await page.locator('.step-tab').nth(2).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home');
    assert.equal(await page.locator('.step-tab').first().getAttribute('aria-selected'), 'true');
    await page.locator('#experiment-btn').click();
    assert.equal(await page.locator('#oops-count').textContent(), '1');
    assert.ok(Number(await page.locator('#vibe-meter').getAttribute('aria-valuenow')) > 0);
    assert.ok((await page.locator('#fact-text').textContent()).length > 20);
    await page.evaluate(() => { window.open = url => { window.__opened = url; return null; }; });
    for (const button of await page.locator('[data-share]').all()) {
      await button.click();
      const intent = new URL(await page.evaluate(() => window.__opened));
      assert.equal(intent.origin, 'https://x.com');
      assert.match(intent.searchParams.get('text'), /\$OOPS/);
    }
    const integrity = await page.evaluate(() => ({
      title: document.title,
      meta: ['description', 'twitter:card'].every(name => document.querySelector(`meta[name="${name}"]`)?.content),
      og: ['og:title', 'og:image'].every(name => document.querySelector(`meta[property="${name}"]`)?.content),
      favicon: document.querySelector('link[rel="icon"]')?.href,
      brokenImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src),
      deadAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash),
    }));
    assert.match(integrity.title, /EXPERIMENTAL ERROR/);
    assert.ok(integrity.meta && integrity.og && integrity.favicon);
    assert.deepEqual(integrity.brokenImages, []);
    assert.deepEqual(integrity.deadAnchors, []);
    assert.deepEqual(resources, []);
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url + '404.html');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.ok(await page.locator('h1').isVisible());
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(resources, []);
    await context.close();
  });
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`${passed} checks passed; ${failed} failed (${site}).`);
process.exitCode = failed ? 1 : 0;
