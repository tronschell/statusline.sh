import { serve } from "bun";
import index from "./index.html";

const port = Number(process.env.PORT ?? 3001);
const isDev = process.env.NODE_ENV !== "production";

const server = serve({
  port,
  routes: {
    "/*": index,
  },
  development: isDev,
});

console.log(`SPA dev server: ${server.url}`);
console.log(`Worker expected at: http://localhost:8787 (run "bun --cwd worker dev" in another terminal)`);
