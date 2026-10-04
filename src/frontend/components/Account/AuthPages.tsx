import { useEffect, useState, type FormEvent } from "react";
import { ApiError, accountApi, type Providers } from "../../lib/accountApi";
import { navigate } from "../../lib/navigate";
import { useAuthStore } from "../../store/authStore";
import { Link } from "../../router";
import { Btn, Field, Notice, Page, inputClass } from "./ui";

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

const GitHubMark = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const GoogleG = () => (
  <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

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
        const id = identifier.trim();
        let s;
        try {
          s = await accountApi.login(id, password);
        } catch (err) {
          // No such account for an email: create it instead of making them find "Sign up".
          if (!(err instanceof ApiError && err.status === 401) || !id.includes("@") || id.startsWith("@")) throw err;
          try {
            s = await accountApi.signup({ email: id, password });
          } catch (err2) {
            // 409 = the email exists, so the original failure was just a wrong password.
            throw err2 instanceof ApiError && err2.status === 409 ? err : err2;
          }
        }
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
      title={titles[mode]}
      lead={
        mode === "signup"
          ? "Free to start. Save designs to a private library, get a public @username on the community, and upgrade to Pro whenever you like."
          : mode === "signin"
            ? undefined
            : "Enter the email on your account."
      }
      width="max-w-[520px]"
    >
      <div className="flex flex-col gap-4">
        <div>
          {(mode === "signin" || mode === "signup") && providers && (providers.github || providers.google) ? (
            <div className="mb-5 flex flex-col gap-2">
              {providers.github ? (
                <a
                  href={accountApi.oauthUrl("github", next)}
                  className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-white/[0.08] px-3.5 py-2.5 text-[13px] font-medium text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.18]"
                >
                  <GitHubMark />
                  Continue with GitHub
                </a>
              ) : null}
              {providers.google ? (
                <a
                  href={accountApi.oauthUrl("google", next)}
                  className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-white/[0.08] px-3.5 py-2.5 text-[13px] font-medium text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.18]"
                >
                  <GoogleG />
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

            <Btn type="submit" variant="primary" dither disabled={busy}>
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
            {mode === "signin" ? providers?.email ? (
              <>
                <button type="button" className="hover:text-[#E8E8E6]" onClick={() => switchMode("forgot")}>
                  Forgot password?
                </button>
                <button type="button" className="hover:text-[#E8E8E6]" onClick={() => switchMode("forgot-username")}>
                  Forgot username?
                </button>
              </>
            ) : null : (
              <button type="button" className="hover:text-[#E8E8E6]" onClick={() => switchMode("signin")}>
                Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[13px] text-[#8A8A86]">
          {mode === "signin" ? (
            "New here? Enter your email and a password and we'll create your account."
          ) : mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px]"
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
            </>
          ) : null}
        </p>

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
    <Page title="Choose a new password" width="max-w-[520px]">
      <div>
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
      </div>
    </Page>
  );
}
