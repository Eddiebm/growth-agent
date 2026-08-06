import { NextResponse } from "next/server";
import {
  ASSET_KINDS,
  isAssetKind,
  listAssets,
  publishAsset,
  type AssetKind,
} from "../../../../../../packages/assets/index";
import { loadDocs } from "../../../../../api/src/jobs/load-docs";
import { getDb } from "@/lib/db";
import { getHeroProductSlug } from "../../../../../../packages/hero-config/index";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productSlug = url.searchParams.get("productSlug") ?? getHeroProductSlug();
  const db = getDb();
  try {
    const published = await listAssets(db, productSlug);
    const publishedKinds = new Set(published.map((a) => a.kind));
    const fileDocs = await loadDocs([...ASSET_KINDS], productSlug);

    const assets = ASSET_KINDS.map((kind) => {
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
        missingPublished: !publishedKinds.has(kind),
      };
    });

    return NextResponse.json({ productSlug, assets });
  } finally {
    await db.sql.end();
  }
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    productSlug?: string;
    kind?: string;
    content?: string;
  };

  const productSlug = body.productSlug ?? getHeroProductSlug();
  if (!body.kind || !isAssetKind(body.kind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }
  if (typeof body.content !== "string" || body.content.trim().length < 20) {
    return NextResponse.json({ error: "content too short" }, { status: 400 });
  }

  const db = getDb();
  try {
    const asset = await publishAsset(db, {
      productSlug,
      kind: body.kind as AssetKind,
      content: body.content,
      updatedBy: "dashboard",
    });
    return NextResponse.json({ ok: true, version: asset.version });
  } catch (err) {
    console.error("asset publish:", err);
    return NextResponse.json({ error: "publish failed" }, { status: 500 });
  } finally {
    await db.sql.end();
  }
}
