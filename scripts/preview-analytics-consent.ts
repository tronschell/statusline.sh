/** Local mock CMP/SDK harness + production build preview. No live Google calls. */
import { join } from "node:path";

const build = await Bun.build({
  entrypoints: [join(import.meta.dir, "../test/fixtures/google-consent-harness.ts")],
  target: "browser",
});
if (!build.success) throw new Error(build.logs.join("\n"));
const harness = await build.outputs[0]!.text();
let sdkRequests = 0;
let events: unknown[] = [];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Mock analytics consent test</title>
<style>body{max-width:850px;margin:40px auto;padding:0 24px;font:16px system-ui;background:#101216;color:#e8edf2}h1{font-size:28px}button{padding:10px;margin:5px;border-radius:6px;cursor:pointer}pre{white-space:pre-wrap;background:#20252c;padding:18px}a{color:#96c3ee}dialog{max-width:440px;padding:28px}strong{color:#eeb766}</style>
</head><body><h1>Mock CMP and fake GA SDK</h1>
<p><strong>Simulation only.</strong> These controls do not obtain real consent. The fake SDK and events stay on this loopback server. No request is sent to Google.</p>
<p>Mock consent: <b id="state">unknown</b> · Mock page: <span id="path"></span></p>
<button data-choice="granted">Accept mock analytics</button><button data-choice="denied">Refuse mock analytics</button>
<button id="manage">Manage mock preferences</button><button data-choice="denied">Withdraw mock consent</button>
<button data-choice="unavailable">Simulate unavailable CMP</button><button id="event">Send mock event</button>
<button id="navigate">Navigate mock page</button><button id="reset">Reset simulation</button>
<h2>Local mock network record</h2><pre id="requests"></pre>
<p><a href="/">Open actual production build</a> · <a href="/privacy">Open actual privacy page</a></p>
<dialog id="preferences"><h2>Mock preferences</h2><p>Opening this panel does not grant consent.</p>
<button data-choice="granted">Allow mock analytics</button><button data-choice="denied">Keep mock analytics off</button></dialog>
<script type="module" src="/__consent-harness.js"></script></body></html>`;

const sdk = `// TEST ONLY: a local mock, not Google's SDK.
let analyticsConsent = false;
function consume(item) {
  const args = Array.from(item);
  if (args[0] === 'consent') analyticsConsent = args[2].analytics_storage === 'granted';
  if (args[0] === 'event' && analyticsConsent && !window['ga-disable-G-JDKLE4R2EV']) {
    fetch('/__mock-collect', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});
  }
}
const queue = window.dataLayer || [];
queue.forEach(consume);
const push = queue.push.bind(queue);
queue.push = function(item) { consume(item); return push(item); };
`;

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4319,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/__consent-test")) return new Response(html, { headers: { "Content-Type": "text/html" } });
    if (path === "/__consent-harness.js") return new Response(harness, { headers: { "Content-Type": "text/javascript" } });
    if (path === "/__mock-gtag.js") {
      sdkRequests++;
      return new Response(sdk, { headers: { "Content-Type": "text/javascript", "Cache-Control": "no-store" } });
    }
    if (path === "/__mock-collect" && request.method === "POST") {
      events.push(await request.json());
      return new Response(null, { status: 204 });
    }
    if (path === "/__test-status") return Response.json({ sdkRequests, analyticsRequests: events.length, events });
    if (path === "/__test-reset" && request.method === "POST") {
      sdkRequests = 0; events = [];
      return new Response(null, { status: 204 });
    }
    const decoded = decodeURIComponent(path);
    if (decoded.includes("..")) return new Response("Not found", { status: 404 });
    for (const candidate of [decoded, `${decoded.replace(/\/+$/, "")}.html`]) {
      const asset = Bun.file(join(import.meta.dir, "../dist", candidate));
      if (await asset.exists()) return new Response(asset);
    }
    if (decoded.includes(".")) return new Response("Not found", { status: 404 });
    return new Response(Bun.file(join(import.meta.dir, "../dist/index.html")));
  },
});
console.log(`Mock consent harness: http://127.0.0.1:${server.port}/__consent-test`);
