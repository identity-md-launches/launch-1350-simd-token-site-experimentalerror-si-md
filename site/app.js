// @ts-check
/*
  EXPERIMENTAL ERROR ($OOPS) — site behaviour.
  Plain ES module, no dependencies. Runs directly from site/ and is bundled
  unchanged into dist/ by Vite. Every live number comes from simd-coin.json.
*/

/**
 * @typedef {{label: string, percent: number}} Allocation
 * @typedef {{
 *   totalSupply?: number | null, decimals?: number | null, fixedSupply?: boolean | null,
 *   allocation?: Allocation[] | null, team?: string | null, tradingFee?: string | null,
 *   creatorFeesGoTo?: string | null, launchedOn?: string | null, launchedAt?: string | null
 * }} Tokenomics
 * @typedef {{
 *   name?: string, symbol?: string, token?: string, chain?: string, chainName?: string,
 *   logo?: string | null, x?: string | null, telegram?: string | null,
 *   chartUrl?: string | null, buyUrl?: string | null, coinUrl?: string | null,
 *   market?: {priceUsd?: number | null, marketCap?: number | null, liquidityUsd?: number | null, volume24h?: number | null} | null,
 *   tokenomics?: Tokenomics | null
 * }} CoinData
 */

const CONTRACT = "48inyFiUUZSaWRpKT264EYWP3uzWd4q6sXLgbaeMBCPF";
const SITE_URL = "https://experimentalerror.si-md.xyz/";
const REFRESH_MS = 30_000;
const LOGO_SRC = "./assets/logo.webp";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** @param {string} id */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

/* ------------------------------------------------------------------ */
/* Number formatting                                                   */
/* ------------------------------------------------------------------ */

