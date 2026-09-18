import { createHmac, timingSafeEqual } from "node:crypto";

// Signs one-click unsubscribe links so anyone with the link can opt a single,
// specific contact out — without needing an account or exposing a way to
// unsubscribe arbitrary other contacts. This reuses the reply-based
// suppression path (db.suppression.add + contacts.update unsubscribedAt);
// see apps/api/src/app.ts's GET /api/unsubscribe handler.

const TOKEN_LENGTH = 32;

function getSecret(): string {
  // Dedicated secret preferred; falls back to DASHBOARD_SECRET so existing
  // deployments don't need a new env var to get a working (if less cleanly
  // scoped) unsubscribe link. Set UNSUBSCRIBE_SECRET explicitly in production.
  const secret = process.env.UNSUBSCRIBE_SECRET ?? process.env.DASHBOARD_SECRET;
  if (!secret) {
    throw new Error(
      "UNSUBSCRIBE_SECRET (or DASHBOARD_SECRET as a fallback) must be set to build unsubscribe links",
    );
  }
  return secret;
}

export function buildUnsubscribeToken(contactId: string, email: string): string {
  return createHmac("sha256", getSecret())
    .update(`${contactId}:${email.toLowerCase()}`)
    .digest("hex")
    .slice(0, TOKEN_LENGTH);
}

export function verifyUnsubscribeToken(contactId: string, email: string, token: string): boolean {
  if (!token) return false;
  const expected = Buffer.from(buildUnsubscribeToken(contactId, email));
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function buildUnsubscribeUrl(opts: {
  contactId: string;
  email: string;
  baseUrl?: string;
}): string {
  const base = (opts.baseUrl ?? process.env.APP_URL ?? "https://growth-agent.local").replace(
    /\/$/,
    "",
  );
  const token = buildUnsubscribeToken(opts.contactId, opts.email);
  const params = new URLSearchParams({ c: opts.contactId, e: opts.email, t: token });
  return `${base}/api/unsubscribe?${params.toString()}`;
}
