import { NextResponse } from "next/server";
import {
  createBusinessFromOnboarding,
  startAudit,
  trackEvent,
} from "../../../../../../../packages/answer-share/index";
import { getDb } from "@/lib/db";
import { AS_COOKIE } from "@/lib/answer-share-session";

const DEMO_BUSINESS_NAME = "Laclede Comfort HVAC";

/**
 * Creates/resets a deterministic demo org for e2e:
 * onboard fictional HVAC shop → approve all → run demo audit sync → set session cookie.
 */
export async function POST() {
  const db = getDb();
  try {
    await db.sql`
      DELETE FROM as_organizations
      WHERE is_demo = true AND name = ${DEMO_BUSINESS_NAME}
    `;

    const result = await createBusinessFromOnboarding(db, {
      businessName: DEMO_BUSINESS_NAME,
      websiteUrl: "https://example.com/laclede-comfort-hvac",
      aliases: ["Laclede Comfort", "Laclede HVAC"],
      serviceCategory: "hvac",
      city: "St. Louis",
      state: "MO",
      serviceAreas: ["St. Louis", "Clayton", "University City"],
      phone: "(314) 555-0199",
      gbpUrl: "https://example.com/laclede-gbp",
      competitors: [
        { name: "Gateway Heating & Cooling", websiteUrl: "https://example.com/gateway-hvac" },
        { name: "River City Air Pros", websiteUrl: "https://example.com/river-city-air" },
      ],
      email: "demo@laclede-comfort.example",
      forceDemo: true,
    });

    await db.sql`
      UPDATE as_buyer_questions SET status = 'approved', updated_at = now()
      WHERE business_id = ${result.businessId} AND status = 'draft'
    `;
    await db.sql`
      UPDATE as_competitors SET approved = true
      WHERE business_id = ${result.businessId}
    `;

    await trackEvent(db, {
      organizationId: result.organizationId,
      businessId: result.businessId,
      eventName: "questions_approved",
      properties: { source: "load_demo" },
    });

    const prev = process.env.ANSWER_SHARE_SYNC;
    process.env.ANSWER_SHARE_SYNC = "true";
    let auditId: string;
    try {
      auditId = await startAudit(db, {
        organizationId: result.organizationId,
        businessId: result.businessId,
        kind: "demo",
        isDemo: true,
        runsPerProvider: 1,
      });
    } finally {
      if (prev === undefined) delete process.env.ANSWER_SHARE_SYNC;
      else process.env.ANSWER_SHARE_SYNC = prev;
    }

    const res = NextResponse.json({
      ok: true,
      organizationId: result.organizationId,
      businessId: result.businessId,
      auditId,
      isDemo: true,
    });
    res.cookies.set(AS_COOKIE, result.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    return res;
  } catch (err) {
    console.error("answer-share load-demo:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Load demo failed" },
      { status: 500 },
    );
  } finally {
    await db.sql.end();
  }
}