/** @param {number} n */
function formatUsd(n) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `$${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  return `$${n.toFixed(2)}`;
}

/** Full price string: 0.000003118 → "$0.000003118" */
/** @param {number} n */
function formatPrice(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  if (n === 0) return "$0";
  const digits = Math.min(12, Math.max(4, -Math.floor(Math.log10(n)) + 3));
  return `$${n.toFixed(digits)}`;
}

/**
 * Compact price for the big tile. Tiny prices use the subscript-zero notation
 * common on charts: 0.000003118 → "$0.0₅3118" (five zeros after the point).
 * Returns the parts so the DOM can render a real <sub>.
 * @param {number} n
 * @returns {{text: string, zeros: number | null, tail: string}}
 */
function compactPrice(n) {
  if (!Number.isFinite(n) || n === 0 || n >= 0.001) return { text: formatPrice(n), zeros: null, tail: "" };
  const full = n.toFixed(14);
  const m = /^0\.(0*)(\d+)/.exec(full);
  if (!m) return { text: formatPrice(n), zeros: null, tail: "" };
  const zeros = m[1].length;
  const tail = m[2].replace(/0+$/, "").slice(0, 4) || "0";
  return { text: "$0.0", zeros, tail };
}

/**
 * Render the price tile with a subscript zero count when the price is tiny.
 * @param {HTMLElement} el @param {number | null | undefined} n
 */
function renderPrice(el, n) {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    el.textContent = "see chart";
    el.removeAttribute("aria-label");
    return;
  }
  const c = compactPrice(n);
  if (c.zeros === null) {
    el.textContent = c.text;
    el.removeAttribute("aria-label");
    return;
  }
  const sub = document.createElement("sub");
  sub.textContent = String(c.zeros);
  el.replaceChildren(document.createTextNode(c.text), sub, document.createTextNode(c.tail));
  el.setAttribute("aria-label", formatPrice(n));
}

/** @param {number} n */
function formatSupply(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${+(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString("en-US");
}

/* ------------------------------------------------------------------ */
/* Animated numbers                                                    */
/* ------------------------------------------------------------------ */

/** @type {WeakMap<HTMLElement, number>} */
const currentValues = new WeakMap();
/** @type {WeakMap<HTMLElement, number>} */
const numberFrames = new WeakMap();

/**
 * Tween the displayed value of an element from its last value to `target`.
 * @param {HTMLElement} el
 * @param {number | null | undefined} target
 * @param {(n: number) => string} fmt
 * @param {string} fallback
 * @param {(n: number) => void} [render]
 */
function animateNumber(el, target, fmt, fallback, render = (n) => { el.textContent = fmt(n); }) {
  const pending = numberFrames.get(el);
  if (pending !== undefined) cancelAnimationFrame(pending);
  numberFrames.delete(el);
  if (target === null || target === undefined || !Number.isFinite(target)) {
    el.textContent = fallback;
    el.removeAttribute("aria-label");
    currentValues.delete(el);
    return;
  }
  const from = currentValues.get(el);
  /** @param {number} n */
  const show = (n) => {
    currentValues.set(el, n);
    render(n);
  };
  if (from === undefined || reduceMotion.matches || from === target) {
    show(target);
    return;
  }
  const start = performance.now();
  const duration = 900;
  /** @param {number} now */
  const frame = (now) => {
    const t = reduceMotion.matches ? 1 : Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    show(from + (target - from) * eased);
    if (t < 1) numberFrames.set(el, requestAnimationFrame(frame));
    else numberFrames.delete(el);
  };
  numberFrames.set(el, requestAnimationFrame(frame));
}

/* ------------------------------------------------------------------ */
/* Live data                                                           */
/* ------------------------------------------------------------------ */

/** @returns {Promise<CoinData | null>} */
async function loadCoin() {
  // Same-origin feed first (production), then the committed snapshot next to
  // index.html (works from a gateway subpath or a local preview).
  for (const url of ["/simd-coin.json", "./simd-coin.json"]) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) continue;
      const data = /** @type {CoinData} */ (await res.json());
      if (data && typeof data === "object") return data;
    } catch {
      /* try the next source */
    }
  }
  return null;
}

/** @param {CoinData} coin */
function applyLinks(coin) {
  const buy = coin.buyUrl || coin.coinUrl;
  const chart = coin.chartUrl;
  if (buy) document.querySelectorAll("a[data-buy-link]").forEach((a) => a.setAttribute("href", buy));
  if (chart) document.querySelectorAll("a[data-chart-link]").forEach((a) => a.setAttribute("href", chart));
  const follow = byId("x-follow");
  follow.setAttribute("href", coin.x || "https://x.com/search?q=%24OOPS%20EXPERIMENTAL%20ERROR&src=typed_query");
  follow.textContent = coin.x ? "Follow $OOPS on X" : "Find $OOPS on X";
  const existingTelegram = document.getElementById("telegram-follow");
  if (coin.telegram) {
    const tg = /** @type {HTMLAnchorElement} */ (existingTelegram || document.createElement("a"));
    tg.id = "telegram-follow";
    tg.className = "btn btn-ghost";
    tg.href = coin.telegram;
    tg.target = "_blank";
    tg.rel = "noopener";
    tg.textContent = "Join the Telegram";
    byId("share-row").appendChild(tg);
  } else existingTelegram?.remove();
}

/** @param {CoinData | null} coin */
function renderStats(coin) {
  const m = coin?.market || null;
  const status = byId("stats-status");
  const price = byId("stat-price");
  animateNumber(price, m?.priceUsd, formatPrice, "see chart", (n) => renderPrice(price, n));
  const priceFoot = byId("stat-price-foot");
  priceFoot.textContent = typeof m?.priceUsd === "number" ? `${formatPrice(m.priceUsd)} per $OOPS` : "USD per $OOPS";
  animateNumber(byId("stat-mcap"), m?.marketCap, formatUsd, "see chart");
  animateNumber(byId("stat-vol"), m?.volume24h, formatUsd, "see chart");
  animateNumber(byId("stat-liq"), m?.liquidityUsd, formatUsd, "see chart");
  if (!coin) {
    status.textContent = "Live feed unavailable right now. Open the chart for current numbers.";
    return;
  }
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  status.textContent = `Updated ${time} · refreshes every 30 s`;
}

/* ------------------------------------------------------------------ */
/* Tokenomics                                                          */
/* ------------------------------------------------------------------ */

const DONUT_COLORS = ["#c8ff3a", "#ff4fb0", "#f4f1e8", "#2c6a4a", "#dcff7a", "#ff7cc6"];

/** @param {CoinData | null} coin */
function renderTokenomics(coin) {
  const t = coin?.tokenomics || null;
  const donut = /** @type {SVGSVGElement} */ (/** @type {unknown} */ (byId("donut")));
  const legend = byId("legend");
  const facts = byId("token-facts");
  const supplyEl = byId("donut-supply");
  const wrap = byId("tokenomics-layout");
  const fallback = byId("tokenomics-fallback");
  const chart = coin?.chartUrl || document.querySelector("[data-chart-link]")?.getAttribute("href") || "https://dexscreener.com/solana/" + CONTRACT;
  legend.replaceChildren();
  facts.replaceChildren();
  donut.querySelectorAll(".donut-segment").forEach((segment) => segment.remove());
  const unavailable = !t || !Array.isArray(t.allocation) || t.allocation.length === 0;
  wrap.hidden = unavailable;
  fallback.hidden = !unavailable;

  /** @param {string} term @param {string | HTMLElement} desc */
  const addFact = (term, desc) => {
    const row = document.createElement("div");
    row.className = "fact-row";
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    if (typeof desc === "string") dd.textContent = desc;
    else dd.appendChild(desc);
    row.append(dt, dd);
    facts.appendChild(row);
  };
  /** @param {string} text */
  const chartLink = (text) => {
    const a = document.createElement("a");
    a.href = chart;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = text;
    return a;
  };

  if (!t || !Array.isArray(t.allocation) || t.allocation.length === 0) {
    // No tokenomics in the feed: never block, point at the chart instead.
    const p = document.createElement("p");
    p.append("Supply and holders: ", chartLink("see the chart on DexScreener"), ".");
    fallback.replaceChildren(p);
    return;
  }

  supplyEl.textContent = typeof t.totalSupply === "number" ? formatSupply(t.totalSupply) : "—";

  // Donut segments: circumference 2πr with r = 80.
  const r = 80;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  t.allocation.forEach((slice, i) => {
    const pct = Math.max(0, Math.min(100, Number(slice.percent) || 0));
    const len = (pct / 100) * circ;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.classList.add("donut-segment");
    c.setAttribute("cx", "110");
    c.setAttribute("cy", "110");
    c.setAttribute("r", String(r));
    c.setAttribute("stroke", DONUT_COLORS[i % DONUT_COLORS.length]);
    c.setAttribute("stroke-dasharray", `0 ${circ}`);
    c.setAttribute("stroke-dashoffset", String(-offset));
    donut.appendChild(c);
    // Animate the dash in on the next frame so the transition runs.
    requestAnimationFrame(() => c.setAttribute("stroke-dasharray", `${len} ${circ - len}`));
    offset += len;

    const li = document.createElement("li");
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = DONUT_COLORS[i % DONUT_COLORS.length];
    const label = document.createElement("span");
    label.textContent = slice.label;
    const pctEl = document.createElement("span");
    pctEl.className = "pct num";
    pctEl.textContent = `${pct}%`;
    li.append(sw, label, pctEl);
    legend.appendChild(li);
  });

  if (typeof t.totalSupply === "number") {
    addFact("Total supply", `${t.totalSupply.toLocaleString("en-US")} $OOPS${t.fixedSupply ? " · fixed, no minting" : ""}`);
  }
  if (typeof t.decimals === "number") addFact("Decimals", String(t.decimals));
  if (t.team) addFact("Team allocation", t.team);
  if (t.tradingFee) addFact("Trading fee", t.tradingFee);
  if (t.creatorFeesGoTo) addFact("Creator fees go to", t.creatorFeesGoTo);
  if (t.launchedOn) {
    let when = "";
    if (t.launchedAt) {
      const d = new Date(t.launchedAt);
      if (!Number.isNaN(d.getTime())) when = ` on ${d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
    }
    addFact("Launched", `${t.launchedOn}${when}`);
  }
  addFact("Holders", chartLink("see the chart"));
}

