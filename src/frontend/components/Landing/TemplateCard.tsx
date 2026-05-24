import { CaretRight } from "@phosphor-icons/react";
import type { TemplateMeta } from "../../../shared/types";
import { Link } from "../../router";
import { StaticPreview } from "../Preview/StaticPreview";

export interface TemplateCardProps {
  template: TemplateMeta;
  className?: string;
}

/**
 * One template card in the landing gallery.
 *
 * Lays out as a flex column with `h-full` so cards in the same bento row
 * stretch to equal height. Top: scaled-down static preview. Middle: name +
 * description. Footer (`mt-auto`): "Use template" CTA with an arrow that
 * slides on hover.
 */
export function TemplateCard({ template, className }: TemplateCardProps) {
  const href = `/builder?template=${encodeURIComponent(template.id)}`;
  return (
    <Link
      href={href}
      className={
        "group relative flex h-full flex-col rounded-[10px] border border-white/[0.06] bg-[#161618] p-5 " +
        "transition-[transform,border-color,background-color,box-shadow] duration-300 ease-out " +
        "hover:-translate-y-[2px] hover:border-white/[0.14] hover:bg-[#1A1A1C] " +
        "hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.6)] " +
        "no-underline text-inherit will-change-transform " +
        (className ?? "")
      }
    >
      {/* subtle top inner highlight that brightens on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="overflow-hidden">
        <StaticPreview design={template.design} className="text-[12px]" />
      </div>

      <div className="mt-5">
        <h3
          className="font-serif text-2xl text-[#E8E8E6] leading-tight tracking-tight"
          style={{ fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)" }}
        >
          {template.name}
        </h3>
        <p className="mt-2 text-[14px] text-[#8A8A86] leading-relaxed">
          {template.description}
        </p>
        {template.authorCredit ? (
          <p className="mt-2 text-[11px] uppercase tracking-wider text-[#8A8A86]/70">
            {template.authorCredit}
          </p>
        ) : null}
      </div>

      <div className="mt-5 inline-flex items-center gap-1 text-[13px] text-[#E8E8E6]/80 transition-colors duration-200 group-hover:text-[#E8E8E6] md:mt-auto md:pt-5">
        <span>Use template</span>
        <CaretRight
          size={12}
          weight="bold"
          className="transition-transform duration-200 ease-out group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}
