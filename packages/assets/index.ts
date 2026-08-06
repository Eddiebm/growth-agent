import type { JSONValue } from "postgres";
import type { Db } from "../../apps/api/src/jobs/db.js";

export const ASSET_KINDS = [
  "ICP",
  "OFFER",
  "VOICE",
  "PLAYBOOK",
  "RATE_CARD",
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

export interface MarketingAsset {
  productSlug: string;
  kind: AssetKind;
  content: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

function memoryKey(productSlug: string, kind: AssetKind): string {
  return `${productSlug}:${kind.toLowerCase()}`;
}

function versionKey(productSlug: string, kind: AssetKind, version: number): string {
  return `${productSlug}:${kind.toLowerCase()}:v${version}`;
}

export function isAssetKind(value: string): value is AssetKind {
  return (ASSET_KINDS as readonly string[]).includes(value);
}

export async function getAsset(
  db: Db,
  productSlug: string,
  kind: AssetKind,
): Promise<MarketingAsset | null> {
  const [row] = await db.sql<{ value: MarketingAsset }[]>`
    SELECT value FROM agent_memory
    WHERE namespace = 'assets' AND key = ${memoryKey(productSlug, kind)}
  `;
  if (!row?.value?.content) return null;
  return {
    productSlug,
    kind,
    content: row.value.content,
    version: row.value.version ?? 1,
    updatedAt: row.value.updatedAt ?? new Date().toISOString(),
    updatedBy: row.value.updatedBy ?? "unknown",
  };
}

export async function listAssets(
  db: Db,
  productSlug: string,
): Promise<MarketingAsset[]> {
  const out: MarketingAsset[] = [];
  for (const kind of ASSET_KINDS) {
    const asset = await getAsset(db, productSlug, kind);
    if (asset) out.push(asset);
  }
  return out;
}

export async function listAssetVersions(
  db: Db,
  productSlug: string,
  kind: AssetKind,
  limit = 10,
): Promise<MarketingAsset[]> {
  const prefix = `${productSlug}:${kind.toLowerCase()}:v`;
  const rows = await db.sql<{ key: string; value: MarketingAsset; updated_at: Date }[]>`
    SELECT key, value, updated_at FROM agent_memory
    WHERE namespace = 'assets' AND key LIKE ${`${prefix}%`}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    productSlug,
    kind,
    content: row.value.content ?? "",
    version: row.value.version ?? (Number(row.key.replace(prefix, "")) || 0),
    updatedAt: row.value.updatedAt ?? row.updated_at.toISOString(),
    updatedBy: row.value.updatedBy ?? "unknown",
  }));
}

export async function publishAsset(
  db: Db,
  input: {
    productSlug: string;
    kind: AssetKind;
    content: string;
    updatedBy?: string;
  },
): Promise<MarketingAsset> {
  const existing = await getAsset(db, input.productSlug, input.kind);
  const version = (existing?.version ?? 0) + 1;
  const asset: MarketingAsset = {
    productSlug: input.productSlug,
    kind: input.kind,
    content: input.content,
    version,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? "dashboard",
  };

  await db.sql`
    INSERT INTO agent_memory (namespace, key, value)
    VALUES (
      'assets',
      ${memoryKey(input.productSlug, input.kind)},
      ${db.sql.json(asset as unknown as JSONValue)}
    )
    ON CONFLICT (namespace, key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;

  await db.sql`
    INSERT INTO agent_memory (namespace, key, value)
    VALUES (
      'assets',
      ${versionKey(input.productSlug, input.kind, version)},
      ${db.sql.json(asset as unknown as JSONValue)}
    )
    ON CONFLICT (namespace, key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;

  return asset;
}

export async function getPublishedDocs(
  db: Db,
  productSlug: string | undefined,
  keys: string[],
): Promise<Partial<Record<AssetKind, string>>> {
  if (!productSlug) return {};
  const out: Partial<Record<AssetKind, string>> = {};
  for (const key of keys) {
    if (!isAssetKind(key)) continue;
    const asset = await getAsset(db, productSlug, key);
    if (asset?.content?.trim()) out[key] = asset.content;
  }
  return out;
}
