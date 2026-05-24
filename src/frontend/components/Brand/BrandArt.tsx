import { BRAND_ART_STATUSLINE_SH, BRAND_NAME } from "@statusline/shared/brandArt";

export type BrandArtSize = "xs" | "sm" | "md" | "lg";

interface BrandArtProps {
  size?: BrandArtSize;
  /** CSS color value. Defaults to the body foreground. */
  color?: string;
  /** Extra classes appended to the <pre>. */
  className?: string;
}

const SIZE_TO_FONT: Record<BrandArtSize, string> = {
  xs: "4px",
  sm: "5px",
  md: "8px",
  lg: "11px",
};

/**
 * The "statusline.sh" brand mark rendered as ASCII art.
 * Used anywhere the brand name appears in the UI.
 */
export function BrandArt({
  size = "md",
  color,
  className = "",
}: BrandArtProps) {
  const fontSize = SIZE_TO_FONT[size];
  return (
    <pre
      aria-label={BRAND_NAME}
      role="img"
      className={"font-mono whitespace-pre m-0 select-none " + className}
      style={{
        fontSize,
        lineHeight: "1em",
        color: color ?? "currentColor",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "geometricPrecision",
      }}
    >
      {BRAND_ART_STATUSLINE_SH}
    </pre>
  );
}

export default BrandArt;
