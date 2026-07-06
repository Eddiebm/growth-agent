import { NextResponse } from "next/server";
import {
  DEFAULT_GLOBAL_CAC,
  parseGlobalCacDefaults,
} from "../../../../../../../packages/economics/cac";
import {
  getGlobalCacDefaults,
  setGlobalCacDefaults,
} from "../../../../../../../packages/economics/cac-defaults";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  try {
    const defaults = await getGlobalCacDefaults(db);
    return NextResponse.json(defaults);
  } catch {
    return NextResponse.json(DEFAULT_GLOBAL_CAC);
  } finally {
    await db.sql.end();
  }
}

export async function PATCH(request: Request) {
  const body = parseGlobalCacDefaults(await request.json());
  const db = getDb();
  try {
    await setGlobalCacDefaults(db, body);
    return NextResponse.json(body);
  } catch (err) {
    console.error("cac defaults update:", err);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  } finally {
    await db.sql.end();
  }
}
