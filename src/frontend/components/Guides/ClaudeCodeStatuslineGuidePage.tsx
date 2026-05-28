import { CaretRight, CheckCircleIcon } from "@phosphor-icons/react";
import { Link } from "../../router";

const settingsJson = `{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}`;

const manualScript = `#!/usr/bin/env bash
input=$(cat)
model=$(echo "$input" | jq -r '.model.display_name')
cwd=$(echo "$input" | jq -r '.workspace.current_dir')
printf "\\033[1m%s\\033[0m  %s" "$model" "\${cwd##*/}"`;

export function ClaudeCodeStatuslineGuidePage() {
  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <main className="mx-auto max-w-5xl px-6 py-20 md:px-8 md:py-28">
        <section className="max-w-4xl">
          <div className="mb-6 inline-flex rounded-[999px] border border-white/[0.08] bg-[#161618] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
            Claude Code guide
          </div>
          <h1
            className="font-serif text-5xl leading-[1.02] tracking-[-0.035em] text-[#E8E8E6] md:text-7xl"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            How to make a Claude Code status line.
          </h1>
          <p className="mt-7 max-w-[68ch] text-[17px] leading-relaxed text-[#A8A8A4] md:text-[18px]">
            Claude Code calls the bottom bar a statusline. Many people search
            for it as a status line or status bar. Either way, it is a command
            that reads Claude Code session JSON and prints styled terminal text.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/builder"
              title="Claude Code Statusline Builder"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-5 py-3 text-[14px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
            >
              Claude Code statusline builder
              <CaretRight size={14} weight="bold" />
            </Link>
            <Link
              href="/community"
              title="Community-published Claude Code statusline designs"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-white/[0.08] bg-[#161618] px-5 py-3 text-[14px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
            >
              See real examples
            </Link>
          </div>
          <p className="mt-6 max-w-[68ch] text-[14px] leading-relaxed text-[#8A8A86]">
            Prefer to learn by example?{" "}
            <Link
              href="/community"
              className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
            >
              Browse community-published Claude Code statusline designs
            </Link>{" "}
            and fork any of them into the builder.
          </p>
        </section>

        <section className="mt-20 grid gap-5 md:grid-cols-3">
          <SummaryCard
            label="01"
            title="Design"
            body="Choose model, directory, git branch, cost, context usage, separators, glyphs, and ANSI styles."
          />
          <SummaryCard
            label="02"
            title="Preview"
            body="See the exact terminal output before installing anything into your Claude Code settings."
          />
          <SummaryCard
            label="03"
            title="Install"
            body="Generate a bash or PowerShell installer that updates settings.json without replacing your other keys."
          />
        </section>

        <GuideSection title="What is a Claude Code statusline?">
          <p>
            A Claude Code statusline is an executable command configured in your
            Claude settings. Claude Code sends the command a JSON payload on
            stdin. The command prints one line of text to stdout, and Claude Code
            renders that text as the status area at the bottom of the terminal.
          </p>
          <p>
            That means a statusline can show useful session context like the
            active model, current folder, git branch, changed lines, token
            context, session duration, and estimated cost.
          </p>
        </GuideSection>

        <GuideSection title="The manual way">
          <p>
            Manually building a Claude Code status line usually means writing a
            shell script, parsing JSON, printing ANSI escape codes, making the
            script executable, and then editing your Claude settings file.
          </p>
          <CodeBlock label="settings.json" code={settingsJson} />
          <CodeBlock label="statusline.sh" code={manualScript} />
          <p>
            This works, but it is easy to break quoting, ANSI colors, JSON field
            reads, or existing settings when editing by hand.
          </p>
        </GuideSection>

        <GuideSection title="The visual way with statusline.sh">
          <p>
            statusline.sh lets you build the same command visually. Drag elements
            into place, style them, preview the result, and install the generated
            script when it looks right.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <ChecklistItem text="Build from scratch or start with a template." />
            <ChecklistItem text="Customize colors, labels, separators, and conditional visibility." />
            <ChecklistItem text="Preview with mock Claude Code session data." />
            <ChecklistItem text="Install on macOS, Linux, or Windows." />
            <ChecklistItem text="Share a design or fork a community example." />
            <ChecklistItem text="Keep existing Claude settings intact during install." />
          </div>
        </GuideSection>

        <GuideSection title="What can you customize?">
          <div className="grid gap-4 md:grid-cols-2">
            <FeatureCard
              title="Session data"
              body="Add model name, working directory, git branch, changed lines, context percentage, cost, and elapsed session time."
            />
            <FeatureCard
              title="Terminal styling"
              body="Use bold, dim, italic, ANSI colors, 256-color values, and background colors without writing escape codes by hand."
            />
            <FeatureCard
              title="Layout"
              body="Compose text, separators, split segments, progress bars, and rotating labels into one compact terminal line."
            />
            <FeatureCard
              title="Install path"
              body="Export a script and settings merge for bash or PowerShell so the same design can work across operating systems."
            />
          </div>
        </GuideSection>

        <GuideSection title="Frequently asked questions">
          <FaqItem
            question="Is it called a statusline or a status bar?"
            answer="Claude Code documentation uses statusline. People often describe the same area as a status line or status bar because it sits at the bottom of the terminal."
          />
          <FaqItem
            question="Do I need to edit settings.json manually?"
            answer="No. The builder creates an installer that structurally merges the statusLine setting into your Claude settings while preserving other top-level keys."
          />
          <FaqItem
            question="Does this work on Windows?"
            answer="Yes. The builder can generate a PowerShell installer for Windows and a bash installer for macOS or Linux."
          />
          <FaqItem
            question="Can I customize colors and segments?"
            answer="Yes. You can add, remove, reorder, and style statusline elements visually, including ANSI colors and conditional elements."
          />
          <FaqItem
            question="Can I share my Claude Code statusline?"
            answer="Yes. You can publish a design to the community gallery and other users can preview or fork it into their own builder."
          />
        </GuideSection>

        <section className="mt-20 rounded-[10px] border border-white/[0.08] bg-[#161618] p-8 md:p-10">
          <div className="text-[12px] uppercase tracking-[0.14em] text-[#8A8A86]">
            Ready to build
          </div>
          <h2
            className="mt-4 font-serif text-3xl leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Create your Claude Code statusline visually.
          </h2>
          <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-[#8A8A86]">
            Start with a blank canvas, fork a template, or browse community
            examples to see how other developers structure their Claude Code
            status bar.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/builder"
              title="Claude Code Statusline Builder"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-4 py-2.5 text-[13px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
            >
              Open the Claude Code statusline builder
              <CaretRight size={14} weight="bold" />
            </Link>
            <Link
              href="/community"
              title="Browse Claude Code statusline examples"
              className="inline-flex items-center rounded-[6px] border border-white/[0.08] px-4 py-2.5 text-[13px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.16] hover:bg-white/[0.02]"
            >
              Browse community-published statusline examples
            </Link>
          </div>
        </section>

        <ContinueReading />
      </main>
    </div>
  );
}

/**
 * Forward-navigation block at the foot of the guide. Two cards: "Try the
 * builder" → /builder and "Browse examples" → /community. The anchor text is
 * keyword-rich on purpose — these are the two highest-value internal links a
 * reader of the guide can follow.
 */
function ContinueReading() {
  return (
    <section className="mt-16 border-t border-white/[0.06] pt-12">
      <div className="text-[12px] uppercase tracking-[0.14em] text-[#8A8A86]">
        Continue reading
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/builder"
          title="Claude Code Statusline Builder"
          className="group flex flex-col gap-3 rounded-[10px] border border-white/[0.08] bg-[#161618] p-6 no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
        >
          <div className="text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B]">
            Try the builder
          </div>
          <h3
            className="font-serif text-2xl tracking-[-0.03em] text-[#E8E8E6]"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Open the Claude Code statusline builder.
          </h3>
          <p className="text-[14px] leading-relaxed text-[#8A8A86]">
            Drag elements, style them, and generate a one-line installer for
            macOS, Linux, or Windows.
          </p>
          <div className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#E8E8E6]">
            Start building
            <CaretRight size={12} weight="bold" />
          </div>
        </Link>

        <Link
          href="/community"
          title="Community-published Claude Code statusline designs"
          className="group flex flex-col gap-3 rounded-[10px] border border-white/[0.08] bg-[#161618] p-6 no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
        >
          <div className="text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B]">
            Browse examples
          </div>
          <h3
            className="font-serif text-2xl tracking-[-0.03em] text-[#E8E8E6]"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            See real Claude Code statusline designs.
          </h3>
          <p className="text-[14px] leading-relaxed text-[#8A8A86]">
            Community-published statuslines you can preview, install with one
            command, or fork into the builder.
          </p>
          <div className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#E8E8E6]">
            Browse community gallery
            <CaretRight size={12} weight="bold" />
          </div>
        </Link>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-[10px] border border-white/[0.08] bg-[#161618] p-6">
      <div className="font-mono text-[12px] text-[#6F6F6B]">{label}</div>
      <h2
        className="mt-5 font-serif text-2xl tracking-[-0.03em] text-[#E8E8E6]"
        style={{
          fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
        }}
      >
        {title}
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-[#8A8A86]">{body}</p>
    </article>
  );
}

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-20 border-t border-white/[0.06] pt-12">
      <h2
        className="font-serif text-3xl leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
        style={{
          fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
        }}
      >
        {title}
      </h2>
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-[#A8A8A4]">
        {children}
      </div>
    </section>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-white/[0.08] bg-black/30">
      <div className="border-b border-white/[0.06] px-4 py-2 font-mono text-[12px] text-[#8A8A86]">
        {label}
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[12px] leading-relaxed text-[#E8E8E6]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-[10px] border border-white/[0.06] bg-[#161618] p-4 text-[14px] leading-relaxed text-[#A8A8A4]">
      <CheckCircleIcon
        size={16}
        weight="bold"
        className="mt-0.5 shrink-0 text-[#9CC09F]"
      />
      <span>{text}</span>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[10px] border border-white/[0.08] bg-[#161618] p-5">
      <h3 className="text-[15px] font-medium text-[#E8E8E6]">{title}</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-[#8A8A86]">
        {body}
      </p>
    </article>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border-b border-white/[0.06] py-6 first:pt-0">
      <h3 className="text-[16px] font-medium text-[#E8E8E6]">{question}</h3>
      <p className="mt-3 max-w-[72ch] text-[14px] leading-relaxed text-[#8A8A86]">
        {answer}
      </p>
    </div>
  );
}

export default ClaudeCodeStatuslineGuidePage;