/* ------------------------------------------------------------------ */
/* Confetti (DOM pieces, CSS/JS only)                                   */
/* ------------------------------------------------------------------ */

const CONFETTI_COLORS = ["#c8ff3a", "#ff4fb0", "#f4f1e8", "#dcff7a", "#ff7cc6"];

/** @param {number} x @param {number} y */
function burstConfetti(x, y) {
  if (reduceMotion.matches) return;
  const count = 28;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.borderRadius = i % 3 === 0 ? "50%" : "2px";
    document.body.appendChild(piece);
    const angle = Math.random() * Math.PI * 2;
    const speed = 160 + Math.random() * 260;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 180;
    const rot = (Math.random() - 0.5) * 720;
    const anim = piece.animate(
      [
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 320}px)) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
    );
    anim.onfinish = () => piece.remove();
  }
}

/* ------------------------------------------------------------------ */
/* Lab: experiment button, OOPS counter, vibe meter, facts, popups     */
/* ------------------------------------------------------------------ */

const FACTS = [
  "Penicillin was discovered because Alexander Fleming left a petri dish uncovered and mould contaminated it.",
  "The microwave oven was invented after a radar engineer noticed a chocolate bar melting in his pocket.",
  "Post-it notes exist because a 3M chemist was trying to make a super strong glue and got a weak one instead.",
  "Teflon was found by accident when a refrigerant gas polymerised inside its storage cylinder.",
  "Vulcanised rubber was discovered when Charles Goodyear dropped a rubber and sulphur mix onto a hot stove.",
  "The 1999 Mars Climate Orbiter was lost because one team used pound-force seconds and another used newton seconds.",
  "Safety glass was discovered when a flask coated in dried cellulose nitrate was dropped and cracked without shattering.",
  "X-rays were found when Wilhelm Röntgen noticed a screen glowing across the room from a covered cathode tube.",
  "The pacemaker's inventor was building a heart-rhythm recorder and pulled the wrong resistor from the box.",
  "Saccharin was discovered when a chemist forgot to wash his hands before dinner and noticed his bread tasted sweet.",
  "The Hubble telescope's main mirror was ground to the wrong shape by about 2 micrometres and needed corrective optics.",
  "Frogs absorb water through their skin rather than drinking it, so a thoughtful frog is also a hydrated frog.",
  "Dynamite was created when nitroglycerin leaked into the diatomaceous earth it was packed in and became stable.",
  "The cosmic microwave background was detected by two engineers who first blamed the noise on pigeon droppings.",
];

const MEME_POPUPS = [
  "Peer review says: still an error.",
  "Hypothesis rejected. Vibes accepted.",
  "Lab log entry #4,019: OOPS.",
  "Decimal point last seen heading east.",
  "Control group also confused.",
  "Measurement complete. Units unknown.",
];

/** @type {string[]} */
let factDeck = [];

function nextFact() {
  if (factDeck.length === 0) factDeck = [...FACTS].sort(() => Math.random() - 0.5);
  return /** @type {string} */ (factDeck.pop());
}

