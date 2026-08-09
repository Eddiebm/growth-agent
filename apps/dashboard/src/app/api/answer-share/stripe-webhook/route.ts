import { NextResponse } from "next/server";
import { verifyStripeWebhook } from "../../../../../../../packages/answer-share/index";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const verified = verifyStripeWebhook(payload, signature);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const event = verified.event;
  const type = String(event.type ?? "");

  if (type === "checkout.session.completed") {
    const data = event.data as { object?: Record<string, unknown> } | undefined;
    const session = data?.object ?? {};
    const metadata = (session.metadata ?? {}) as Record<string, string>;
    const organizationId =
      metadata.organizationId ||
      (typeof session.client_reference_id === "string" ? session.client_reference_id : null);
    const customerId =
      typeof session.customer === "string" ? session.customer : null;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : null;

    if (!organizationId) {
      return NextResponse.json({ error: "Missing organizationId on session" }, { status: 400 });
    }

    const db = getDb();
    try {
      await db.sql`
        UPDATE as_organizations SET
          subscription_status = 'active',
          plan_key = 'answer_share_monitoring',
          stripe_customer_id = COALESCE(${customerId}, stripe_customer_id),
          stripe_subscription_id = COALESCE(${subscriptionId}, stripe_subscription_id),
          updated_at = now()
        WHERE id = ${organizationId}
      `;
    } finally {
      await db.sql.end();
    }
  }

  return NextResponse.json({ received: true });
}
