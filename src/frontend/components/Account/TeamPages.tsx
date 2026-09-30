import { useEffect, useState, type FormEvent } from "react";
import { accountApi, type TeamDetail, type TeamSummary } from "../../lib/accountApi";
import { useAuthStore } from "../../store/authStore";
import { useDesignStore } from "../../store/designStore";
import { navigate } from "../../lib/navigate";
import { useParams } from "../../router";
import { Link } from "../../router";
import { CloudInstallLine } from "./LibraryPage";
import { Avatar, Btn, Card, CopyBtn, Field, LinkBtn, Notice, Page, RequireAuth, fmtDate, inputClass } from "./ui";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function TeamsPage() {
  return (
    <RequireAuth>
      {(me) => <TeamsInner pro={me.pro.active} cap={me.plan.teamCap} members={me.plan.teamMemberCap} />}
    </RequireAuth>
  );
}

function TeamsInner({ pro, cap, members }: { pro: boolean; cap: number; members: number }) {
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const design = useDesignStore((s) => s.design);

  useEffect(() => {
    accountApi.teams().then((r) => setTeams(r.teams)).catch((e) => setError(errMsg(e)));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const t = await accountApi.teamCreate(name.trim(), design);
      navigate(`/teams/${t.id}`);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Page
      eyebrow="Teams"
      title="Team statuslines"
      lead={`One shared statusline for everyone on a team. Whoever edits it, every member's install follows. Up to ${members} people per team; creating a team is part of Pro, joining one is free.`}
      actions={<LinkBtn href="/library">Library</LinkBtn>}
    >
      <div className="flex flex-col gap-5">
        {error ? <Notice>{error}</Notice> : null}
        {teams?.length ? (
          <Card title="Your teams">
            <ul className="divide-y divide-white/[0.05]">
              {teams.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/teams/${t.id}`} className="text-[14px] text-[#E8E8E6] no-underline hover:underline">
                    {t.name}
                  </Link>
                  <span className="text-[12px] text-[#6F6F6B]">{t.role}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card
          title="Create a team"
          description={`Starts from the design currently in your builder ("${design.name || "Untitled"}"). You can own up to ${cap} teams.`}
        >
          {pro ? (
            <form onSubmit={create} className="flex max-w-[520px] flex-col gap-4">
              <Field label="Team name">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
              </Field>
              <div>
                <Btn type="submit" variant="primary" disabled={busy}>
                  {busy ? "Creating…" : "Create team"}
                </Btn>
              </div>
            </form>
          ) : (
            <p className="text-[13px] text-[#8A8A86]">
              Creating a team needs Pro. <Link href="/pricing" className="text-[#E8E8E6] underline underline-offset-[4px]">See pricing</Link>.
            </p>
          )}
        </Card>
      </div>
    </Page>
  );
}

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <RequireAuth>{(me) => <TeamInner id={id} meId={me.user.id} />}</RequireAuth>;
}

function TeamInner({ id, meId }: { id: string; meId: string }) {
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    accountApi
      .team(id)
      .then(setTeam)
      .catch((e) => setError(errMsg(e)));
  useEffect(() => {
    void load();
  }, [id]);

  if (error && !team) {
    return (
      <Page title="Team not found">
        <Notice>{error}</Notice>
      </Page>
    );
  }
  if (!team) return <Page title="Team">{null}</Page>;

  const owner = team.role === "owner";
  const inviteUrl = team.invite_token ? `${window.location.origin}/join-team?token=${team.invite_token}` : null;

  return (
    <Page
      eyebrow="Team"
      title={team.name}
      lead={`${team.members.length} member${team.members.length === 1 ? "" : "s"} · you are ${owner ? "the owner" : "an editor"}`}
      actions={
        <>
          {team.design ? (
            <Btn variant="primary" onClick={() => navigate(`/builder?library=${team.design!.id}`)}>
              Edit team statusline
            </Btn>
          ) : null}
          <LinkBtn href="/teams">All teams</LinkBtn>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? <Notice>{error}</Notice> : null}
        {owner && team.owner_pro === false ? (
          <Notice tone="info">
            Your Pro plan has lapsed, so this team statusline is read-only until you renew. Members' installs keep working.{" "}
            <Link href="/pricing">Renew Pro</Link>
          </Notice>
        ) : null}

        {team.design ? (
          <Card title="Install for the team" description={`Version ${team.design.version}, updated ${fmtDate(team.design.updated_at)}. Everyone runs this once; after that it updates itself.`}>
            <CloudInstallLine id={team.design.id} />
          </Card>
        ) : null}

        {inviteUrl ? (
          <Card title="Invite people" description="Anyone with this link can join after signing in. Rotate it to invalidate old links.">
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-[6px] border border-white/[0.06] bg-[#0E0E10] px-3 py-2 font-mono text-[12px] text-[#E8E8E6]">
                {inviteUrl}
              </code>
              <CopyBtn text={inviteUrl} label="Copy link" />
              <Btn
                onClick={async () => {
                  try {
                    await accountApi.teamInvite(team.id);
                    await load();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Rotate
              </Btn>
            </div>
          </Card>
        ) : null}

        <Card title="Members">
          <ul className="divide-y divide-white/[0.05]">
            {team.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={m.display_name} url={m.avatar_url} />
                  <span className="truncate text-[14px] text-[#E8E8E6]">@{m.username}</span>
                  <span className="text-[12px] text-[#6F6F6B]">{m.role}</span>
                </span>
                {m.role !== "owner" && (owner || m.id === meId) ? (
                  <Btn
                    variant="danger"
                    onClick={async () => {
                      try {
                        await accountApi.teamRemove(team.id, m.id);
                        if (m.id === meId) navigate("/teams");
                        else await load();
                      } catch (e) {
                        setError(errMsg(e));
                      }
                    }}
                  >
                    {m.id === meId ? "Leave" : "Remove"}
                  </Btn>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        {owner ? (
          <div>
            <Btn
              variant="danger"
              onClick={async () => {
                if (!window.confirm(`Delete team "${team.name}"? Members' installs will stop updating.`)) return;
                try {
                  await accountApi.teamDelete(team.id);
                  navigate("/teams");
                } catch (e) {
                  setError(errMsg(e));
                }
              }}
            >
              Delete team
            </Btn>
          </div>
        ) : null}
      </div>
    </Page>
  );
}

/** `/join-team?token=…` — the destination of a team invite link. */
export function JoinTeamPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const me = useAuthStore((s) => s.me);
  const ready = useAuthStore((s) => s.ready);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!me) {
      navigate(`/signin?next=${encodeURIComponent(`/join-team?token=${token}`)}`);
      return;
    }
    accountApi
      .teamJoin(token)
      .then((r) => navigate(`/teams/${r.team_id}`))
      .catch((e) => setError(errMsg(e)));
  }, [ready, me, token]);

  return (
    <Page title={error ? "Couldn't join the team" : "Joining team…"} width="max-w-[520px]">
      {error ? <Notice>{error}</Notice> : null}
    </Page>
  );
}
