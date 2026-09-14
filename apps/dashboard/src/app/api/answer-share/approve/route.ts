import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { startAudit, trackEvent } from "../../../../../../../packages/answer-share/index";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    questionIds?: string[];
    competitorIds?: string[];
    runAudit?: boolean;
  };

  const jar = await cookies();
  const accessToken = jar.get(AS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not signed in to AnswerShare" }, { status: 401 });
  }

  const db = getDb();
  try {
    const [org] = await db.sql<{ id: string; is_demo: boolean }[]>`
      SELECT id, is_demo FROM as_organizations WHERE access_token_hash = ${hashAccessToken(accessToken)}
    `;
    if (!org) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const [business] = await db.sql<{ id: string }[]>`
      SELECT id FROM as_businesses WHERE organization_id = ${org.id} ORDER BY created_at ASC LIMIT 1
    `;
    if (!business) return NextResponse.json({ error: "No business" }, { status: 404 });

    if (body.questionIds?.length) {
      await db.sql`
        UPDATE as_buyer_questions SET status = 'approved', updated_at = now()
        WHERE business_id = ${business.id} AND id = ANY(${body.questionIds})
      `;
      await db.sql`
        UPDATE as_buyer_questions SET status = 'archived', updated_at = now()
        WHERE business_id = ${business.id}
          AND status = 'draft'
          AND NOT (id = ANY(${body.questionIds}))
      `;
    } else {
      await db.sql`
        UPDATE as_buyer_questions SET status = 'approved', updated_at = now()
        WHERE business_id = ${business.id} AND status = 'draft'
      `;
    }

    if (body.competitorIds?.length) {
      await db.sql`
        UPDATE as_competitors SET approved = true
        WHERE business_id = ${business.id} AND id = ANY(${body.competitorIds})
      `;
      await db.sql`
        UPDATE as_competitors SET approved = false
        WHERE business_id = ${business.id} AND NOT (id = ANY(${body.competitorIds}))
      `;
    } else {
      await db.sql`
        UPDATE as_competitors SET approved = true
        WHERE business_id = ${business.id}
      `;
    }

    await trackEvent(db, {
      organizationId: org.id,
      businessId: business.id,
      eventName: "questions_approved",
    });

    let auditId: string | null = null;
    if (body.runAudit !== false) {
      const prev = process.env.ANSWER_SHARE_SYNC;
      process.env.ANSWER_SHARE_SYNC = "true";
      try {
        auditId = await startAudit(db, {
          organizationId: org.id,
          businessId: business.id,
          kind: org.is_demo ? "demo" : "free",
          isDemo: org.is_demo,
          runsPerProvider: org.is_demo ? 1 : Number(process.env.ANSWER_SHARE_FREE_RUNS ?? 1),
        });
      } finally {
        if (prev === undefined) delete process.env.ANSWER_SHARE_SYNC;
        else process.env.ANSWER_SHARE_SYNC = prev;
      }
    }

    return NextResponse.json({ ok: true, auditId, businessId: business.id });
  } catch (err) {
    console.error("answer-share approve:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approve failed" },
      { status: 500 },
    );
  } finally {
    await db.sql.end();
  }
}
