import type { Db } from "../../apps/api/src/jobs/db.js";
import { enqueueDailyJobs } from "../../apps/api/src/jobs/daily-loop.js";
import { setOutreachMode } from "../system-state/index.js";

const DEFAULT_CAMPAIGN_ID =
  process.env.DEFAULT_CAMPAIGN_ID ?? "11111111-1111-1111-1111-111111111111";

export interface ForcePipelineInput {
  /** Reset today's send counter so a forced batch can send (default true). */
  resetSendCounter?: boolean;
  /** Set outreach mode to automatic (default true). */
  setAutomatic?: boolean;
  /** Batch size for the forced outreach job (default 10). */
  batchSize?: number;
  note?: string;
}

export interface ForcePipelineResult {
  ok: true;
  today: string;
  jobs: string[];
  outreachKey: string;
}

/**
 * Enqueue (or re-open) today's lead_gen + score_leads and a fresh outreach batch.
 * The Render worker picks them up within JOB_POLL_MS (~5s).
 */
export async function forcePipeline(
  db: Db,
  input: ForcePipelineInput = {},
): Promise<ForcePipelineResult> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const batchSize = Math.min(Math.max(input.batchSize ?? 10, 1), 25);
  const triggerId = `force-${Date.now()}`;

  if (input.setAutomatic !== false) {
    await setOutreachMode(db, "automatic");
  }

  if (input.resetSendCounter !== false) {
    await db.sql`
      INSERT INTO daily_counters (counter_date, counter_key, count)
      VALUES (${today}::date, 'emails_sent', 0)
      ON CONFLICT (counter_date, counter_key) DO UPDATE SET count = 0
    `;
  }

  await enqueueDailyJobs(db, DEFAULT_CAMPAIGN_ID);

  const dayKeys = [`lead_gen:${today}`, `score_leads:${today}`];
  for (const key of dayKeys) {
    await db.sql`
      UPDATE jobs
      SET status = 'pending', error = NULL, started_at = NULL, completed_at = NULL, scheduled_for = ${now}
      WHERE idempotency_key = ${key}
    `;
  }

  const outreachKey = `outreach:${today}:${triggerId}`;
  await db.jobs.enqueue({
    jobType: "outreach",
    payload: {
      campaignId: DEFAULT_CAMPAIGN_ID,
      batchSize,
      dryRun: false,
      trigger: {
        source: "manual",
        id: triggerId,
        note: input.note ?? "Force pipeline from app",
      },
    },
    scheduledFor: now,
    idempotencyKey: outreachKey,
  });

  await db.activities.create({
    type: "note",
    agentId: "orchestrator",
    metadata: {
      event: "force_pipeline",
      today,
      outreachKey,
      batchSize,
      note: input.note ?? null,
    },
  });

  return {
    ok: true,
    today,
    jobs: [...dayKeys, outreachKey],
    outreachKey,
  };
}
