import {
  dispatchJob,
  enqueueDailyJobs,
  type JobType,
} from "./jobs/daily-loop.js";
import type { Db } from "./jobs/db.js";

const BATCH_SIZE = Number(process.env.JOB_BATCH_SIZE ?? 5);
const DEFAULT_CAMPAIGN_ID =
  process.env.DEFAULT_CAMPAIGN_ID ?? "11111111-1111-1111-1111-111111111111";

export async function pollJobs(db: Db): Promise<{ processed: number }> {
  const jobs = await db.jobs.fetchDue(BATCH_SIZE);
  for (const job of jobs) {
    try {
      await dispatchJob(db, {
        id: job.id,
        jobType: job.jobType as JobType,
        payload: job.payload,
        idempotencyKey: job.idempotencyKey ?? undefined,
      });
    } catch (err) {
      console.error(`[worker] job ${job.id} failed:`, err);
    }
  }
  return { processed: jobs.length };
}

export async function runDailyCron(db: Db): Promise<void> {
  await enqueueDailyJobs(db, DEFAULT_CAMPAIGN_ID);
}

/** Re-enqueue today's jobs if the 06:00 UTC cron was missed (Render free tier spin-down). */
export async function ensureTodayJobsQueued(db: Db): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db.sql<{ id: string }[]>`
    SELECT id FROM jobs
    WHERE idempotency_key = ${`lead_gen:${today}`}
    LIMIT 1
  `;
  if (!row) {
    console.log(`[cron] Missed daily enqueue for ${today} — catching up now`);
    await runDailyCron(db);
  }
}

export async function runReplyTriageCron(db: Db): Promise<void> {
  await db.jobs.enqueue({
    jobType: "reply_triage",
    idempotencyKey: `reply_triage:${Date.now()}`,
    payload: {
      since: new Date(Date.now() - 35 * 60_000).toISOString(),
      limit: 50,
    },
  });
}

export async function runWeeklyLearningCron(db: Db): Promise<void> {
  const week = new Date().toISOString().slice(0, 7);
  await db.jobs.enqueue({
    jobType: "learning_weekly",
    idempotencyKey: `learning_weekly:${week}`,
    payload: {},
  });
}
