import type { JSONValue } from "postgres";
import type { Db } from "../../apps/api/src/jobs/db.js";

export async function isOutreachPaused(db: Db): Promise<boolean> {
  const [row] = await db.sql<{ value: boolean }[]>`
    SELECT value FROM agent_memory
    WHERE namespace = 'system' AND key = 'outreach_paused'
  `;
  return row?.value === true;
}

export async function setOutreachPaused(db: Db, paused: boolean): Promise<void> {
  await db.sql`
    INSERT INTO agent_memory (namespace, key, value)
    VALUES ('system', 'outreach_paused', ${db.sql.json(paused as unknown as JSONValue)})
    ON CONFLICT (namespace, key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

export async function getDailySendCap(db: Db): Promise<number> {
  const [row] = await db.sql<{ value: number }[]>`
    SELECT value FROM agent_memory
    WHERE namespace = 'system' AND key = 'daily_send_cap'
  `;
  return typeof row?.value === "number" ? row.value : 10;
}
