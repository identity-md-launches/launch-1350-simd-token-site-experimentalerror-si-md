import { defineConfig, type Plugin } from "vite";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "site");
const outDir = resolve(__dirname, "dist");

/**
 * The source in site/ runs with no build step, so run-time assets live in
 * site/assets and are referenced relatively. Vite hashes nothing here: assets
 * keep their file names so the same relative paths work in site/ and dist/,
 * and the few files not referenced from HTML/CSS (og image, apple icon, the
 * live-data snapshot and DexScreener header) are copied verbatim.
 */
function copyRuntimeAssets(): Plugin {
  return {
    name: "oops-copy-runtime-assets",
    closeBundle() {
      mkdirSync(resolve(outDir, "assets"), { recursive: true });
      cpSync(resolve(root, "assets"), resolve(outDir, "assets"), { recursive: true });
      cpSync(resolve(root, "dex-header.png"), resolve(outDir, "dex-header.png"));
      const coin = resolve(root, "simd-coin.json");
      if (existsSync(coin)) cpSync(coin, resolve(outDir, "simd-coin.json"));
    },
  };
}

export default defineConfig({
  root,
  base: "./",
  publicDir: false,
  plugins: [copyRuntimeAssets()],
  build: {
    outDir,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        index: resolve(root, "index.html"),
        lost: resolve(root, "404.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (info) =>
          /\.woff2?$/.test(info.names?.[0] ?? "") ? "assets/fonts/[name][extname]" : "assets/[name][extname]",
      },
    },
  },
});
