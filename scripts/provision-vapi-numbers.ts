#!/usr/bin/env tsx
/**
 * Provision up to 10 free Vapi US numbers (one per area code).
 *
 * Usage:
 *   VAPI_API_KEY=... tsx scripts/provision-vapi-numbers.ts
 *   VAPI_API_KEY=... VAPI_ASSISTANT_ID=... tsx scripts/provision-vapi-numbers.ts
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import {
  createFreePhoneNumber,
  DEFAULT_AREA_CODES,
  FALLBACK_AREA_CODES,
  listPhoneNumbers,
} from "../packages/vapi/index.js";

config({ path: resolve(process.cwd(), ".env") });

const MAX_FREE = 10;
const ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

async function main(): Promise<void> {
  if (!process.env.VAPI_API_KEY) {
    console.error("Set VAPI_API_KEY from dashboard.vapi.ai → API Keys");
    process.exit(1);
  }

  const existing = await listPhoneNumbers();
  console.log(`Existing numbers: ${existing.length}`);

  const slots = MAX_FREE - existing.length;
  if (slots <= 0) {
    console.log("Already at 10 numbers. Nothing to provision.");
    for (const n of existing) {
      console.log(`  ${n.number ?? "?"} (${n.id})`);
    }
    return;
  }

  const codes = [...DEFAULT_AREA_CODES, ...FALLBACK_AREA_CODES];
  let created = 0;

  for (const areaCode of codes) {
    if (created >= slots) break;

    try {
      const row = await createFreePhoneNumber({
        areaCode,
        assistantId: ASSISTANT_ID,
        name: `hvac-${areaCode}`,
      });
      created += 1;
      console.log(`✅ ${areaCode} → ${row.number ?? row.id}`);
      // Vapi may take a minute to activate
      await sleep(2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`⏭️  ${areaCode} skipped: ${msg.slice(0, 120)}`);
    }
  }

  console.log(`\nDone. Created ${created} number(s).`);
  if (created < slots) {
    console.log(
      "Some area codes had no inventory — retry later or pick different codes in the dashboard.",
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
