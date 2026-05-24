import { serve } from "bun";
import index from "./index.html";
import { routes as apiRoutes } from "./server/routes";

const allRoutes = {
  ...apiRoutes,
  "/*": index,
} as const;

const server = serve({
  routes: allRoutes,
  port: Number(process.env.PORT ?? 3000),

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

if (process.env.NODE_ENV !== "production") {
  console.log("Mounted routes:");
  for (const path of Object.keys(allRoutes)) {
    console.log(`  ${path}`);
  }
}

console.log(`Server running at ${server.url}`);
