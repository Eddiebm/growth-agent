#!/usr/bin/env tsx
/**
 * Resend inbound webhook server.
 *
 * Usage:
 *   npm run webhook:resend
 *
 * Point Resend webhook to: POST https://your-domain/webhooks/resend
 */

import { createServer } from "node:http";
import { createDb } from "../jobs/db.js";
import { handleResendWebhook, type ResendWebhookEvent } from "../jobs/integrations.js";

const PORT = Number(process.env.PORT ?? 3456);

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const db = createDb(databaseUrl);

  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && req.url === "/webhooks/resend") {
      try {
        const body = await readBody(req);
        const event = JSON.parse(body) as ResendWebhookEvent;

        if (process.env.RESEND_WEBHOOK_SECRET) {
          const sig = req.headers["svix-signature"];
          if (!sig) {
            res.writeHead(401);
            res.end("Missing signature");
            return;
          }
          // Verify with svix in production — skipped in MVP
        }

        await handleResendWebhook(db, event);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true }));
      } catch (err) {
        console.error("Webhook error:", err);
        res.writeHead(500);
        res.end("Internal error");
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, () => {
    console.log(`Resend webhook listening on http://localhost:${PORT}/webhooks/resend`);
  });
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

main().catch(console.error);
