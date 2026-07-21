import { NextResponse } from "next/server";
import { forcePipeline } from "../../../../../../../packages/actions/force-pipeline";
import { isOutreachPaused } from "../../../../../../../packages/system-state/index";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    batchSize?: number;
    resetSendCounter?: boolean;
  };
  const db = getDb();

  try {
    if (await isOutreachPaused(db)) {
      return NextResponse.json({ error: "Outreach is paused — unpause first" }, { status: 409 });
    }

    const result = await forcePipeline(db, {
      batchSize: body.batchSize,
      resetSendCounter: body.resetSendCounter,
      note: "Force pipeline from dashboard",
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Force run failed" },
      { status: 500 },
    );
  } finally {
    await db.sql.end();
  }
}
