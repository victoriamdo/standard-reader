/**
 * Minimal comail (atmos.email) client for sending the weekly digest.
 * See https://comail.at/docs/send-api — POST JSON, DID + API-key headers,
 * ≤50 recipients per request, `{ accepted, rejected }` response.
 */

import { digestConfig } from "./config";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** One-click unsubscribe URL, surfaced as `List-Unsubscribe` headers. */
  unsubscribeUrl?: string;
}

export interface SendEmailResult {
  ok: boolean;
  status: number;
  /** True when comail rejected for rate limiting (429) — caller should stop. */
  rateLimited: boolean;
  accepted: number;
  rejected: number;
  error?: string;
}

/**
 * Send one email through comail. Never throws on an HTTP error — returns a
 * structured result so the runner can distinguish a rate-limit stop (429) from
 * a per-recipient failure and keep going.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Atmos-DID": digestConfig.comailDid,
    Authorization: `Bearer ${digestConfig.comailApiKey}`,
  };

  const body: Record<string, unknown> = {
    from: digestConfig.comailFrom,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    category: "broadcast",
  };
  if (input.unsubscribeUrl) {
    body.headers = {
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  let res: Response;
  try {
    res = await fetch(digestConfig.comailSendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      rateLimited: false,
      accepted: 0,
      rejected: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const payload = (await res.json().catch(() => null)) as {
    accepted?: Array<unknown>;
    rejected?: Array<unknown>;
    error?: string;
  } | null;

  return {
    ok: res.ok,
    status: res.status,
    rateLimited: res.status === 429,
    accepted: payload?.accepted?.length ?? (res.ok ? 1 : 0),
    rejected: payload?.rejected?.length ?? (res.ok ? 0 : 1),
    error: res.ok ? undefined : (payload?.error ?? `HTTP ${res.status}`),
  };
}
