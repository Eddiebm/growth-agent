import { NextResponse } from "next/server";
import { setOutreachPaused } from "../../../../../../../packages/system-state/index";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const { paused } = (await request.json()) as { paused?: boolean };
  if (typeof paused !== "boolean") {
    return NextResponse.json({ error: "paused required" }, { status: 400 });
  }

  const db = getDb();
  try {
    await setOutreachPaused(db, paused);
    return NextResponse.json({ outreachPaused: paused });
  } finally {
    await db.sql.end();
  }
}