/** @param {string} text */
function showToast(text) {
  const region = byId("toast-region");
  const toast = document.createElement("div");
  toast.className = "toast";
  const img = document.createElement("img");
  img.src = LOGO_SRC;
  img.alt = "";
  img.width = 40;
  img.height = 40;
  const span = document.createElement("span");
  span.textContent = text;
  toast.append(img, span);
  region.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function initLab() {
  const btn = byId("experiment-btn");
  const count = byId("oops-count");
  const fill = byId("vibe-fill");
  const meter = byId("vibe-meter");
  const pct = byId("vibe-pct");
  const vibeText = byId("vibe-text");
  const fact = byId("fact-text");
  let oops = 0;

  const moods = ["idle", "warming up", "bubbling", "unstable", "critical", "beyond science"];

  btn.addEventListener("click", () => {
    oops += 1;
    count.textContent = String(oops);
    // Vibe climbs quickly then asymptotically: 100 * (1 - e^(-n/8)), min 4.
    const level = Math.max(4, Math.round(100 * (1 - Math.exp(-oops / 8))));
    fill.style.width = `${level}%`;
    meter.setAttribute("aria-valuenow", String(level));
    pct.textContent = `${level}%`;
    const mood = moods[Math.min(moods.length - 1, Math.floor(level / 20))];
    vibeText.textContent = `Vibe meter: ${mood}`;
    fact.textContent = nextFact();
    if (oops % 5 === 0) showToast(MEME_POPUPS[(oops / 5 - 1) % MEME_POPUPS.length]);
    if (!reduceMotion.matches) {
      count.animate([{ scale: "1" }, { scale: "1.18" }, { scale: "1" }], { duration: 300, easing: "cubic-bezier(0.2, 0, 0, 1)" });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Magnetic buttons                                                    */
/* ------------------------------------------------------------------ */

function initMagnetic() {
  if (reduceMotion.matches || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  document.querySelectorAll(".magnetic").forEach((node) => {
    const el = /** @type {HTMLElement} */ (node);
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.translate = `${dx * 10 - 2}px ${dy * 10 - 2}px`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.translate = "";
    });
  });
}

/* ------------------------------------------------------------------ */
/* Draggable sticker                                                   */
/* ------------------------------------------------------------------ */

function initDraggable() {
  const el = byId("drag-sticker");
  const stage = /** @type {HTMLElement} */ (el.parentElement);
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  const place = () => {
    const sr = stage.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    return { sr, er };
  };
  /** @param {number} x @param {number} y */
  const setPos = (x, y) => {
    const { sr, er } = place();
    const maxX = sr.width - er.width;
    const maxY = sr.height - er.height;
    const cx = Math.max(0, Math.min(maxX, x));
    const cy = Math.max(0, Math.min(maxY, y));
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.bottom = "auto";
  };

  el.addEventListener("pointerdown", (e) => {
    dragging = true;
    el.classList.add("dragging");
    el.setPointerCapture(e.pointerId);
    const { sr, er } = place();
    originX = er.left - sr.left;
    originY = er.top - sr.top;
    startX = e.clientX;
    startY = e.clientY;
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    setPos(originX + (e.clientX - startX), originY + (e.clientY - startY));
  });
  const stop = () => {
    dragging = false;
    el.classList.remove("dragging");
  };
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);

  el.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 40 : 12;
    /** @type {Record<string, [number, number]>} */
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const delta = map[e.key];
    if (!delta) return;
    e.preventDefault();
    const { sr, er } = place();
    setPos(er.left - sr.left + delta[0], er.top - sr.top + delta[1]);
  });
}

/* ------------------------------------------------------------------ */
/* Nav menu, tabs, copy, share                                         */
/* ------------------------------------------------------------------ */

function initMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const links = byId("nav-links");
  if (!(toggle instanceof HTMLButtonElement)) return;
  const setOpen = (/** @type {boolean} */ open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    links.dataset.open = String(open);
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  links.addEventListener("click", (e) => {
    if (e.target instanceof HTMLAnchorElement) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });
}

function initSteps() {
  const tabs = /** @type {HTMLButtonElement[]} */ (Array.from(document.querySelectorAll(".step-tab")));
  const panels = /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll(".step-panel")));
  /** @param {number} index @param {boolean} focus */
  const select = (index, focus) => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(i, false));
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") select((i + 1) % tabs.length, true);
      else if (e.key === "ArrowLeft") select((i - 1 + tabs.length) % tabs.length, true);
      else if (e.key === "Home") select(0, true);
      else if (e.key === "End") select(tabs.length - 1, true);
      else return;
      e.preventDefault();
    });
  });
  document.querySelectorAll("[data-step-next]").forEach((b) => {
    b.addEventListener("click", () => {
      const n = Number(b.getAttribute("data-step-next")) - 1;
      select(n, true);
    });
  });
}

/**
 * @param {string} text
 * @param {HTMLElement} status
 * @param {string} okMessage
 */
