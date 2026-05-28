// PNG rasterisation of the community OG SVG.
//
// Why a Worker-side rasteriser at all?
// ------------------------------------
// Most social link previewers (Twitter / X, Slack, Discord, iMessage,
// LinkedIn, Facebook) refuse to render SVG `og:image` URLs and just show a
// blank card. Google's crawler is the only consumer that handles the SVG
// today. To make share cards actually appear in every chat app, we have to
// hand back a PNG.
//
// Renderer choice: `@resvg/resvg-wasm`.
// We already render a deterministic SVG in `renderCommunityOgSvg`. Wrapping
// that output in resvg-wasm keeps a single source of truth — colours, copy,
// and layout never drift between the SVG and PNG endpoints. Satori-based
// alternatives (workers-og, @vercel/og) would require porting the SVG into
// JSX and writing a font-shaping pipeline; not worth the duplication when a
// straight SVG→PNG path exists.
//
// Wasm loading: `import wasmModule from ".../index_bg.wasm"`.
// Wrangler compiles `.wasm` imports into `WebAssembly.Module` objects bound
// into the deployed worker bundle (this is the standard CF Workers WASM
// pattern — no fetch at runtime). Bun's test runtime, by contrast, returns
// the resolved file path as a string for `.wasm` imports; we feature-detect
// and read the bytes in that branch so `bun test` works without spinning up
// Wrangler.
//
// Initialization is one-shot per isolate. We cache the in-flight promise so
// concurrent OG requests don't double-init the wasm instance.

import { initWasm, Resvg } from "@resvg/resvg-wasm";
// @ts-expect-error — Wrangler treats `.wasm` imports as WebAssembly.Module;
// Bun's bundler returns the resolved file path string. We handle both below.
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";

let wasmInitPromise: Promise<void> | null = null;

async function ensureWasmReady(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      // Workers/Wrangler path: `wasmModule` is already a `WebAssembly.Module`.
      if (wasmModule instanceof WebAssembly.Module) {
        await initWasm(wasmModule);
        return;
      }
      // Bun/test path: `wasmModule` is a file path string. Read the bytes
      // and pass them to initWasm (which accepts a BufferSource).
      //
      // The `node:fs/promises` import is gated behind `new Function(...)`
      // so Wrangler's bundler can't statically see it and warn / try to
      // pull it into the Workers build. In production this branch is
      // unreachable because `wasmModule instanceof WebAssembly.Module`
      // already returned above.
      if (typeof wasmModule === "string") {
        const dynamicImport = new Function(
          "spec",
          "return import(spec)",
        ) as (spec: string) => Promise<{ readFile: (p: string) => Promise<Uint8Array> }>;
        const { readFile } = await dynamicImport("node:fs/promises");
        const bytes = await readFile(wasmModule);
        await initWasm(bytes);
        return;
      }
      throw new Error(
        `Unsupported wasm module shape: ${typeof wasmModule}`,
      );
    })().catch((err) => {
      // Reset on failure so a transient error doesn't permanently break the
      // endpoint within this isolate.
      wasmInitPromise = null;
      throw err;
    });
  }
  return wasmInitPromise;
}

/**
 * Rasterise an SVG document to a 1200×630 PNG byte array.
 *
 * `loadSystemFonts: false` is critical — system font enumeration is slow at
 * cold start and unavailable in CF Workers anyway. The SVG already declares
 * fallback font stacks (Georgia, monospace, sans-serif), and resvg's defaults
 * substitute reasonable bundled glyphs for them.
 */
export async function renderOgPng(svg: string): Promise<Uint8Array> {
  await ensureWasmReady();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      loadSystemFonts: false,
    },
  });
  const rendered = resvg.render();
  const png = rendered.asPng();
  rendered.free();
  resvg.free();
  return png;
}
