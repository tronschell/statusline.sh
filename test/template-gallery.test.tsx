import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TEMPLATES } from "@statusline/shared/templates";
import { TemplateGallery } from "../src/frontend/components/Landing/TemplateGallery";

test("every gallery template renders visibly with a named builder link", () => {
  const html = renderToStaticMarkup(<TemplateGallery />);
  expect(html.match(/<li\b/g)).toHaveLength(TEMPLATES.length);
  expect(html.match(/<a\b/g)).toHaveLength(TEMPLATES.length);
  for (const template of TEMPLATES) {
    expect(html).toContain(`href="/builder?template=${encodeURIComponent(template.id)}"`);
    expect(html).toContain(`aria-label="Use ${template.name} template"`);
  }
  expect(html).not.toContain("[render error");
  expect(html).not.toContain("fade-up");
});