async function copyText(text, status, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = okMessage;
  } catch {
    // Keep the requested value visible beside its control when copying is blocked.
    const value = document.createElement("code");
    value.className = "copy-fallback";
    value.textContent = text;
    status.replaceChildren("Copy blocked by the browser. Select and copy this text manually: ", value);
    const range = document.createRange();
    range.selectNodeContents(value);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  window.setTimeout(() => {
    if (status.textContent === okMessage) status.textContent = "";
  }, 4000);
}

function initCopyAndShare() {
  byId("copy-contract").addEventListener("click", () => {
    copyText(CONTRACT, byId("copy-status"), "Contract address copied.");
  });
  byId("copy-link").addEventListener("click", () => {
    copyText(SITE_URL, byId("share-status"), "Site link copied.");
  });
  const texts = [
    `My hypothesis was perfect. My decimal point was not. $OOPS, EXPERIMENTAL ERROR on Solana. ${SITE_URL}`,
    `Two cracked beakers, one neon spill, zero regrets. $OOPS is the memecoin for miscalculators. ${SITE_URL}`,
    `Results: inconclusive. Vibes: conclusive. EXPERIMENTAL ERROR ($OOPS) on Solana. ${SITE_URL}`,
  ];
  document.querySelectorAll("[data-share]").forEach((b) => {
    b.addEventListener("click", () => {
      const i = Number(b.getAttribute("data-share")) || 0;
      const url = `https://x.com/intent/post?text=${encodeURIComponent(texts[i])}`;
      window.open(url, "_blank", "noopener");
    });
  });
}

/* ------------------------------------------------------------------ */
/* Meme wall + generator (SVG compositions, PNG export)                */
/* ------------------------------------------------------------------ */

/** @typedef {{id: string, title: string, render: (top: string, bottom: string, logo: string) => string}} MemeTemplate */

const FONT_DISPLAY = "Lilita One, Arial Black, Impact, sans-serif";
const FONT_MONO = "Space Mono, Menlo, monospace";

/** @param {string} s */
function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

/**
 * Measure and fit the complete caption, including unbroken words, in its band.
 * The same SVG geometry is used for the preview and the PNG export.
 * @param {string} text @param {number} y @param {number} size @param {string} fill
 */
