#!/usr/bin/env tsx
/**
 * Create or update the Growth Agent outbound sales assistant in Vapi.
 *
 * Usage:
 *   npm run vapi:setup-sales
 *
 * Then add VAPI_SALES_ASSISTANT_ID to .env and Render.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createOrUpdateSalesAssistant } from "../packages/vapi/assistants.js";

config({ path: resolve(process.cwd(), ".env") });

async function main(): Promise<void> {
  if (!process.env.VAPI_API_KEY) {
    console.error("Set VAPI_API_KEY in .env first");
    process.exit(1);
  }

  const { action, assistantId } = await createOrUpdateSalesAssistant();

  console.log(`\n✓ Sales assistant ${action}: ${assistantId}`);
  console.log("\nAdd to .env and Render:");
  console.log(`VAPI_SALES_ASSISTANT_ID=${assistantId}`);
  console.log("\nKeep VAPI_ASSISTANT_ID for HVAC demo lines (inbound only).");
  console.log("Warm outbound follow-ups use VAPI_SALES_ASSISTANT_ID.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
