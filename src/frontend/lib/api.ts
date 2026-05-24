import type { CommunityCardSummary, Design } from "../../shared/types";

async function jsonRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body || input}`);
  }
  return (await res.json()) as T;
}

export interface DesignWithMeta extends Design {
  id?: string;
  is_public?: boolean;
  slug?: string | null;
  author_name?: string | null;
  description?: string | null;
  forks?: number;
  views?: number;
  forked_from?: string | null;
  published_at?: number | null;
}

export interface CommunityListResponse {
  items: CommunityCardSummary[];
  nextCursor: string | null;
}

export const api = {
  async createDesign(design: Design): Promise<{ id: string }> {
    return jsonRequest("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(design),
    });
  },

  async getDesign(id: string): Promise<DesignWithMeta> {
    return jsonRequest(`/api/designs/${encodeURIComponent(id)}`);
  },

  async updateDesign(id: string, design: Design): Promise<{ ok: true }> {
    return jsonRequest(`/api/designs/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(design),
    });
  },

  async listCommunity(opts: {
    sort?: "recent" | "popular";
    limit?: number;
    cursor?: string | null;
  } = {}): Promise<CommunityListResponse> {
    const sp = new URLSearchParams();
    if (opts.sort) sp.set("sort", opts.sort);
    if (opts.limit) sp.set("limit", String(opts.limit));
    if (opts.cursor) sp.set("cursor", opts.cursor);
    const qs = sp.toString();
    return jsonRequest(`/api/community${qs ? `?${qs}` : ""}`);
  },

  async getCommunityBySlug(slug: string): Promise<CommunityCardSummary> {
    return jsonRequest(`/api/community/${encodeURIComponent(slug)}`);
  },

  async publish(
    id: string,
    body: { author_name: string; description: string; name: string },
  ): Promise<{ ok: true; slug: string }> {
    return jsonRequest(`/api/designs/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  async unpublish(id: string): Promise<{ ok: true }> {
    return jsonRequest(`/api/designs/${encodeURIComponent(id)}/unpublish`, {
      method: "POST",
    });
  },

  async fork(id: string): Promise<{ id: string }> {
    return jsonRequest(`/api/designs/${encodeURIComponent(id)}/fork`, {
      method: "POST",
    });
  },

  installUrl(id: string, os: "mac" | "linux" | "windows", selfHeal: boolean): string {
    const ext = os === "windows" ? "ps1" : "sh";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/i/${id}.${ext}${selfHeal ? "?selfheal=1" : ""}`;
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
