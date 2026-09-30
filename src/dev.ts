import { file, serve } from "bun";
import { basename, join } from "node:path";
import index from "./index.html";

const port = Number(process.env.PORT ?? 3001);
const isDev = process.env.NODE_ENV !== "production";

// Guide screenshots + OG image live in src/static; `build.ts` copies them into
// dist. Mirror that here so `/guides/*.webp` and `/og-guide.png` work in dev
// (the SPA catch-all below would otherwise answer with index.html).
const STATIC_DIR = join(import.meta.dir, "static");

async function serveStatic(relative: string): Promise<Response> {
  const asset = file(join(STATIC_DIR, relative));
  return (await asset.exists())
    ? new Response(asset)
    : new Response("Not found", { status: 404 });
}

const server = serve({
  port,
  routes: {
    "/guides/:name": (req) => serveStatic(join("guides", basename(req.params.name))),
    "/og-guide.png": () => serveStatic("og-guide.png"),
    "/*": index,
  },
  development: isDev,
});

console.log(`SPA dev server: ${server.url}`);
console.log(`Worker expected at: http://localhost:8787 (run "bun --cwd worker dev" in another terminal)`);