function caption(text, y, size, fill = "#f4f1e8") {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  // SVG text measurement keeps the on-page rendering entirely CSS/SVG. Use the
  // loaded display face (or its actual fallback), rather than a character count.
  const probe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
  const measure = document.createElementNS("http://www.w3.org/2000/svg", "text");
  measure.setAttribute("font-family", FONT_DISPLAY);
  probe.appendChild(measure);
  document.body.appendChild(probe);

  const minY = y < 600 ? 24 : y > 1120 ? 1080 : 1030;
  const maxY = y < 600 ? 230 : 1176;
  /** @type {string[]} */
  let lines = [];
  let advance = 0;
  let top = 0;
  let bottom = 0;
  let stroke = 0;
  try {
    for (; size >= 12; size -= 1) {
      measure.setAttribute("font-size", String(size));
      stroke = Math.max(1, Math.round(size / 9));
      /** @param {string} value */
      const fits = (value) => {
        measure.textContent = value;
        return measure.getComputedTextLength() + stroke <= 1100;
      };
      lines = [];
      let line = "";
      for (const word of words) {
        if (line && fits(`${line} ${word}`)) {
          line += ` ${word}`;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        // A word may itself be wider than the frame; keep every character.
        for (const character of word) {
          if (line && !fits(line + character)) {
            lines.push(line);
            line = "";
          }
          line += character;
        }
      }
      if (line) lines.push(line);
      const bounds = lines.map((value) => {
        measure.textContent = value;
        return measure.getBBox();
      });
      top = Math.min(...bounds.map((b) => b.y));
      bottom = Math.max(...bounds.map((b) => b.y + b.height));
      advance = Math.max(size * 1.15, bottom - top + stroke);
      if (bottom - top + stroke + (lines.length - 1) * advance <= maxY - minY) break;
    }
  } finally {
    probe.remove();
  }

  const startY = Math.max(minY - top + stroke / 2, Math.min(
    y - ((lines.length - 1) * advance) / 2,
    maxY - bottom - stroke / 2 - (lines.length - 1) * advance,
  ));
  return lines
    .map(
      (l, i) =>
        `<text x="600" y="${startY + i * advance}" text-anchor="middle" font-family="${FONT_DISPLAY}" font-size="${size}" fill="${fill}" stroke="#0a0a0a" stroke-width="${stroke}" paint-order="stroke" stroke-linejoin="round">${esc(l)}</text>`,
    )
    .join("");
}

const HALFTONE = `<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="3" fill="#f4f1e8" opacity="0.14"/></pattern>`;

/** @param {string} logo @param {number} x @param {number} y @param {number} h @param {string} extra */
function logoImg(logo, x, y, h, extra = "") {
  const w = Math.round((h * 683) / 1024);
  return `<image href="${logo}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" ${extra}/>`;
}

/** @type {MemeTemplate[]} */
const TEMPLATES = [
  {
    id: "chalkboard",
    title: "Chalkboard",
    render: (top, bottom, logo) => `
      <rect width="1200" height="1200" fill="#0f2a1f"/><rect width="1200" height="1200" fill="url(#dots)"/>
      <g font-family="${FONT_MONO}" font-size="44" font-weight="700" fill="#f4f1e8" opacity="0.8">
        <text x="70" y="400">a² + b² = c²</text><text x="70" y="470">∫ oops dx</text><text x="760" y="560">x = ?</text><text x="760" y="640">x ≈ 6.9</text>
      </g>
      <path d="M90 600 L420 680 M420 600 L90 680" stroke="#ff4fb0" stroke-width="22" stroke-linecap="round"/>
      ${logoImg(logo, 420, 230, 820)}
      ${caption(top, 130, 96)}${caption(bottom, 1100, 96)}`,
  },
  {
    id: "spill",
    title: "Neon spill",
    render: (top, bottom, logo) => `
      <rect width="1200" height="1200" fill="#c8ff3a"/>
      <path d="M-50 900c150-120 300 60 480-20s330-80 520 30 300 40 300 40v300H-50z" fill="#ff4fb0" stroke="#0a0a0a" stroke-width="12"/>
      <circle cx="980" cy="260" r="110" fill="#ff4fb0" stroke="#0a0a0a" stroke-width="12"/>
      <circle cx="170" cy="330" r="60" fill="#0f2a1f" stroke="#0a0a0a" stroke-width="12"/>
      ${logoImg(logo, 400, 210, 860)}
      ${caption(top, 130, 96, "#0a0a0a")}${caption(bottom, 1100, 96)}`,
  },
  {
    id: "sticker",
    title: "Sticker sheet",
    render: (top, bottom, logo) => `
      <rect width="1200" height="1200" fill="#f4f1e8"/>
      <g transform="rotate(-8 600 600)"><rect x="220" y="200" width="760" height="800" rx="60" fill="#ff4fb0" stroke="#0a0a0a" stroke-width="14"/></g>
      <g transform="rotate(5 600 600)"><rect x="260" y="240" width="680" height="720" rx="48" fill="#c8ff3a" stroke="#0a0a0a" stroke-width="14"/></g>
      ${logoImg(logo, 410, 250, 720)}
      <g transform="rotate(-12 180 220)"><rect x="60" y="180" width="240" height="80" rx="40" fill="#0f2a1f" stroke="#0a0a0a" stroke-width="10"/><text x="180" y="236" text-anchor="middle" font-family="${FONT_DISPLAY}" font-size="48" fill="#c8ff3a">$OOPS</text></g>
      ${caption(top, 110, 90, "#0a0a0a")}${caption(bottom, 1110, 90, "#0a0a0a")}`,
  },
  {
    id: "graph",
    title: "The chart",
    render: (top, bottom, logo) => `
      <rect width="1200" height="1200" fill="#08140f"/>
      <g stroke="#2c6a4a" stroke-width="2">${Array.from({ length: 11 }, (_, i) => `<path d="M${100 + i * 100} 200V1000"/><path d="M100 ${200 + i * 80}H1100"/>`).join("")}</g>
      <path d="M120 900 L300 820 L420 860 L560 620 L700 700 L860 380 L1000 420 L1080 260" fill="none" stroke="#c8ff3a" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M1000 420 L1080 260" stroke="#ff4fb0" stroke-width="18" stroke-linecap="round"/>
      ${logoImg(logo, 40, 420, 620)}
      ${caption(top, 130, 92)}${caption(bottom, 1100, 92)}`,
  },
  {
    id: "wanted",
    title: "Wanted poster",
    render: (top, bottom, logo) => `
      <rect width="1200" height="1200" fill="#d9d4c7"/>
      <rect x="80" y="80" width="1040" height="1040" fill="none" stroke="#0a0a0a" stroke-width="16" stroke-dasharray="40 24"/>
      <text x="600" y="300" text-anchor="middle" font-family="${FONT_DISPLAY}" font-size="150" fill="#0a0a0a">WANTED</text>
      ${logoImg(logo, 400, 320, 640)}
      <text x="600" y="1010" text-anchor="middle" font-family="${FONT_MONO}" font-size="44" font-weight="700" fill="#0a0a0a">FOR CRIMES AGAINST ARITHMETIC</text>
      ${caption(top, 150, 80, "#ff4fb0")}${caption(bottom, 1110, 80, "#ff4fb0")}`,
  },
  {
    id: "beaker",
    title: "Beaker",
    render: (top, bottom, logo) => `
      <rect width="1200" height="1200" fill="#0f2a1f"/><rect width="1200" height="1200" fill="url(#dots)"/>
      <path d="M470 220h260v300l250 420c30 60-10 120-80 120H300c-70 0-110-60-80-120l250-420z" fill="#173a2c" stroke="#f4f1e8" stroke-width="16"/>
      <path d="M250 760c80-50 160 30 240 0s160-40 240 10l120 200c20 40-10 70-50 70H300c-50 0-80-40-60-80z" fill="#ff4fb0" stroke="#0a0a0a" stroke-width="12"/>
      <circle cx="420" cy="860" r="26" fill="#c8ff3a" stroke="#0a0a0a" stroke-width="8"/><circle cx="700" cy="920" r="34" fill="#c8ff3a" stroke="#0a0a0a" stroke-width="8"/>
      ${logoImg(logo, 460, 330, 520)}
      ${caption(top, 130, 92)}${caption(bottom, 1100, 92)}`,
  },
  {
    id: "duo",
    title: "Peer review",
    render: (top, bottom, logo) => `
      <rect width="1200" height="1200" fill="#ff4fb0"/>
      <rect x="0" y="0" width="600" height="1200" fill="#c8ff3a"/>
      <line x1="600" y1="0" x2="600" y2="1200" stroke="#0a0a0a" stroke-width="14"/>
      ${logoImg(logo, 90, 280, 700)}
      ${logoImg(logo, 90, 280, 700, 'transform="translate(1200 0) scale(-1 1)"')}
      <text x="300" y="1060" text-anchor="middle" font-family="${FONT_MONO}" font-size="40" font-weight="700" fill="#0a0a0a">REVIEWER 1</text>
      <text x="900" y="1060" text-anchor="middle" font-family="${FONT_MONO}" font-size="40" font-weight="700" fill="#0a0a0a">REVIEWER 2</text>
      ${caption(top, 130, 90, "#0a0a0a")}${caption(bottom, 1140, 70, "#f4f1e8")}`,
  },
  {
    id: "halo",
    title: "Big brain",
    render: (top, bottom, logo) => `
      <rect width="1200" height="1200" fill="#08140f"/>
      <circle cx="600" cy="560" r="420" fill="none" stroke="#c8ff3a" stroke-width="28" stroke-dasharray="60 30"/>
      <circle cx="600" cy="560" r="330" fill="#0f2a1f" stroke="#ff4fb0" stroke-width="18"/>
      ${["Δ", "∑", "π", "√", "∞", "≈"].map((g, i) => `<text x="${600 + 480 * Math.cos((i / 6) * Math.PI * 2)}" y="${580 + 480 * Math.sin((i / 6) * Math.PI * 2)}" text-anchor="middle" font-family="${FONT_MONO}" font-size="90" font-weight="700" fill="#ff4fb0">${g}</text>`).join("")}
      ${logoImg(logo, 380, 220, 700)}
      ${caption(top, 130, 92)}${caption(bottom, 1110, 92)}`,
  },
];

const WALL_CAPTIONS = [
  ["When the math is perfect", "but the decimal moved"],
  ["Hypothesis: moon", "Result: oops"],
  ["Official lab sticker", "stick responsibly"],
  ["Technical analysis", "by a frog"],
  ["Last seen", "near the beakers"],
  ["The experiment", "is the product"],
  ["Reviewer 1: reject", "Reviewer 2: also reject"],
  ["He thought about it", "very hard"],
];

/** @param {MemeTemplate} tpl @param {string} top @param {string} bottom @param {string} logo @param {string} title */
function memeSvg(tpl, top, bottom, logo, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 1200" width="1200" height="1200" role="img" aria-label="${esc(title)}"><defs>${HALFTONE}</defs>${tpl.render(top, bottom, logo)}</svg>`;
}

/** @type {Promise<string> | null} */
let logoDataUrl = null;
/** Logo as a data URL so an exported SVG carries its own pixels. */
function getLogoDataUrl() {
  if (!logoDataUrl) {
    logoDataUrl = fetch(LOGO_SRC)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      );
  }
  return logoDataUrl;
}

