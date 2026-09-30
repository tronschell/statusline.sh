// Bearer session token. The SPA (statusline.sh) and the Worker (workers.dev)
// are different origins, so a cookie would be third-party; we keep an opaque
// token in localStorage instead. Only its SHA-256 is stored server-side.

const KEY = "statusline-session-v1";

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    // private mode / blocked storage: the session just won't survive a reload
  }
}
