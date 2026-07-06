import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const ALLOWED = new Set(["active", "beta", "paused", "archived"]);

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const db = getDb();
  try {
    await db.products.delete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("product delete:", err);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  } finally {
    await db.sql.end();
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as { status?: string };

  if (!body.status || !ALLOWED.has(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const db = getDb();
  try {
    await db.products.updateStatus(id, body.status as "active" | "beta" | "paused" | "archived");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("product update:", err);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  } finally {
    await db.sql.end();
  }
}
