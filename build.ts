import tailwind from "bun-plugin-tailwind";
import { rm } from "node:fs/promises";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

// Build-time env inlining. Anything prefixed with NEXT_PUBLIC_ / PUBLIC_ that
// Vercel exposes during the build gets replaced as a string literal in the
// bundle. Frontend code reads via `process.env.NEXT_PUBLIC_WORKER_URL` etc.;
// at runtime in the browser there is no real `process.env`.
const define: Record<string, string> = {
  "process.env.NODE_ENV": JSON.stringify("production"),
};
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value !== "string") continue;
  if (key.startsWith("NEXT_PUBLIC_") || key.startsWith("PUBLIC_")) {
    define[`process.env.${key}`] = JSON.stringify(value);
  }
}

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define,
});

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}
