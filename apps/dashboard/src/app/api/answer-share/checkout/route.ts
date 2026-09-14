import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createStripeCheckoutSession } from "../../../../../../../packages/answer-share/index";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";

export async function POST(request: Request) {
  const jar = await cookies();
  const accessToken = jar.get(AS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not signed in to AnswerShare" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const wantsHtml = (request.headers.get("accept") ?? "").includes("text/html");

  const db = getDb();
  try {
    const [org] = await db.sql<{ id: string; name: string }[]>`
      SELECT id, name FROM as_organizations WHERE access_token_hash = ${hashAccessToken(accessToken)}
    `;
    if (!org) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const [business] = await db.sql<{ id: string }[]>`
      SELECT id FROM as_businesses WHERE organization_id = ${org.id} ORDER BY created_at ASC LIMIT 1
    `;
    if (!business) return NextResponse.json({ error: "No business" }, { status: 404 });

    const [user] = await db.sql<{ email: string | null }[]>`
      SELECT email FROM as_users WHERE organization_id = ${org.id} ORDER BY created_at ASC LIMIT 1
    `;

    const result = await createStripeCheckoutSession({
      organizationId: org.id,
      businessId: business.id,
      customerEmail: user?.email ?? undefined,
      successUrl: `${origin}/answer-share/settings?checkout=success`,
      cancelUrl: `${origin}/answer-share/settings?checkout=canceled`,
    });

    if (!result.configured) {
      const payload = {
        configured: false as const,
        checkoutState: "unconfigured" as const,
        error: result.error,
      };
      if (wantsHtml) {
        return NextResponse.redirect(
          new URL("/answer-share/settings?checkout=unconfigured", origin),
          303,
        );
      }
      return NextResponse.json(payload, { status: 200 });
    }

    if (!result.url) {
      return NextResponse.json(
        { configured: true, checkoutState: "error", error: result.error ?? "No checkout URL" },
        { status: 502 },
      );
    }

    if (wantsHtml) {
      return NextResponse.redirect(result.url, 303);
    }
    return NextResponse.json({
      configured: true,
      checkoutState: "ready",
      url: result.url,
      sessionId: result.sessionId,
    });
  } catch (err) {
    console.error("answer-share checkout:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 },
    );
  } finally {
    await db.sql.end();
  }
}
