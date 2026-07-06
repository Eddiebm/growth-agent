import { NextResponse } from "next/server";
import { handleSignup } from "../../../../../../packages/actions/handle-signup";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      company?: string;
      productSlug?: string;
      utm?: Record<string, string>;
    };
    if (!body.email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    const db = getDb();
    const result = await handleSignup(db, {
      email: body.email,
      name: body.name,
      company: body.company,
      productSlug: body.productSlug,
      utm: body.utm,
    });
    await db.sql.end();
    return NextResponse.json(result);
  } catch (err) {
    console.error("signup error:", err);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