/**
 * Rasterise an SVG string to a PNG download. The page renders SVG only; the
 * canvas exists for the export, as the brief's download-as-PNG asks.
 * @param {string} svg @param {string} filename
 */
async function downloadSvgAsPng(svg, filename) {
  if (document.fonts && document.fonts.load) {
    await Promise.all([document.fonts.load(`96px "Lilita One"`), document.fonts.load(`700 44px "Space Mono"`)]).catch(() => {});
  }
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(undefined);
      img.onerror = () => reject(new Error("SVG failed to load"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, 1200, 1200);
    const png = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(/** @type {Blob} */ (png));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Fonts inside an SVG rendered through <img> cannot reach the page's
 * @font-face rules, so embed them as data URLs for the export.
 * @type {Promise<string> | null}
 */
let fontCssPromise = null;
function getFontCss() {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      /** @param {string} path */
      const toData = async (path) => {
        const blob = await fetch(path).then((r) => r.blob());
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
      };
      const [lilita, mono] = await Promise.all([toData("./assets/fonts/LilitaOne-400.woff2"), toData("./assets/fonts/SpaceMono-700.woff2")]);
      return `@font-face{font-family:"Lilita One";src:url(${lilita}) format("woff2")}@font-face{font-family:"Space Mono";font-weight:700;src:url(${mono}) format("woff2")}`;
    })().catch(() => "");
  }
  return fontCssPromise;
}

/** @param {string} svg */
async function withEmbeddedFonts(svg) {
  const css = await getFontCss();
  return css ? svg.replace("<defs>", `<defs><style>${css}</style>`) : svg;
}

