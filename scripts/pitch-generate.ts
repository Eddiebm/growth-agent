#!/usr/bin/env tsx
/**
 * Generate layman pitches for products missing one.
 * Usage: npm run pitches:generate [-- --limit 20] [-- --slug boswell-saas]
 */
import "dotenv/config";
import { z } from "zod";
import { createDb } from "../apps/api/src/jobs/db.js";
import { llmComplete } from "../apps/api/src/jobs/llm.js";

const PitchSchema = z.object({
  pitch: z.string().min(20).max(400),
});

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 50;
  const slugIdx = args.indexOf("--slug");
  const onlySlug = slugIdx >= 0 ? args[slugIdx + 1] : undefined;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");

  const db = createDb(url);
  const products = await db.products.list();
  const targets = products
    .filter((p) => !p.laymanPitch?.trim())
    .filter((p) => !onlySlug || p.slug === onlySlug)
    .slice(0, limit);

  if (targets.length === 0) {
    console.log("No products need pitches.");
    await db.sql.end();
    return;
  }

  console.log(`Generating pitches for ${targets.length} products…`);

  for (const product of targets) {
    let pitch: string | null = null;

    if (process.env.MOCK_INTEGRATIONS === "true" || !process.env.OPENROUTER_API_KEY) {
      pitch =
        product.description?.trim() ||
        `${product.name} is a software tool — connect your repo or book a call to see if it fits your workflow.`;
    } else {
      const raw = await llmComplete({
      model: "google/gemini-2.0-flash-001",
      system: [
        "You write plain-English product pitches for non-technical buyers.",
        "Return JSON: { \"pitch\": \"...\" }",
        "Rules:",
        "- One or two short sentences only (~10 seconds to read aloud)",
        "- Say what it IS and what it DOES for the user",
        "- No jargon, no hype, no emojis",
        "- Do not mention pricing unless clearly stated in the input",
      ].join("\n"),
      user: JSON.stringify({
        name: product.name,
        repo: product.repo,
        technicalDescription: product.description,
      }),
      responseFormat: "json",
    });

      const parsed = PitchSchema.safeParse(raw.json);
      if (!parsed.success) {
        console.warn(`Skip ${product.slug}: invalid LLM output`);
        continue;
      }
      pitch = parsed.data.pitch;
    }

    await db.products.updateLaymanPitch(product.id, pitch);
    console.log(`✓ ${product.slug}`);
  }

  await db.sql.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
