#!/usr/bin/env tsx
/** Pre-flight checks before turning off MOCK_INTEGRATIONS */

import { config } from "dotenv";
import { resolve } from "node:path";
import { resolve4 } from "node:dns/promises";
import postgres from "postgres";
import { getHeroProductSlug } from "../packages/hero-config/index.js";

config({ path: resolve(process.cwd(), ".env") });

const REQUIRED_ALWAYS = ["DATABASE_URL"] as const;
const REQUIRED_LIVE = [
  "OPENROUTER_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
] as const;

const OPTIONAL_VOICE = [
  "VAPI_API_KEY",
  "VAPI_SALES_ASSISTANT_ID",
  "VAPI_PHONE_NUMBER_ID",
] as const;

async function main(): Promise<void> {
  const mockFlag = process.env.MOCK_INTEGRATIONS;
  const mock = mockFlag === "true";
  const hero = getHeroProductSlug();

  console.log(`\n🎯 Hero product: ${hero}`);
  console.log(
    `   MOCK_INTEGRATIONS=${mockFlag ?? "(unset)"} → ${mock ? "MOCK (safe)" : "LIVE (real sends)"}\n`,
  );

  let failed = 0;

  for (const key of REQUIRED_ALWAYS) {
    if (!process.env[key]) {
      console.log(`❌ ${key} — missing`);
      failed += 1;
    } else {
      console.log(`✅ ${key}`);
    }
  }

  if (!mock) {
    console.log("\nLive integration keys (Resend + model):");
    for (const key of REQUIRED_LIVE) {
      if (!process.env[key]) {
        console.log(`❌ ${key} — missing`);
        failed += 1;
      } else {
        console.log(`✅ ${key}`);
      }
    }

    if (process.env.SERPER_API_KEY) {
      console.log("✅ Lead source: Serper (Google Places)");
    } else if (process.env.APOLLO_API_KEY) {
      console.log("✅ Lead source: Apollo");
    } else {
      console.log("❌ Lead source — set SERPER_API_KEY or APOLLO_API_KEY");
      failed += 1;
    }

    console.log("\nVoice (warm follow-up — optional but recommended):");
    for (const key of OPTIONAL_VOICE) {
      if (!process.env[key]) {
        console.log(`⚠️  ${key} — missing (warm Vapi calls will stay mock/skipped)`);
      } else {
        console.log(`✅ ${key}`);
      }
    }
    if (process.env.VAPI_WEBHOOK_SECRET) {
      console.log("✅ VAPI_WEBHOOK_SECRET");
    } else {
      console.log("⚠️  VAPI_WEBHOOK_SECRET — set so /webhooks/vapi can verify signatures");
    }
    if (process.env.CALCOM_BOOKING_URL) {
      console.log(`✅ CALCOM_BOOKING_URL=${process.env.CALCOM_BOOKING_URL}`);
    } else {
      console.log("⚠️  CALCOM_BOOKING_URL — booking links will use generic cal.com");
    }
  } else {
    console.log("\n⏭️  Skipping Resend/Serper/OpenRouter/Vapi (MOCK_INTEGRATIONS=true)");
    console.log("   Set MOCK_INTEGRATIONS=false on Render before live sends.");
  }

  // Public site reachability + optional DNS (best-effort)
  try {
    const addrs = await resolve4("makola.org");
    console.log(`\n✅ DNS makola.org → ${addrs.slice(0, 3).join(", ")}`);
  } catch (err) {
    console.log(
      `\n⚠️  DNS makola.org lookup failed: ${err instanceof Error ? err.message : err}`,
    );
  }

  try {
    const res = await fetch("https://makola.org", { method: "HEAD", redirect: "follow" });
    if (res.ok) {
      console.log(`✅ https://makola.org → HTTP ${res.status}`);
    } else {
      console.log(`⚠️  https://makola.org → HTTP ${res.status} (check Deployment Protection)`);
    }
  } catch (err) {
    console.log(`⚠️  https://makola.org unreachable: ${err instanceof Error ? err.message : err}`);
  }

  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = postgres(url, { ssl: url.includes("neon.tech") ? "require" : undefined });
    try {
      const [heroRow] = await sql<{ slug: string; status: string }[]>`
        SELECT slug, status::text FROM products WHERE slug = ${hero}
      `;
      if (!heroRow) {
        console.log(`❌ Hero product "${hero}" not in database — run npm run db:migrate`);
        failed += 1;
      } else if (heroRow.status !== "active") {
        console.log(`❌ Hero product status is "${heroRow.status}" — expected active`);
        failed += 1;
      } else {
        console.log(`✅ Hero product active in DB`);
      }

      const [cap] = await sql<{ value: number }[]>`
        SELECT value FROM agent_memory WHERE namespace = 'system' AND key = 'daily_send_cap'
      `;
      console.log(`✅ Daily send cap: ${cap?.value ?? "default (10)"}`);

      const [mode] = await sql<{ value: string }[]>`
        SELECT value FROM agent_memory WHERE namespace = 'system' AND key = 'outreach_mode'
      `;
      const outreachMode = mode?.value ?? process.env.OUTREACH_MODE ?? "triggered";
      console.log(`✅ Outreach mode: ${outreachMode}`);

      const activeCount = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM products WHERE status = 'active'
      `;
      const n = Number(activeCount[0]?.count ?? 0);
      if (n > 1) {
        console.log(`⚠️  ${n} active products — hero mode expects 1. Run migration 007.`);
      } else {
        console.log(`✅ ${n} active product (focused)`);
      }
    } finally {
      await sql.end();
    }
  }

  if (failed > 0) {
    console.log(`\n❌ ${failed} check(s) failed.\n`);
    process.exit(1);
  }

  if (mock) {
    console.log("\n✅ Ready for mock runs. Set MOCK_INTEGRATIONS=false on Render when keys are set.\n");
  } else {
    console.log("\n✅ Ready for live outreach. Start with 5 sends/day (warmup cap).\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
