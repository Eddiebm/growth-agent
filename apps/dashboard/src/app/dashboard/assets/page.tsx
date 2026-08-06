import { AssetEditor, type AssetSnapshot } from "@/components/asset-editor";
import { DashboardNav } from "@/components/dashboard-nav";
import { getDb } from "@/lib/db";
import {
  ASSET_KINDS,
  listAssets,
} from "../../../../../../packages/assets/index";
import { loadDocs } from "../../../../../api/src/jobs/load-docs";
import { getHeroProductSlug } from "../../../../../../packages/hero-config/index";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ product?: string }>;
}

export default async function AssetsPage({ searchParams }: PageProps) {
  const { product } = await searchParams;
  const productSlug = product ?? getHeroProductSlug();
  const db = getDb();

  let assets: AssetSnapshot[] = [];
  try {
    const published = await listAssets(db, productSlug);
    const fileDocs = await loadDocs([...ASSET_KINDS], productSlug);
    assets = ASSET_KINDS.map((kind) => {
      const pub = published.find((a) => a.kind === kind);
      if (pub) {
        return {
          kind,
          content: pub.content,
          version: pub.version,
          source: "published" as const,
          updatedAt: pub.updatedAt,
          updatedBy: pub.updatedBy,
        };
      }
      return {
        kind,
        content: fileDocs[kind] ?? "",
        version: null,
        source: "file" as const,
        updatedAt: null,
        updatedBy: null,
      };
    });
  } finally {
    await db.sql.end();
  }

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="mx-auto max-w-[1100px] px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Marketing assets</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Versioned ICP / offer / playbook / voice / rate card for{" "}
            <span className="text-zinc-300">{productSlug}</span>. Published
            versions override repo markdown for agents.
          </p>
        </div>
        <AssetEditor productSlug={productSlug} assets={assets} />
      </main>
    </div>
  );
}
