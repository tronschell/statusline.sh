import type { Design } from "@statusline/shared/types";
import { WORKER_URL } from "./config";

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${WORKER_URL}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body || path}`);
  }
  return (await res.json()) as T;
}

export interface CommunityCardSummary {
  id: string;
  design: Design;
  slug: string;
  name: string;
  author_name: string;
  description: string;
  forked_from: string | null;
  published_at: number;
  views: number;
  forks: number;
  installs: number;
}

export interface CommunityListResponse {
  items: CommunityCardSummary[];
  nextCursor: string | null;
}

export interface PublishBody {
  design: Design;
  name: string;
  author_name: string;
  description: string;
  turnstile_token: string;
}

export const api = {
  async listCommunity(opts: { sort?: "recent" | "popular"; limit?: number; cursor?: string | null } = {}): Promise<CommunityListResponse> {
    const sp = new URLSearchParams();
    if (opts.sort) sp.set("sort", opts.sort);
    if (opts.limit) sp.set("limit", String(opts.limit));
    if (opts.cursor) sp.set("cursor", opts.cursor);
    const qs = sp.toString();
    return jsonRequest(`/community${qs ? `?${qs}` : ""}`);
  },

  async getCommunityBySlug(slug: string): Promise<CommunityCardSummary> {
    return jsonRequest(`/community/${encodeURIComponent(slug)}`);
  },

  async publish(body: PublishBody): Promise<{ id: string; slug: string }> {
    return jsonRequest(`/designs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  async forkBump(slug: string, turnstileToken: string): Promise<{ ok: true }> {
    return jsonRequest(`/community/${encodeURIComponent(slug)}/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstile_token: turnstileToken }),
    });
  },

  async installAnonymous(design: Design, turnstileToken: string): Promise<{ id: string }> {
    return jsonRequest(`/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design, turnstile_token: turnstileToken }),
    });
  },

  installUrl(id: string, os: "mac" | "linux" | "windows", selfHeal: boolean): string {
    const ext = os === "windows" ? "ps1" : "sh";
    return `${WORKER_URL}/i/${id}.${ext}${selfHeal ? "?selfheal=1" : ""}`;
  },

  oneLiner(id: string, os: "mac" | "linux" | "windows", selfHeal: boolean): string {
    const url = this.installUrl(id, os, selfHeal);
    if (os === "windows") {
      return selfHeal
        ? `$env:STATUSLINE_SELFHEAL='1'; irm ${url} | iex`
        : `irm ${url} | iex`;
    }
    return selfHeal
      ? `STATUSLINE_SELFHEAL=1 curl -fsSL ${url} | bash`
      : `curl -fsSL ${url} | bash`;
  },
};
