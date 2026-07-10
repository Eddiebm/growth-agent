#!/usr/bin/env tsx
/** Force-enqueue today's pipeline jobs and optionally run them locally. */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createDb } from "../apps/api/src/jobs/db.js";
import { dispatchJob, enqueueDailyJobs } from "../apps/api/src/jobs/daily-loop.js";
import { getHeroIcpFilter } from "../packages/hero-config/index.js";
import { setOutreachMode } from "../packages/system-state/index.js";

config({ path: resolve(process.cwd(), ".env") });

const DEFAULT_CAMPAIGN_ID =
  process.env.DEFAULT_CAMPAIGN_ID ?? "11111111-1111-1111-1111-111111111111";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const db = createDb(databaseUrl);
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const runLocal = process.argv.includes("--run");

  await setOutreachMode(db, "automatic");

  await enqueueDailyJobs(db, DEFAULT_CAMPAIGN_ID);

  // Force pending immediately
  const keys = [
    `lead_gen:${today}`,
    `score_leads:${today}`,
    `outreach:${today}:hvac-outreach-v1`,
  ];
  for (const key of keys) {
    await db.sql`
      UPDATE jobs SET status = 'pending', error = NULL, started_at = NULL, completed_at = NULL, scheduled_for = ${now}
      WHERE idempotency_key = ${key}
    `;
  }

  console.log(`✅ Jobs queued for ${today} (mode: automatic)`);

  if (runLocal) {
    const order = ["lead_gen", "score_leads", "outreach"] as const;
    for (const jobType of order) {
      const [job] = await db.sql<{ id: string; payload: unknown }[]>`
        SELECT id, payload FROM jobs
        WHERE idempotency_key = ${jobType === "outreach" ? `outreach:${today}:hvac-outreach-v1` : `${jobType}:${today}`}
        LIMIT 1
      `;
      if (!job) {
        console.log(`⏭️  No job for ${jobType}`);
        continue;
      }
      console.log(`▶ Running ${jobType}...`);
      try {
        await dispatchJob(db, {
          id: job.id,
          jobType,
          payload: job.payload as Record<string, unknown>,
        });
        console.log(`✅ ${jobType} done`);
      } catch (err) {
        console.error(`❌ ${jobType} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }

  const jobs = await db.sql`
    SELECT job_type, status, LEFT(error, 150) AS error
    FROM jobs WHERE idempotency_key LIKE ${`%${today}%`}
    ORDER BY created_at
  `;
  const [sent] = await db.sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM activities WHERE type = 'email_sent' AND occurred_at >= ${today}::date
  `;
  const [leads] = await db.sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM activities WHERE type = 'lead_discovered' AND occurred_at >= ${today}::date
  `;

  console.log("\n--- Status ---");
  console.log(JSON.stringify({ jobs, sentToday: sent?.c, leadsDiscoveredToday: leads?.c }, null, 2));

  await db.sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
