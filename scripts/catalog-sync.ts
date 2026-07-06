#!/usr/bin/env tsx
/**
 * Sync GitHub repos into the products catalog (paused by default).
 * Usage: npm run catalog:sync
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { createDb } from "../apps/api/src/jobs/db.js";

const GITHUB_USER = process.env.CATALOG_GITHUB_USER ?? "Eddiebm";

interface GhRepo {
  name: string;
  description: string | null;
  isArchived: boolean;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function listRepos(): GhRepo[] {
  try {
    const raw = execSync(
      `gh repo list ${GITHUB_USER} --limit 1000 --json name,description,isArchived`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );
    const repos = JSON.parse(raw) as GhRepo[];
    return repos.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("gh repo list failed — install gh CLI and authenticate:", err);
    process.exit(1);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");

  const db = createDb(url);
  const repos = listRepos();
  let upserted = 0;
  let skipped = 0;

  for (const repo of repos) {
    const slug = slugify(repo.name);
    if (!slug) {
      skipped += 1;
      continue;
    }

    const existing = await db.products.getBySlug(slug);
    await db.products.upsertFromCatalog({
      slug,
      name: repo.name,
      repo: `${GITHUB_USER}/${repo.name}`,
      description: repo.description?.trim() || null,
      laymanPitch:
        existing?.laymanPitch ??
        (repo.description?.trim() && repo.description.trim().length >= 20
          ? repo.description.trim()
          : null),
      status: existing?.status ?? (repo.isArchived ? "archived" : "paused"),
    });
    upserted += 1;
  }

  console.log(
    `Synced ${upserted} repos from ${GITHUB_USER} (${skipped} skipped). Total from GitHub: ${repos.length}.`,
  );
  await db.sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
