import type { CommunityCardSummary } from "@statusline/shared/types";
import type { Design } from "@statusline/shared/types";
import { WORKER_URL } from "./config";
import { getToken } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    [k: string]: unknown;
  };
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.error ?? "error",
      data.message ?? data.error ?? `${res.status} ${res.statusText}`,
    );
  }
  return data as T;
}

export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  donation_url: string | null;
}

export interface Me {
  user: PublicUser;
  account: {
    email: string | null;
    email_verified: boolean;
    has_password: boolean;
    providers: string[];
  };
  pro: {
    active: boolean;
    until: number | null;
    status: string | null;
    renews_at: number | null;
    ends_at: number | null;
  };
  plan: {
    freeLibraryCap: number;
    proLibraryCap: number;
    featuredCap: number;
    versionsKept: number;
    teamCap: number;
    teamMemberCap: number;
    priceUsdPerMonth: number;
  };
  billing_configured: boolean;
}

export interface Providers {
  github: boolean;
  google: boolean;
  password: boolean;
  email: boolean;
}

export interface CloudDesign {
  id: string;
  team_id: string | null;
  name: string;
  design: Design;
  version: number;
  link_enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface VersionRow {
  version: number;
  created_at: number;
  author_username: string | null;
}

export interface TeamSummary {
  id: string;
  name: string;
  role: "owner" | "editor";
  design_id: string | null;
  created_at: number;
}

export interface TeamDetail {
  id: string;
  name: string;
  role: "owner" | "editor";
  owner_id: string;
  created_at: number;
  design: { id: string; version: number; updated_at: number } | null;
  members: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    role: string;
    joined_at: number;
  }[];
  invite_token: string | null;
  owner_pro?: boolean;
}

export interface MyDesign {
  id: string;
  slug: string;
  name: string;
  published_at: number;
  views: number;
  forks: number;
  installs: number;
  featured: boolean;
}

export interface PublicProfile {
  user: {
    username: string;
    display_name: string;
    avatar_url: string;
    donation_url: string | null;
    verified: boolean;
    joined_at: number;
  };
  designs: CommunityCardSummary[];
}

type Session = { token: string; user: PublicUser };
const post = <T>(p: string, b?: unknown) => call<T>("POST", p, b ?? {});

export const accountApi = {
  providers: () => call<Providers>("GET", "/auth/providers"),
  usernameAvailable: (u: string) =>
    call<{ available: boolean; reason?: string }>(
      "GET",
      `/auth/username-available?u=${encodeURIComponent(u)}`,
    ),
  oauthUrl: (provider: "github" | "google", returnPath: string) =>
    `${WORKER_URL}/auth/${provider}/start?return=${encodeURIComponent(
      window.location.origin + returnPath,
    )}`,
  signup: (b: { email: string; password: string; username?: string }) =>
    post<Session>("/auth/signup", b),
  login: (identifier: string, password: string) =>
    post<Session>("/auth/login", { identifier, password }),
  devLogin: (username: string, pro: boolean) => post<Session>("/auth/dev", { username, pro }),
  logout: () => post<{ ok: true }>("/auth/logout"),
  forgotPassword: (email: string) =>
    post<{ ok: true; dev_token?: string }>("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) =>
    post<Session>("/auth/reset-password", { token, password }),
  forgotUsername: (email: string) => post<{ ok: true }>("/auth/forgot-username", { email }),
  changePassword: (current: string | undefined, next: string) =>
    post<{ ok: true }>("/auth/change-password", { current, next }),

  me: () => call<Me>("GET", "/me"),
  updateMe: (b: { username?: string; display_name?: string; donation_url?: string | null }) =>
    call<{ user: PublicUser }>("PATCH", "/me", b),
  myDesigns: () =>
    call<{ items: MyDesign[]; featured_count: number; featured_cap: number }>("GET", "/me/designs"),
  setFeatured: (id: string, featured: boolean) =>
    post<{ ok: true }>(`/designs/${encodeURIComponent(id)}/feature`, { featured }),

  checkout: () => post<{ url: string }>("/billing/checkout"),
  portal: () => post<{ url: string; update_payment_method_url?: string }>("/billing/portal"),
  cancelSub: () => post<{ ok: true }>("/billing/cancel"),
  resumeSub: () => post<{ ok: true }>("/billing/resume"),

  library: () => call<{ items: CloudDesign[]; cap: number; pro: boolean }>("GET", "/library"),
  libraryGet: (id: string) => call<CloudDesign>("GET", `/library/${encodeURIComponent(id)}`),
  libraryCreate: (name: string, design: Design) =>
    post<CloudDesign>("/library", { name, design }),
  librarySave: (id: string, b: { name: string; design: Design; expected_version?: number }) =>
    call<CloudDesign>("PUT", `/library/${encodeURIComponent(id)}`, b),
  libraryDelete: (id: string) => call<{ ok: true }>("DELETE", `/library/${encodeURIComponent(id)}`),
  librarySetLink: (id: string, enabled: boolean) =>
    post<CloudDesign>(`/library/${encodeURIComponent(id)}/link`, { enabled }),
  libraryVersions: (id: string) =>
    call<{ current: number; versions: VersionRow[] }>(
      "GET",
      `/library/${encodeURIComponent(id)}/versions`,
    ),
  libraryRestore: (id: string, version: number) =>
    post<CloudDesign>(`/library/${encodeURIComponent(id)}/restore`, { version }),
  libraryPublish: (id: string, b: { name?: string; description?: string }) =>
    post<{ id: string; slug: string }>(`/library/${encodeURIComponent(id)}/publish`, b),
  cloudUrl: (id: string, os: "mac" | "linux" | "windows") =>
    `${WORKER_URL}/u/${id}.${os === "windows" ? "ps1" : "sh"}`,

  teams: () => call<{ teams: TeamSummary[] }>("GET", "/teams"),
  team: (id: string) => call<TeamDetail>("GET", `/teams/${encodeURIComponent(id)}`),
  teamCreate: (name: string, design: Design) => post<TeamDetail>("/teams", { name, design }),
  teamJoin: (token: string) =>
    post<{ team_id: string; already_member: boolean }>("/teams/join", { token }),
  teamInvite: (id: string) =>
    post<{ invite_token: string }>(`/teams/${encodeURIComponent(id)}/invite`),
  teamRemove: (id: string, uid: string) =>
    call<{ ok: true }>("DELETE", `/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(uid)}`),
  teamDelete: (id: string) => call<{ ok: true }>("DELETE", `/teams/${encodeURIComponent(id)}`),

  featured: () => call<{ items: CommunityCardSummary[] }>("GET", "/community/featured"),
  profile: (username: string) =>
    call<PublicProfile>("GET", `/users/${encodeURIComponent(username)}`),
};
