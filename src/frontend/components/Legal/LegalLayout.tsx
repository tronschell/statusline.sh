import type { ReactNode } from "react";

/**
 * Shared shell for /privacy and /terms. Editorial single-column layout that
 * matches the LandingPage typography (serif headings, muted body copy).
 */
export function LegalLayout({
  title,
  subtitle,
  lastUpdated,
  children,
}: {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <main className="mx-auto max-w-3xl px-6 pt-24 pb-24 md:pt-32 md:pb-32">
        <div className="mb-12">
          <div className="text-[12px] uppercase tracking-[0.16em] text-[#8A8A86]">
            Last updated · {lastUpdated}
          </div>
          <h1
            className="mt-4 font-serif text-4xl md:text-5xl leading-[1.05] tracking-tight"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-[#8A8A86]">
              {subtitle}
            </p>
          ) : null}
        </div>

        <article className="prose-legal space-y-8 text-[15px] leading-relaxed text-[#C7C7C3]">
          {children}
        </article>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] font-medium uppercase tracking-[0.14em] text-[#E8E8E6]">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default LegalLayout;
