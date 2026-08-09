import { NextResponse } from "next/server";
import { createBusinessFromOnboarding, trackEvent } from "../../../../../../../packages/answer-share/index";
import { getDb } from "@/lib/db";
import { AS_COOKIE } from "@/lib/answer-share-session";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const businessName = String(body.businessName ?? "").trim();
  const websiteUrl = String(body.websiteUrl ?? "").trim();
  if (!businessName || !websiteUrl) {
    return NextResponse.json({ error: "Business name and website are required" }, { status: 400 });
  }

  const db = getDb();
  try {
    await trackEvent(db, { eventName: "free_audit_started", properties: { businessName } });

    const result = await createBusinessFromOnboarding(db, {
      businessName,
      websiteUrl,
      aliases: Array.isArray(body.aliases) ? (body.aliases as string[]) : [],
      serviceCategory: String(body.serviceCategory ?? "hvac"),
      city: String(body.city ?? "St. Louis"),
      state: String(body.state ?? "MO"),
      serviceAreas: Array.isArray(body.serviceAreas) ? (body.serviceAreas as string[]) : [],
      phone: body.phone ? String(body.phone) : undefined,
      conversionUrl: body.conversionUrl ? String(body.conversionUrl) : undefined,
      gbpUrl: body.gbpUrl ? String(body.gbpUrl) : undefined,
      competitors: Array.isArray(body.competitors)
        ? (body.competitors as { name: string; websiteUrl?: string }[])
        : [],
      email: body.email ? String(body.email) : undefined,
      forceDemo: Boolean(body.forceDemo),
    });

    const res = NextResponse.json({
      ok: true,
      organizationId: result.organizationId,
      businessId: result.businessId,
      isDemo: result.isDemo,
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
    console.error("answer-share onboard:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Onboarding failed" },
      { status: 500 },
    );
  } finally {
    await db.sql.end();
  }
}
