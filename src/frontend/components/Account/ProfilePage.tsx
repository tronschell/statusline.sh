import { useEffect, useState } from "react";
import { HandHeart } from "@phosphor-icons/react";
import { accountApi, type PublicProfile } from "../../lib/accountApi";
import { Link, useParams } from "../../router";
import { CardGrid, CommunityDesignCard, EmptyState } from "../Community/CommunityDesignCard";
import { Avatar, VerifiedBadge, fmtDate } from "./ui";

/** Public `/u/:username` page: the person's published designs, verified badge, donation link top right. */
export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    accountApi
      .profile(username)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error && /404/.test(e.message) ? "No one goes by that username." : String(e)));
    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <div className="mx-auto max-w-[1180px] px-6 pb-28 pt-14 md:px-8 md:pt-24">
        {error ? (
          <div role="alert" className="border-l-2 border-[#E89B9E]/60 py-1 pl-4">
            <p className="text-[14px] text-[#E89B9E]">{error}</p>
            <p className="mt-2 text-[13px] text-[#8A8A86]">
              <Link
                href="/community"
                className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
              >
                Browse the community gallery
              </Link>
            </p>
          </div>
        ) : null}
        {!data && !error ? (
          <div aria-busy="true" className="animate-pulse">
            <span className="sr-only">Loading…</span>
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-full bg-white/[0.05]" />
              <div className="flex-1">
                <div className="h-12 w-1/2 rounded bg-white/[0.05]" />
                <div className="mt-4 h-3.5 w-1/3 rounded bg-white/[0.04]" />
              </div>
            </div>
          </div>
        ) : null}
        {data ? (
          <>
            <header className="mb-14 flex flex-col items-start justify-between gap-6 md:mb-20 md:flex-row md:items-start md:gap-12">
              <div className="flex min-w-0 items-center gap-5 md:gap-7">
                <Avatar name={data.user.display_name} url={data.user.avatar_url} size={80} />
                <div className="min-w-0">
                  <h1
                    className="flex items-center gap-3 text-[40px] leading-[1.02] tracking-tight md:text-[64px]"
                    style={{ fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)" }}
                  >
                    <span className="min-w-0 break-words">{data.user.display_name}</span>
                    {data.user.verified ? <VerifiedBadge size={26} /> : null}
                  </h1>
                  <p className="mt-3 text-[14px] text-[#8A8A86]">
                    @{data.user.username}
                    <span aria-hidden="true" className="mx-2">·</span>
                    joined {fmtDate(data.user.joined_at)}
                  </p>
                </div>
              </div>
              {data.user.donation_url ? (
                <div className="shrink-0">
                  <DonateButton url={data.user.donation_url} />
                </div>
              ) : null}
            </header>

            <section aria-labelledby="published-heading">
              <div className="flex items-baseline gap-4 pb-5">
                <h2 id="published-heading" className="font-serif text-[28px] leading-none tracking-tight">
                  Published
                </h2>
                <span className="text-[13px] tabular-nums text-[#6F6F6B]">
                  {data.designs.length} design{data.designs.length === 1 ? "" : "s"}
                </span>
              </div>
              {data.designs.length === 0 ? (
                <EmptyState title="Nothing published yet.">
                  Designs @{data.user.username} publishes will show up here.
                </EmptyState>
              ) : (
                <CardGrid>
                  {data.designs.map((d) => (
                    <CommunityDesignCard key={d.id} summary={d} hideCreator />
                  ))}
                </CardGrid>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Support link supplied by the author. rel keeps the page from passing referrer/opener to a third party. */
export function DonateButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className="inline-flex items-center gap-2 rounded-[6px] border border-white/[0.12] px-4 py-2 text-[13px] font-medium text-[#E8E8E6] no-underline transition-colors hover:border-[#8FB8DA]/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <HandHeart size={16} weight="bold" className="text-[#8FB8DA]" />
      Support this creator
    </a>
  );
}
