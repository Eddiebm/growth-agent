import { config } from "dotenv";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import cron from "node-cron";
import { createDb } from "./jobs/db.js";
import { dispatchJob, enqueueDailyJobs, type JobType } from "./jobs/daily-loop.js";
import { handleResendWebhook, type ResendWebhookEvent } from "./jobs/integrations.js";
import { handleSignup } from "../../../packages/actions/handle-signup.js";
import { isOutreachPaused, setOutreachPaused } from "../../../packages/system-state/index.js";

config({ path: resolve(process.cwd(), ".env") });

const PORT = Number(process.env.PORT ?? 3456);
const POLL_MS = Number(process.env.JOB_POLL_MS ?? 5_000);
const BATCH_SIZE = Number(process.env.JOB_BATCH_SIZE ?? 5);
const DEFAULT_CAMPAIGN_ID =
  process.env.DEFAULT_CAMPAIGN_ID ?? "11111111-1111-1111-1111-111111111111";
const CRON_ENABLED = process.env.CRON_ENABLED !== "false";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(databaseUrl);
const app = new Hono();

app.use("/api/*", cors());

app.get("/health", async (c) => {
  try {
    await db.sql`SELECT 1`;
    const paused = await isOutreachPaused(db);
    return c.json({
      ok: true,
      outreachPaused: paused,
      mock: process.env.MOCK_INTEGRATIONS === "true",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 503);
  }
});

app.post("/webhooks/resend", async (c) => {
  const event = (await c.req.json()) as ResendWebhookEvent;
  await handleResendWebhook(db, event);
  return c.json({ received: true });
});

app.post("/api/signup", async (c) => {
  const body = (await c.req.json()) as {
    email?: string;
    name?: string;
    company?: string;
    utm?: Record<string, string>;
  };
  if (!body.email) {
    return c.json({ error: "email required" }, 400);
  }
  const result = await handleSignup(db, {
    email: body.email,
    name: body.name,
    company: body.company,
    utm: body.utm ?? {},
  });
  return c.json(result);
});

app.get("/api/system/status", async (c) => {
  const paused = await isOutreachPaused(db);
  const [jobs] = await db.sql<{ pending: string }[]>`
    SELECT COUNT(*)::text AS pending FROM jobs WHERE status = 'pending'
  `;
  return c.json({
    outreachPaused: paused,
    pendingJobs: Number(jobs?.pending ?? 0),
  });
});

app.post("/api/system/kill-switch", async (c) => {
  const apiKey = c.req.header("x-api-key");
  if (process.env.WORKER_API_KEY && apiKey !== process.env.WORKER_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const { paused } = (await c.req.json()) as { paused?: boolean };
  if (typeof paused !== "boolean") {
    return c.json({ error: "paused boolean required" }, 400);
  }
  await setOutreachPaused(db, paused);
  return c.json({ outreachPaused: paused });
});

async function pollJobs(): Promise<void> {
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
}

function startCron(): void {
  if (!CRON_ENABLED) return;

  const tz = "UTC";
  cron.schedule("0 6 * * *", () => void enqueueDailyJobs(db, DEFAULT_CAMPAIGN_ID), { timezone: tz });
  cron.schedule("*/30 8-20 * * *", () => {
    void db.jobs.enqueue({
      jobType: "reply_triage",
      idempotencyKey: `reply_triage:${Date.now()}`,
      payload: {
        since: new Date(Date.now() - 35 * 60_000).toISOString(),
        limit: 50,
      },
    });
  }, { timezone: tz });

  console.log("[cron] Daily loop + reply triage scheduled (UTC)");
}

startCron();
setInterval(() => void pollJobs(), POLL_MS);

serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, () => {
  console.log(`[api] listening on http://0.0.0.0:${PORT}`);
  console.log(`[api] health → /health | webhook → /webhooks/resend`);
});

process.on("SIGTERM", async () => {
  await db.sql.end();
  process.exit(0);
});
