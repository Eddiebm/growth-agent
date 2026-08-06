import type { Db } from "../../apps/api/src/jobs/db.js";
import { loadDocs } from "../../apps/api/src/jobs/load-docs.js";
import { publishAsset, isAssetKind, type AssetKind } from "../assets/index.js";
import { triggerOutreach } from "./trigger-outreach.js";

export async function processApproval(
  db: Db,
  approvalId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const [approval] = await db.sql<
    {
      id: string;
      action: string;
      status: string;
      contact_id: string | null;
      campaign_id: string | null;
      payload: Record<string, unknown>;
    }[]
  >`
    SELECT id, action::text AS action, status::text AS status,
           contact_id, (payload->>'campaignId')::uuid AS campaign_id, payload
    FROM approvals WHERE id = ${approvalId}
  `;

  if (!approval || approval.status !== "pending") {
    throw new Error("Approval not found or already resolved");
  }

  await db.sql`
    UPDATE approvals SET
      status = ${decision}::approval_status,
      resolved_by = 'dashboard',
      resolved_at = now()
    WHERE id = ${approvalId}
  `;

  await db.activities.create({
    contactId: approval.contact_id ?? undefined,
    type: decision === "approved" ? "approval_granted" : "approval_rejected",
    agentId: "dashboard",
    metadata: { approvalId, action: approval.action },
  });

  if (decision !== "approved") return;

  if (approval.action === "publish_content") {
    await applyPublishContent(db, approval.payload);
    return;
  }

  if (approval.action !== "send_email" || !approval.contact_id) {
    return;
  }

  const campaignId =
    approval.campaign_id ??
    process.env.DEFAULT_CAMPAIGN_ID ??
    "11111111-1111-1111-1111-111111111111";

  await db.contacts.update(approval.contact_id, { status: "queued" });
  await db.campaignContacts.enroll(campaignId, approval.contact_id);

  await triggerOutreach(db, {
    source: "approval",
    batchSize: 1,
    contactIds: [approval.contact_id],
    campaignId,
    triggerId: approvalId,
  });
}

async function applyPublishContent(
  db: Db,
  payload: Record<string, unknown>,
): Promise<void> {
  const type = payload.type;
  if (type === "playbook_append") {
    const productSlug = String(payload.productSlug ?? "");
    const kindRaw = String(payload.kind ?? "PLAYBOOK");
    const appendBlock = String(payload.appendBlock ?? "");
    if (!productSlug || !appendBlock || !isAssetKind(kindRaw)) return;

    const kind = kindRaw as AssetKind;
    const docs = await loadDocs([kind], productSlug, db);
    const current = docs[kind] ?? "";
    const next = current.includes(appendBlock.trim())
      ? current
      : `${current.trimEnd()}\n${appendBlock}`;

    await publishAsset(db, {
      productSlug,
      kind,
      content: next,
      updatedBy: "approval:strategist",
    });
    return;
  }

  if (type === "asset_publish") {
    const productSlug = String(payload.productSlug ?? "");
    const kindRaw = String(payload.kind ?? "");
    const content = String(payload.content ?? "");
    if (!productSlug || !content || !isAssetKind(kindRaw)) return;
    await publishAsset(db, {
      productSlug,
      kind: kindRaw as AssetKind,
      content,
      updatedBy: "approval:dashboard",
    });
  }
}
