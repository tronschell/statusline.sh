import { useEffect, useState, type FormEvent } from "react";
import { GithubLogo, GoogleLogo } from "@phosphor-icons/react";
import { accountApi, type Providers } from "../../lib/accountApi";
import { navigate } from "../../lib/navigate";
import { useAuthStore } from "../../store/authStore";
import { Link } from "../../router";
import { Btn, Card, Field, Notice, Page, inputClass } from "./ui";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type Mode = "signin" | "signup" | "forgot" | "forgot-username";

const IS_LOCAL =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export function SignInPage() {
  const me = useAuthStore((s) => s.me);
  const signIn = useAuthStore((s) => s.signIn);
  const next = safeNext(new URLSearchParams(window.location.search).get("next"));
  const [mode, setMode] = useState<Mode>("signin");
  const [providers, setProviders] = useState<Providers | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    accountApi.providers().then(setProviders).catch(() => setProviders(null));
  }, []);

  // Already signed in (or just became so): go where they were headed.
  useEffect(() => {
    if (me) navigate(next);
  }, [me, next]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setInfo(null);
    setDevToken(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signin") {
        const s = await accountApi.login(identifier.trim(), password);
        await signIn(s.token);
      } else if (mode === "signup") {
        const s = await accountApi.signup({
          email: email.trim(),
          password,
          username: username.trim() || undefined,
        });
        await signIn(s.token);
      } else if (mode === "forgot") {
        const r = await accountApi.forgotPassword(email.trim());
        setInfo("If an account exists for that email, a reset link is on its way. It expires in one hour.");
        if (r.dev_token) setDevToken(r.dev_token);
      } else {
        await accountApi.forgotUsername(email.trim());
        setInfo("If an account exists for that email, we've sent the username to it.");
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    signin: "Sign in",
    signup: "Create your account",
    forgot: "Reset your password",
    "forgot-username": "Find your username",
  };

  return (
    <Page
      eyebrow="Account"
      title={titles[mode]}
      lead={
        mode === "signup"
          ? "Free to start. Save designs to a private library, get a public @username on the community, and upgrade to Pro whenever you like."
          : mode === "signin"
            ? "Sign in to reach your library, teams, and subscription."
            : "Enter the email on your account."
      }
      width="max-w-[520px]"
    >
      <div className="flex flex-col gap-4">
        <Card>
          {(mode === "signin" || mode === "signup") && providers && (providers.github || providers.google) ? (
            <div className="mb-5 flex flex-col gap-2">
              {providers.github ? (
                <a
                  href={accountApi.oauthUrl("github", next)}
                  className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-white/[0.08] bg-[#1C1C1F] px-3.5 py-2.5 text-[13px] font-medium text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.18]"
                >
                  <GithubLogo size={16} weight="bold" />
                  Continue with GitHub
                </a>
              ) : null}
              {providers.google ? (
                <a
                  href={accountApi.oauthUrl("google", next)}
                  className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-white/[0.08] bg-[#1C1C1F] px-3.5 py-2.5 text-[13px] font-medium text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.18]"
                >
                  <GoogleLogo size={16} weight="bold" />
                  Continue with Google
                </a>
              ) : null}
              <div className="my-2 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B]">
                <span className="h-px flex-1 bg-white/[0.06]" />
                or with email
                <span className="h-px flex-1 bg-white/[0.06]" />
              </div>
            </div>
          ) : null}

          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === "signin" ? (
              <Field label="Email or username">
                <input
                  className={inputClass}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </Field>
            ) : (
              <Field label="Email">
                <input
                  className={inputClass}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
            )}

            {mode === "signup" ? (
              <Field label="Username" hint="Shown on the community as @username. Leave blank to pick one for you.">
                <input
                  className={inputClass}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  maxLength={30}
                />
              </Field>
            ) : null}

            {mode === "signin" || mode === "signup" ? (
              <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
                <input
                  className={inputClass}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                />
              </Field>
            ) : null}

            {error ? <Notice>{error}</Notice> : null}
            {info ? <Notice tone="ok">{info}</Notice> : null}
            {devToken ? (
              <Notice tone="info">
                Dev mode: <Link href={`/reset-password?token=${devToken}`}>open reset link</Link>
              </Notice>
            ) : null}

            <Btn type="submit" variant="primary" disabled={busy}>
              {busy
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Send my username"}
            </Btn>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#8A8A86]">
            {mode === "signin" ? (
              <>
                <button type="button" className="hover:text-[#E8E8E6]" onClick={() => switchMode("forgot")}>
                  Forgot password?
                </button>
                <button type="button" className="hover:text-[#E8E8E6]" onClick={() => switchMode("forgot-username")}>
                  Forgot username?
                </button>
              </>
            ) : (
              <button type="button" className="hover:text-[#E8E8E6]" onClick={() => switchMode("signin")}>
                Back to sign in
              </button>
            )}
          </div>
        </Card>

        {mode === "signin" || mode === "signup" ? (
          <p className="text-center text-[13px] text-[#8A8A86]">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px]"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        ) : null}

        {IS_LOCAL ? <DevSignIn onDone={(t) => void signIn(t)} /> : null}
      </div>
    </Page>
  );
}

/** Local-development shortcut; the Worker only honours /auth/dev when DEV_AUTH=1 on localhost. */
function DevSignIn({ onDone }: { onDone(token: string): void }) {
  const [name, setName] = useState("devuser");
  const [pro, setPro] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <details className="rounded-[10px] border border-dashed border-white/[0.1] px-4 py-3 text-[13px] text-[#8A8A86]">
      <summary className="cursor-pointer">Local dev sign-in</summary>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className={inputClass + " max-w-[180px]"} value={name} onChange={(e) => setName(e.target.value)} aria-label="Dev username" />
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} /> Pro
        </label>
        <Btn
          onClick={async () => {
            try {
              onDone((await accountApi.devLogin(name, pro)).token);
            } catch (e) {
              setErr(errMsg(e));
            }
          }}
        >
          Sign in
        </Btn>
      </div>
      {err ? <p className="mt-2 text-[#E89B9E]">{err}</p> : null}
    </details>
  );
}

/** Landing page for OAuth: the Worker redirects here with the session in the URL fragment. */
export function AuthCallbackPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frag = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // Scrub the token from the address bar / history immediately.
    window.history.replaceState({}, "", window.location.pathname);
    const token = frag.get("token");
    const err = frag.get("error");
    if (!token) {
      setError(
        err === "cancelled"
          ? "Sign-in was cancelled."
          : err
            ? "That sign-in didn't work. Try again, or use email and password."
            : "Missing sign-in token.",
      );
      return;
    }
    const next = safeNext(frag.get("next"));
    void signIn(token).then(() => navigate(next));
  }, [signIn]);

  return (
    <Page title={error ? "Couldn't sign you in" : "Signing you in…"} width="max-w-[520px]">
      {error ? (
        <div className="flex flex-col gap-4">
          <Notice>{error}</Notice>
          <Link href="/signin" className="text-[13px] text-[#E8E8E6] underline underline-offset-[4px]">
            Back to sign in
          </Link>
        </div>
      ) : null}
    </Page>
  );
}

export function ResetPasswordPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await accountApi.resetPassword(token, password);
      await signIn(s.token);
      navigate("/account?reset=1");
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Page eyebrow="Account" title="Choose a new password" width="max-w-[520px]">
      <Card>
        {!token ? (
          <Notice>This reset link is missing its token. Request a new one from the sign-in page.</Notice>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="New password" hint="At least 8 characters. All other devices will be signed out.">
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            {error ? <Notice>{error}</Notice> : null}
            <Btn type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving…" : "Set password and sign in"}
            </Btn>
          </form>
        )}
      </Card>
    </Page>
  );
}