function initMemeWall() {
  const grid = byId("meme-grid");
  const status = byId("gen-status");
  TEMPLATES.forEach((tpl, i) => {
    const [top, bottom] = WALL_CAPTIONS[i];
    const title = `${top} ${bottom}`;
    const fig = document.createElement("figure");
    fig.className = "meme-card reveal wobble";
    fig.style.setProperty("--tilt", `${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg`);
    fig.style.setProperty("--reveal-delay", `${(i % 4) * 80}ms`);
    fig.style.margin = "0";
    const frame = document.createElement("div");
    frame.className = "meme-frame";
    frame.innerHTML = memeSvg(tpl, top, bottom, LOGO_SRC, title);
    document.fonts.ready.then(() => {
      frame.innerHTML = memeSvg(tpl, top, bottom, LOGO_SRC, title);
    });
    const cap = document.createElement("figcaption");
    const name = document.createElement("span");
    name.textContent = tpl.title;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-ghost";
    btn.textContent = "Download PNG";
    btn.setAttribute("aria-label", `Download the ${tpl.title} meme as PNG`);
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const logo = await getLogoDataUrl();
        await document.fonts.ready;
        const svg = await withEmbeddedFonts(memeSvg(tpl, top, bottom, logo, title));
        await downloadSvgAsPng(svg, `oops-${tpl.id}.png`);
        status.textContent = "";
      } catch (err) {
        status.textContent = "Unable to export the PNG in this browser.";
        console.error(err);
      } finally {
        btn.disabled = false;
      }
    });
    cap.append(name, btn);
    fig.append(frame, cap);
    grid.appendChild(fig);
  });
}

const SHUFFLE_LINES = [
  ["I measured twice", "and still cut wrong"],
  ["Trust the science", "the science is a frog"],
  ["Significant at p < 0.05", "if you squint"],
  ["Step 1: hypothesis", "Step 2: oops"],
  ["Peer reviewed", "by my cat"],
  ["It worked in theory", "theory has left the lab"],
  ["Correlation", "is all I have"],
];

function initGenerator() {
  const picker = byId("template-picker");
  const frame = byId("gen-frame");
  const topInput = /** @type {HTMLInputElement} */ (byId("top-text"));
  const bottomInput = /** @type {HTMLInputElement} */ (byId("bottom-text"));
  const status = byId("gen-status");
  let current = TEMPLATES[0];

  TEMPLATES.forEach((tpl, i) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "template";
    input.value = tpl.id;
    input.checked = i === 0;
    input.addEventListener("change", () => {
      current = tpl;
      render();
    });
    label.append(input, document.createTextNode(tpl.title));
    picker.appendChild(label);
  });

  const render = () => {
    frame.innerHTML = memeSvg(current, topInput.value, bottomInput.value, LOGO_SRC, `Meme preview: ${topInput.value} ${bottomInput.value}`);
  };
  topInput.addEventListener("input", render);
  bottomInput.addEventListener("input", render);
  render();
  document.fonts.ready.then(render);

  byId("randomize-meme").addEventListener("click", () => {
    const [t, b] = SHUFFLE_LINES[Math.floor(Math.random() * SHUFFLE_LINES.length)];
    topInput.value = t;
    bottomInput.value = b;
    render();
  });

  const dl = /** @type {HTMLButtonElement} */ (byId("download-meme"));
  dl.addEventListener("click", async () => {
    dl.disabled = true;
    status.textContent = "Rendering PNG…";
    try {
      const logo = await getLogoDataUrl();
      await document.fonts.ready;
      const svg = await withEmbeddedFonts(memeSvg(current, topInput.value, bottomInput.value, logo, "OOPS meme"));
      await downloadSvgAsPng(svg, `oops-meme-${current.id}.png`);
      status.textContent = "PNG downloaded.";
    } catch (err) {
      status.textContent = "Unable to export the PNG in this browser.";
      console.error(err);
    } finally {
      dl.disabled = false;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Scroll reveals                                                      */
/* ------------------------------------------------------------------ */

function initReveals() {
  const items = document.querySelectorAll(".reveal");
  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("revealed"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
  );
  items.forEach((el) => io.observe(el));
}

function initConfetti() {
  document.querySelectorAll("[data-confetti]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const r = /** @type {HTMLElement} */ (el).getBoundingClientRect();
      const me = /** @type {MouseEvent} */ (e);
      const x = me.clientX || r.left + r.width / 2;
      const y = me.clientY || r.top + r.height / 2;
      burstConfetti(x, y);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

/** Apply every feed-driven surface on both first load and later polls.
 * @param {CoinData | null} coin
 */
function renderCoin(coin) {
  if (coin) applyLinks(coin);
  renderStats(coin);
  renderTokenomics(coin);
}

async function boot() {
  initMenu();
  initSteps();
  initCopyAndShare();
  initLab();
  initConfetti();
  initMagnetic();
  initDraggable();
  initMemeWall();
  initGenerator();
  initReveals();

  renderCoin(await loadCoin());

  window.setInterval(async () => {
    if (document.hidden) return;
    renderCoin(await loadCoin());
  }, REFRESH_MS);
}

boot();
