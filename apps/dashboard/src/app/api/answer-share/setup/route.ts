import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(AS_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const db = getDb();
  try {
    const [org] = await db.sql<{ id: string; is_demo: boolean }[]>`
      SELECT id, is_demo FROM as_organizations WHERE access_token_hash = ${hashAccessToken(token)}
    `;
    if (!org) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const [business] = await db.sql<{ id: string }[]>`
      SELECT id FROM as_businesses WHERE organization_id = ${org.id} ORDER BY created_at ASC LIMIT 1
    `;
    if (!business) return NextResponse.json({ error: "No business" }, { status: 404 });

    const questions = await db.sql<
      { id: string; question_text: string; intent_category: string; status: string }[]
    >`
      SELECT id, question_text, intent_category, status FROM as_buyer_questions
      WHERE business_id = ${business.id} AND status IN ('draft', 'approved')
      ORDER BY sort_order ASC
    `;
    const competitors = await db.sql<
      { id: string; name: string; suggested: boolean; approved: boolean }[]
    >`
      SELECT id, name, suggested, approved FROM as_competitors
      WHERE business_id = ${business.id}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      ok: true,
      isDemo: org.is_demo,
      businessId: business.id,
      questions,
      competitors,
    });
  } finally {
    await db.sql.end();
  }
}
