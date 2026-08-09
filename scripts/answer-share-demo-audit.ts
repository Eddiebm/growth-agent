#!/usr/bin/env tsx
/** Integration: demo onboard → approve → audit → report */

import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import { createDb } from "../apps/api/src/jobs/db.js";
import { createBusinessFromOnboarding, startAudit } from "../packages/answer-share/index.js";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  process.env.ANSWER_SHARE_FORCE_DEMO = "true";
  process.env.ANSWER_SHARE_SYNC = "true";

  const db = createDb(process.env.DATABASE_URL);
  try {
    const result = await createBusinessFromOnboarding(db, {
      businessName: "Laclede Comfort HVAC Integration",
      websiteUrl: "https://example.com/laclede",
      aliases: ["Laclede Comfort"],
      serviceCategory: "hvac",
      city: "St. Louis",
      state: "MO",
      forceDemo: true,
      competitors: [{ name: "Gateway Heating & Cooling" }],
    });

    await db.sql`
      UPDATE as_buyer_questions SET status = 'approved'
      WHERE business_id = ${result.businessId}
    `;
    await db.sql`
      UPDATE as_competitors SET approved = true
      WHERE business_id = ${result.businessId}
    `;

    const auditId = await startAudit(db, {
      organizationId: result.organizationId,
      businessId: result.businessId,
      kind: "demo",
      isDemo: true,
      runsPerProvider: 1,
    });

    const [audit] = await db.sql<{ status: string; metrics: { visibilityScore?: number } }[]>`
      SELECT status, metrics FROM as_audits WHERE id = ${auditId}
    `;
    const [runs] = await db.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM as_provider_runs WHERE audit_id = ${auditId}
    `;
    const [recs] = await db.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM as_recommendations WHERE audit_id = ${auditId}
    `;
    const [report] = await db.sql<{ id: string }[]>`
      SELECT id FROM as_reports WHERE audit_id = ${auditId}
    `;

    console.log(
      JSON.stringify(
        {
          auditId,
          status: audit.status,
          score: audit.metrics?.visibilityScore,
          runs: runs.n,
          actions: recs.n,
          reportId: report?.id,
        },
        null,
        2,
      ),
    );

    if (audit.status !== "completed" && audit.status !== "partial") {
      throw new Error(`Unexpected audit status ${audit.status}`);
    }
    if (!report?.id) throw new Error("Missing report");
    if (runs.n < 1) throw new Error("No provider runs");
    if (recs.n < 1) throw new Error("No recommendations");
    console.log("INTEGRATION_OK");
  } finally {
    await db.sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
