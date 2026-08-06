import type { JSONValue } from "postgres";
import type { Db } from "../../apps/api/src/jobs/db.js";
import { getHeroProductSlug } from "../hero-config/index.js";

export interface PlaybookWriteResult {
  objectionsWritten: number;
  dispositionsWritten: number;
  pendingApprovals: number;
}

/**
 * Pull recent objections + voice dispositions and stage them as playbook
 * learnings. Messaging changes that rewrite published playbook text go through
 * the approval queue (`publish_content`); memory keys used by the copywriter
 * are updated immediately so agents see patterns without waiting.
 */
export async function writeWeeklyPlaybookLearnings(
  db: Db,
  periodStart: Date,
  periodEnd: Date,
): Promise<PlaybookWriteResult> {
  const productSlug = getHeroProductSlug();
  const objections = await topObjections(db, periodStart, periodEnd);
  const dispositions = await topDispositions(db, periodStart, periodEnd);

  if (objections.length > 0) {
    await db.sql`
      INSERT INTO agent_memory (namespace, key, value)
      VALUES (
        'playbook',
        ${`${productSlug}:objections`},
        ${db.sql.json({
          at: new Date().toISOString(),
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          items: objections,
        } as unknown as JSONValue)}
      )
      ON CONFLICT (namespace, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }

  if (dispositions.length > 0) {
    await db.sql`
      INSERT INTO agent_memory (namespace, key, value)
      VALUES (
        'playbook',
        ${`${productSlug}:dispositions`},
        ${db.sql.json({
          at: new Date().toISOString(),
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          items: dispositions,
        } as unknown as JSONValue)}
      )
      ON CONFLICT (namespace, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }

  let pendingApprovals = 0;
  const learnedBlock = formatLearnedBlock(objections, dispositions);
  if (learnedBlock) {
    await db.approvals.create({
      action: "publish_content",
      agentId: "strategist",
      payload: {
        type: "playbook_append",
        productSlug,
        kind: "PLAYBOOK",
        appendBlock: learnedBlock,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
      reason: "Weekly learning wants to append objection/disposition notes to PLAYBOOK",
    });
    pendingApprovals = 1;
  }

  return {
    objectionsWritten: objections.length,
    dispositionsWritten: dispositions.length,
    pendingApprovals,
  };
}

export async function getPlaybookLearnings(
  db: Db,
  productSlug: string,
): Promise<{ objections: string[]; dispositions: string[] }> {
  const [objRow] = await db.sql<{ value: { items?: { text: string }[] } }[]>`
    SELECT value FROM agent_memory
    WHERE namespace = 'playbook' AND key = ${`${productSlug}:objections`}
  `;
  const [dispRow] = await db.sql<{ value: { items?: { text: string }[] } }[]>`
    SELECT value FROM agent_memory
    WHERE namespace = 'playbook' AND key = ${`${productSlug}:dispositions`}
  `;
  return {
    objections: (objRow?.value?.items ?? []).map((i) => i.text).filter(Boolean),
    dispositions: (dispRow?.value?.items ?? []).map((i) => i.text).filter(Boolean),
  };
}

async function topObjections(
  db: Db,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ text: string; count: number }[]> {
  const rows = await db.sql<{ body: string | null; count: string }[]>`
    SELECT COALESCE(body, subject, 'objection') AS body, COUNT(*)::text AS count
    FROM activities
    WHERE type IN ('email_replied', 'reply_received', 'note')
      AND occurred_at >= ${periodStart}
      AND occurred_at < ${periodEnd}
      AND metadata->>'classification' = 'objection'
    GROUP BY 1
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `;
  return rows
    .map((r) => ({
      text: (r.body ?? "").trim().slice(0, 240),
      count: Number(r.count),
    }))
    .filter((r) => r.text.length > 0);
}

async function topDispositions(
  db: Db,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ text: string; count: number }[]> {
  const rows = await db.sql<{ disposition: string; count: string }[]>`
    SELECT disposition, COUNT(*)::text AS count
    FROM voice_calls
    WHERE disposition IS NOT NULL
      AND created_at >= ${periodStart}
      AND created_at < ${periodEnd}
    GROUP BY disposition
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `;
  return rows.map((r) => ({
    text: r.disposition,
    count: Number(r.count),
  }));
}

function formatLearnedBlock(
  objections: { text: string; count: number }[],
  dispositions: { text: string; count: number }[],
): string | null {
  if (objections.length === 0 && dispositions.length === 0) return null;
  const lines = [
    "",
    "## Learned this week (auto — review before relying on it)",
    "",
  ];
  if (objections.length > 0) {
    lines.push("### Top objections");
    for (const o of objections) {
      lines.push(`- (${o.count}×) ${o.text}`);
    }
    lines.push("");
  }
  if (dispositions.length > 0) {
    lines.push("### Voice dispositions");
    for (const d of dispositions) {
      lines.push(`- (${d.count}×) ${d.text}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
