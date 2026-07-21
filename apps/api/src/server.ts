import { config } from "dotenv";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import cron from "node-cron";
import { createApp } from "./app.js";
import { getDb } from "./db-singleton.js";
import {
  ensureTodayJobsQueued,
  pollJobs,
  runDailyCron,
  runReplyTriageCron,
  runWeeklyLearningCron,
} from "./worker.js";

config({ path: resolve(process.cwd(), ".env") });

const PORT = Number(process.env.PORT ?? 3456);
const POLL_MS = Number(process.env.JOB_POLL_MS ?? 5_000);
const CRON_ENABLED = process.env.CRON_ENABLED !== "false";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = getDb();
const app = createApp();

function startCron(): void {
  if (!CRON_ENABLED) return;

  const tz = "UTC";
  cron.schedule("0 6 * * *", () => void runDailyCron(db), { timezone: tz });
  cron.schedule("0 7 * * 0", () => void runWeeklyLearningCron(db), { timezone: tz });
  cron.schedule("*/30 8-20 * * *", () => void runReplyTriageCron(db), { timezone: tz });

  console.log("[cron] Daily loop + weekly learning + reply triage scheduled (UTC)");
}

startCron();
void ensureTodayJobsQueued(db);
setInterval(() => void pollJobs(db), POLL_MS);

// Keep Render free-tier awake so daily cron actually fires.
// Render sets RENDER_EXTERNAL_URL; override with KEEP_ALIVE_URL if needed.
const KEEP_ALIVE_MS = Number(process.env.KEEP_ALIVE_MS ?? 4 * 60 * 1000);
const keepAliveUrl =
  process.env.KEEP_ALIVE_URL ??
  process.env.RENDER_EXTERNAL_URL ??
  process.env.APP_URL;
if (keepAliveUrl && process.env.KEEP_ALIVE !== "false") {
  const health = `${keepAliveUrl.replace(/\/$/, "")}/health`;
  setInterval(() => {
    void fetch(health).catch((err) => {
      console.warn(`[keepalive] ${health} failed:`, err instanceof Error ? err.message : err);
    });
  }, KEEP_ALIVE_MS);
  console.log(`[keepalive] pinging ${health} every ${KEEP_ALIVE_MS / 1000}s`);
}

serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, () => {
  console.log(`[api] listening on http://0.0.0.0:${PORT}`);
  console.log(`[api] health → /health | webhook → /webhooks/resend`);
});

process.on("SIGTERM", async () => {
  await db.sql.end();
  process.exit(0);
});
