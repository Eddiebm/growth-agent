import { NextResponse } from "next/server";
import { processApproval } from "../../../../../../../packages/actions/process-approval";
import { getDb } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as { decision?: string };

  if (body.decision !== "approved" && body.decision !== "rejected") {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const db = getDb();
  try {
    await processApproval(db, id, body.decision);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("approval error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    await db.sql.end();
  }
}
