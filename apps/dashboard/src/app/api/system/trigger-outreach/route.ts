import { NextResponse } from "next/server";
import { triggerOutreach } from "../../../../../../../packages/actions/trigger-outreach";
import { isOutreachPaused } from "../../../../../../../packages/system-state/index";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as { batchSize?: number };
  const db = getDb();

  try {
    if (await isOutreachPaused(db)) {
      return NextResponse.json({ error: "Outreach is paused" }, { status: 409 });
    }

    const result = await triggerOutreach(db, {
      source: "manual",
      batchSize: body.batchSize,
      triggerId: `dashboard:${Date.now()}`,
      note: "Manual push from dashboard",
    });

    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      batchSize: result.batchSize,
      queued: true,
    });
  } finally {
    await db.sql.end();
  }
}
