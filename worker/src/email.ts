/**
 * Transactional email (password reset, username reminder) via Resend's HTTP
 * API — plain fetch, no SDK. With no RESEND_API_KEY the account UI hides the
 * "forgot" flows instead of pretending to send mail.
 */

import type { AccountEnv } from "./env";

export function emailConfigured(env: AccountEnv): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(
  env: AccountEnv,
  msg: { to: string; subject: string; text: string },
): Promise<boolean> {
  if (!emailConfigured(env)) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text }),
    });
    if (!res.ok) console.warn("email send failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.warn("email send error", e);
    return false;
  }
}
