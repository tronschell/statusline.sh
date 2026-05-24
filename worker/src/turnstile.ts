// Cloudflare Turnstile siteverify wrapper.
//
// Local dev uses Cloudflare's always-passing dev keys
// (site 1x00000000000000000000AA / secret 1x0000000000000000000000000000000AA).

export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string,
  ip: string | null,
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export function getClientIp(req: Request): string | null {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? null;
}
