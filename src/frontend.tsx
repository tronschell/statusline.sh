/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startGoogleAnalytics } from "./frontend/lib/googleAnalytics";
import { googleConsent } from "./frontend/lib/googleConsentRuntime";

// Google owns the consent record and UI. Without its configured/published
// message and explicit analytics grant, the gate stays closed worldwide.
startGoogleAnalytics(window, googleConsent);

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
(import.meta.hot.data.root ??= createRoot(elem)).render(app);
