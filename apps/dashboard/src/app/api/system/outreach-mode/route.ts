import { NextResponse } from "next/server";
import { setOutreachMode, type OutreachMode } from "../../../../../../../packages/system-state/index";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const { mode } = (await request.json()) as { mode?: OutreachMode };
  if (mode !== "automatic" && mode !== "triggered") {
    return NextResponse.json({ error: "mode must be automatic or triggered" }, { status: 400 });
  }

  const db = getDb();
  try {
    await setOutreachMode(db, mode);
    return NextResponse.json({ outreachMode: mode });
  } finally {
    await db.sql.end();
  }
}
