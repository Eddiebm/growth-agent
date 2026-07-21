#!/usr/bin/env tsx
/** Force-enqueue today's pipeline jobs (same path as dashboard Force run). */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createDb } from "../apps/api/src/jobs/db.js";
import { forcePipeline } from "../packages/actions/force-pipeline.js";

config({ path: resolve(process.cwd(), ".env") });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const db = createDb(databaseUrl);
  const result = await forcePipeline(db, {
    note: "Force pipeline from CLI",
  });

  console.log(`✅ Jobs queued for ${result.today}`);
  console.log(JSON.stringify(result, null, 2));

  const jobs = await db.sql`
    SELECT job_type, status, LEFT(error, 150) AS error
    FROM jobs WHERE idempotency_key = ANY(${result.jobs})
    ORDER BY created_at
  `;
  console.log("\n--- Jobs ---");
  console.log(JSON.stringify(jobs, null, 2));

  await db.sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
