import { TEMPLATES } from "@statusline/shared/templates";
import { TemplateCard } from "./TemplateCard";

export function TemplateGallery() {
  return (
    <ul className="grid grid-cols-12 gap-5">
      {TEMPLATES.map((template, index) => (
        <li key={template.id} className={`${colSpanForIndex(index)} min-w-0`}>
          <TemplateCard template={template} index={index} />
        </li>
      ))}
    </ul>
  );
}

function colSpanForIndex(index: number): string {
  if (index === 0) return "col-span-12 lg:col-span-6";
  if (index === 1 || index === 2) return "col-span-12 sm:col-span-6 lg:col-span-3";
  if (index === 3 || index === 4) return "col-span-12 sm:col-span-6 lg:col-span-4";
  if (index === 5) return "col-span-12 lg:col-span-4";
  return "col-span-12 md:col-span-6";
}
