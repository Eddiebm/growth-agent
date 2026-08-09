import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AS_COOKIE } from "@/lib/answer-share-session";

async function readRecommendationId(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { recommendationId?: string };
    return body.recommendationId ? String(body.recommendationId) : null;
  }
  const form = await request.formData();
  const id = form.get("recommendationId");
  return id ? String(id) : null;
}

export async function POST(request: Request) {
  const jar = await cookies();
  const accessToken = jar.get(AS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not signed in to AnswerShare" }, { status: 401 });
  }

  const recommendationId = await readRecommendationId(request);
  if (!recommendationId) {
    return NextResponse.json({ error: "recommendationId is required" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const wantsHtml = (request.headers.get("accept") ?? "").includes("text/html");

  const db = getDb();
  try {
    const [org] = await db.sql<{ id: string }[]>`
      SELECT id FROM as_organizations WHERE access_token = ${accessToken}
    `;
    if (!org) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const [business] = await db.sql<{ id: string }[]>`
      SELECT id FROM as_businesses WHERE organization_id = ${org.id} ORDER BY created_at ASC LIMIT 1
    `;
    if (!business) return NextResponse.json({ error: "No business" }, { status: 404 });

    const [rec] = await db.sql<
      {
        id: string;
        business_id: string;
        title: string;
        explanation: string;
        questions_affected: string[];
        measurement_plan: string | null;
        retest_at: Date | null;
      }[]
    >`
      SELECT id, business_id, title, explanation, questions_affected, measurement_plan, retest_at
      FROM as_recommendations
      WHERE id = ${recommendationId} AND business_id = ${business.id}
    `;
    if (!rec) return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });

    const retestAt = rec.retest_at
      ? new Date(rec.retest_at)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d;
        })();

    const [experiment] = await db.sql<{ id: string }[]>`
      INSERT INTO as_experiments (
        business_id, recommendation_id, hypothesis, change_implemented,
        questions_affected, retest_at, outcome, causation_note
      ) VALUES (
        ${business.id},
        ${rec.id},
        ${`If we implement: ${rec.title}, visibility metrics will improve.`},
        ${rec.explanation},
        ${rec.questions_affected ?? []},
        ${retestAt},
        'awaiting_data',
        'Correlation only — not proven causation.'
      )
      RETURNING id
    `;

    await db.sql`
      UPDATE as_recommendations
      SET status = 'in_progress', updated_at = now()
      WHERE id = ${rec.id}
    `;

    if (wantsHtml) {
      return NextResponse.redirect(
        new URL(`/answer-share/experiments?created=${experiment.id}`, origin),
        303,
      );
    }
    return NextResponse.json({ ok: true, experimentId: experiment.id });
  } catch (err) {
    console.error("answer-share experiments:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create experiment" },
      { status: 500 },
    );
  } finally {
    await db.sql.end();
  }
}
