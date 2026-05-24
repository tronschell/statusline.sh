import { useEffect, useRef } from "react";
import { TEMPLATES } from "@statusline/shared/templates";
import { TemplateCard } from "./TemplateCard";

/**
 * Asymmetric bento grid of all `TEMPLATES` on a 12-col grid.
 *
 * Rows always sum to 12 so there are no orphan gaps:
 *   Row 1: 6 + 3 + 3  (hero showcase + two compacts)
 *   Row 2: 4 + 4 + 4  (medium trio)
 *   Row 3: 6 + 6      (wide pair)
 *
 * Cards fade up on scroll-into-view with a staggered delay so the grid
 * cascades rather than popping in all at once.
 */
export function TemplateGallery() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>("[data-template-card]"),
    );

    if (typeof IntersectionObserver === "undefined") {
      for (const el of items) el.setAttribute("data-visible", "true");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );

    for (const el of items) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="grid grid-cols-12 gap-5">
      {TEMPLATES.map((t, i) => {
        const colSpan = colSpanForIndex(i);
        const delay = Math.min(i, 5) * 70;
        return (
          <div
            key={t.id}
            data-template-card
            className={`${colSpan} min-w-0 fade-up`}
            style={{ transitionDelay: `${delay}ms` }}
          >
            <TemplateCard template={t} />
          </div>
        );
      })}
    </div>
  );
}

function colSpanForIndex(i: number): string {
  // Row 1: 6 + 3 + 3
  if (i === 0) return "col-span-12 md:col-span-6";
  if (i === 1 || i === 2) return "col-span-6 md:col-span-3";
  // Row 2: 4 + 4 + 4
  if (i >= 3 && i <= 5) return "col-span-12 sm:col-span-6 md:col-span-4";
  // Row 3: 6 + 6
  return "col-span-12 md:col-span-6";
}
