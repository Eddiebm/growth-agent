import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ANSWER_SHARE_PLAN = {
  key: "answer_share_monitoring",
  name: "AnswerShare Monitoring",
  priceUsd: 199,
  interval: "month" as const,
  limits: {
    businesses: 1,
    locations: 1,
    questions: 20,
    competitors: 5,
  },
};

export async function createStripeCheckoutSession(input: {
  organizationId: string;
  businessId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null; sessionId?: string; error?: string; configured: boolean }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ANSWER_SHARE_MONITORING;
  if (!secret || !priceId) {
    return {
      url: null,
      configured: false,
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ANSWER_SHARE_MONITORING.",
    };
  }

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", input.organizationId);
  params.set("metadata[organizationId]", input.organizationId);
  params.set("metadata[businessId]", input.businessId);
  params.set("metadata[plan]", ANSWER_SHARE_PLAN.key);
  if (input.customerEmail) params.set("customer_email", input.customerEmail);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok) {
    return { url: null, configured: true, error: data.error?.message ?? `Stripe HTTP ${res.status}` };
  }
  return { url: data.url ?? null, sessionId: data.id, configured: true };
}

export function verifyStripeWebhook(
  payload: string,
  signatureHeader: string | null,
): { ok: true; event: Record<string, unknown> } | { ok: false; error: string } {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: "STRIPE_WEBHOOK_SECRET not set" };
  if (!signatureHeader) return { ok: false, error: "Missing Stripe-Signature header" };

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k ?? "", v ?? ""];
    }),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return { ok: false, error: "Invalid signature header" };

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isFinite(age) && age > 300) return { ok: false, error: "Timestamp too old" };

  const signed = `${timestamp}.${payload}`;
  const digest = createHmac("sha256", secret).update(signed, "utf8").digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "Signature mismatch" };
  }

  try {
    return { ok: true, event: JSON.parse(payload) as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Invalid JSON payload" };
  }
}

export function randomIdempotencyKey(): string {
  return randomBytes(16).toString("hex");
}
