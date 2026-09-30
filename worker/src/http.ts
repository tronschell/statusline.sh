// Tiny response/body helpers shared by the account-related handler modules.

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

/** Authenticated responses must never be shared-cached. */
export function privateJson(body: unknown, status = 200): Response {
  return jsonResponse(body, status, { "cache-control": "no-store" });
}

export async function readJson(req: Request): Promise<any | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location, "cache-control": "no-store" } });
}
