import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";

/**
 * Redeems an org access token (pasted on /answer-share/login, e.g. after a
 * manual token reset) into a session cookie. POST + JSON body so the token
 * never lands in a URL, browser history, or server access log.
 *
 * This is the only way back in for a returning user once their cookie is
 * gone — onboarding only ever creates a brand-new org.
 */
export async function POST(request: Request) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const db = getDb();
  try {
    const [org] = await db.sql<{ id: string }[]>`
      SELECT id FROM as_organizations WHERE access_token_hash = ${hashAccessToken(trimmed)}
    `;
    if (!org) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(AS_COOKIE, trimmed, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    return res;
  } finally {
    await db.sql.end();
  }
}
