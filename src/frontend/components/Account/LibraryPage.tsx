import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { accountApi, ApiError, type CloudDesign, type VersionRow } from "../../lib/accountApi";
import { useOsDetect } from "../../hooks/useOsDetect";
import { navigate } from "../../lib/navigate";
import { Link } from "../../router";
import { StaticPreview } from "../Preview/StaticPreview";
import { Btn, Card, CopyBtn, Field, LinkBtn, Notice, Page, RequireAuth, fmtDate, inputClass } from "./ui";
import type { Me } from "../../lib/accountApi";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function LibraryPage() {
  return <RequireAuth>{(me) => <LibraryInner me={me} />}</RequireAuth>;
}

/** Install one-liner for a permanent link, matching the visitor's OS. */
export function CloudInstallLine({ id }: { id: string }) {
  const detected = useOsDetect();
  const os = detected === "unknown" ? "mac" : detected;
  const line = api.oneLiner(id, os, false);
  return (
    <div className="flex items-stretch gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-[6px] border border-white/[0.06] bg-[#0E0E10] px-3 py-2 font-mono text-[12px] text-[#E8E8E6]">
        {line}
      </code>
      <CopyBtn text={line} />
    </div>
  );
}

function LibraryInner({ me }: { me: Me }) {
  const [items, setItems] = useState<CloudDesign[] | null>(null);
  const [cap, setCap] = useState(me.plan.freeLibraryCap);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    accountApi
      .library()
      .then((r) => {
        setItems(r.items);
        setCap(r.cap);
      })
      .catch((e) => setError(errMsg(e)));
  useEffect(() => {
    void load();
  }, []);

  return (
    <Page
      eyebrow="Library"
      title="Your private library"
      lead={
        me.pro.active
          ? "Every design here has a permanent link. Edit it in the builder and every machine that installed it updates on its own."
          : `Saved designs are private to you. Free accounts keep ${me.plan.freeLibraryCap}; Pro adds permanent auto-updating links and up to ${me.plan.proLibraryCap}.`
      }
      actions={
        <>
          <LinkBtn href="/teams">Teams</LinkBtn>
          <LinkBtn href="/builder" variant="primary">
            Open builder
          </LinkBtn>
        </>
      }
    >
      {error ? <Notice>{error}</Notice> : null}
      {items && items.length === 0 ? (
        <Card>
          <p className="text-[14px] text-[#8A8A86]">
            Nothing saved yet. Build a statusline and press <strong className="text-[#E8E8E6]">Save to library</strong> in the builder's top bar.
          </p>
        </Card>
      ) : null}
      {items ? (
        <p className="mb-4 text-[12px] text-[#6F6F6B]">
          {items.length} of {cap} saved
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        {items?.map((d) => (
          <LibraryItem key={d.id} d={d} pro={me.pro.active} onChanged={load} />
        ))}
      </div>
    </Page>
  );
}

function LibraryItem({ d, pro, onChanged }: { d: CloudDesign; pro: boolean; onChanged(): void }) {
  const [open, setOpen] = useState<null | "versions" | "publish" | "install">(null);
  const [versions, setVersions] = useState<{ current: number; versions: VersionRow[] } | null>(null);
  const [desc, setDesc] = useState("");
  const [published, setPublished] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "pro_required" ? `${e.message} See Pricing.` : errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (which: "versions" | "publish" | "install") => {
    const next = open === which ? null : which;
    setOpen(next);
    if (next === "versions") void accountApi.libraryVersions(d.id).then(setVersions).catch((e) => setError(errMsg(e)));
  };

  return (
    <Card>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-medium text-[#E8E8E6]">{d.name}</h3>
          <p className="mt-1 text-[12px] text-[#6F6F6B]">
            v{d.version} · updated {fmtDate(d.updated_at)} ·{" "}
            {d.link_enabled ? <span className="text-[#8FB8DA]">permanent link on</span> : "link off"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn variant="primary" onClick={() => navigate(`/builder?library=${d.id}`)}>
              Edit
            </Btn>
            <Btn onClick={() => toggle("install")} disabled={!d.link_enabled}>
              Install link
            </Btn>
            <Btn onClick={() => toggle("versions")}>History</Btn>
            <Btn onClick={() => toggle("publish")}>Publish</Btn>
          </div>
        </div>
        <div className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#0E0E10] p-3">
          <StaticPreview design={d.design} />
        </div>
      </div>

      {!d.link_enabled && !pro ? (
        <p className="mt-4 text-[12px] text-[#8A8A86]">
          Permanent auto-updating links are part of <Link href="/pricing" className="text-[#E8E8E6] underline underline-offset-[4px]">Pro</Link>.
        </p>
      ) : null}

      {open === "install" && d.link_enabled ? (
        <div className="mt-5 flex flex-col gap-2">
          <CloudInstallLine id={d.id} />
          <p className="text-[12px] text-[#6F6F6B]">
            Installed copies check this link every few hours and pick up your saved changes. Set{" "}
            <code className="font-mono">STATUSLINE_NO_UPDATE=1</code> on a machine to opt out.
          </p>
        </div>
      ) : null}

      {open === "versions" ? (
        <ul className="mt-5 divide-y divide-white/[0.05] text-[13px]">
          {versions?.versions.map((v) => (
            <li key={v.version} className="flex items-center justify-between gap-3 py-2">
              <span className="text-[#E8E8E6]">
                v{v.version}
                {v.version === versions.current ? <span className="ml-2 text-[#6F6F6B]">current</span> : null}
              </span>
              <span className="text-[#6F6F6B]">{fmtDate(v.created_at)}</span>
              {v.version !== versions.current ? (
                <Btn
                  disabled={busy}
                  onClick={() =>
                    guard(async () => {
                      await accountApi.libraryRestore(d.id, v.version);
                      setOpen(null);
                      onChanged();
                    })
                  }
                >
                  Restore
                </Btn>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {open === "publish" ? (
        <div className="mt-5 flex max-w-[520px] flex-col gap-3">
          {published ? (
            <Notice tone="ok">
              Published. <Link href={`/community/${published}`}>View on the community</Link>
            </Notice>
          ) : (
            <>
              <Field label="Description (optional)">
                <textarea className={inputClass + " resize-none"} rows={2} maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} />
              </Field>
              <p className="text-[12px] text-[#8A8A86]">Publishing creates a public copy under your @username. It is not linked to this private design.</p>
              <div>
                <Btn
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    guard(async () => {
                      const r = await accountApi.libraryPublish(d.id, { description: desc });
                      setPublished(r.slug);
                    })
                  }
                >
                  Publish to community
                </Btn>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
        <div className="flex flex-wrap gap-2">
          {pro || d.link_enabled ? (
            <Btn
              disabled={busy}
              onClick={() =>
                guard(async () => {
                  await accountApi.librarySetLink(d.id, !d.link_enabled);
                  onChanged();
                })
              }
            >
              {d.link_enabled ? "Turn link off" : "Turn link on"}
            </Btn>
          ) : null}
        </div>
        <Btn
          variant="danger"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`Delete "${d.name}"? Installs that use its permanent link will stop updating.`)) return;
            void guard(async () => {
              await accountApi.libraryDelete(d.id);
              onChanged();
            });
          }}
        >
          Delete
        </Btn>
      </div>
      {error ? (
        <div className="mt-3">
          <Notice>{error}</Notice>
        </div>
      ) : null}
    </Card>
  );
}
