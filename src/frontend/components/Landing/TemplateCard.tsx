import { CaretRight } from "@phosphor-icons/react";
import type { TemplateMeta } from "@statusline/shared/types";
import { Link } from "../../router";
import { AnimatedPreview } from "../Preview/AnimatedPreview";

export interface TemplateCardProps {
  template: TemplateMeta;
  className?: string;
  /**
   * Card position in the gallery. Used purely to stagger the animation start
   * offset so adjacent cards don't tick on the same frame.
   */
  index?: number;
}

export function TemplateCard({ template, className, index = 0 }: TemplateCardProps) {
  const href = `/builder?template=${encodeURIComponent(template.id)}`;
  // 437ms is coprime with each rotation period in galleryMock so adjacent
  // cards land on different branch/model/style frames at any moment.
  const startOffsetMs = (index * 437) % 12000;
  return (
    <Link
      href={href}
      aria-label={`Use ${template.name} template`}
      className={
        "group flex h-full flex-col overflow-hidden rounded-[10px] border border-border bg-surface " +
        "text-text no-underline transition-colors duration-200 hover:border-white/20 hover:bg-surface-2 " +
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-fg " +
        (className ?? "")
      }
    >
      <div aria-hidden="true">
        <AnimatedPreview
          design={template.design}
          className="rounded-none! border-0! border-b! border-border!"
          bodyClassName="flex h-[112px] items-center text-[12px] leading-relaxed"
          startOffsetMs={startOffsetMs}
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[17px] font-medium leading-snug tracking-tight">{template.name}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
          {template.description}
        </p>
        {template.authorCredit ? (
          <p className="mt-2 text-[12px] text-text-muted">
            {template.authorCredit}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[13px] text-text-muted transition-colors group-hover:text-text group-focus-visible:text-text">
          <span>Use template</span>
          <CaretRight size={14} weight="bold" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}
