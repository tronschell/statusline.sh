import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 9. Vital Signs — traffic-light dashboard for rate limits + tokens.
// Showcases rateLimit5h/7d bars (with reset times) and contextTokens.
// Palette mirrors the design-system pastels at slightly higher saturation.
export const template: TemplateMeta = {
  id: "vital-signs",
  name: "Vital Signs",
  description:
    "Traffic-light dashboard for 5h + 7d rate limits and token usage.",
  design: {
    version: 1,
    name: "Vital Signs",
    elements: [
      el({
        id: "vs_model",
        type: "model",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0xff, g: 0xff, b: 0xff },
          bg: { kind: "rgb", r: 0x2b, g: 0x2f, b: 0x3a },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "vs_gap1",
        type: "static",
        text: " ",
        style: s({}),
      }),
      el({
        id: "vs_5h_label",
        type: "static",
        text: "5h ",
        style: s({ dim: true, fg: { kind: "rgb", r: 0x9c, g: 0xc0, b: 0x9f } }),
      }),
      el({
        id: "vs_5h_bar",
        type: "rateLimit5h",
        variant: "bar",
        width: 10,
        filledChar: "▰",
        emptyChar: "▱",
        showResetTime: true,
        style: s({ fg: { kind: "rgb", r: 0x9c, g: 0xc0, b: 0x9f } }),
        suffix: " ",
      }),
      el({
        id: "vs_7d_label",
        type: "static",
        text: "7d ",
        style: s({ dim: true, fg: { kind: "rgb", r: 0xd8, g: 0xb8, b: 0x70 } }),
      }),
      el({
        id: "vs_7d_bar",
        type: "rateLimit7d",
        variant: "bar",
        width: 10,
        filledChar: "▰",
        emptyChar: "▱",
        showResetTime: true,
        style: s({ fg: { kind: "rgb", r: 0xd8, g: 0xb8, b: 0x70 } }),
        suffix: " ",
      }),
      el({
        id: "vs_ctx_label",
        type: "static",
        text: "tok ",
        style: s({ dim: true, fg: { kind: "rgb", r: 0x8f, g: 0xb8, b: 0xda } }),
      }),
      el({
        id: "vs_tokens",
        type: "contextTokens",
        variant: "used",
        compact: true,
        colorMode: "percentage",
        style: s({ bold: true, fg: { kind: "rgb", r: 0x8f, g: 0xb8, b: 0xda } }),
      }),
    ],
  },
};
