import type { Db } from "../../apps/api/src/jobs/db.js";

export const TRIGGER_SOURCES = [
  "manual",
  "approval",
  "reply_follow_up",
  "signup",
  "api",
  "cron",
] as const;

export type TriggerSource = (typeof TRIGGER_SOURCES)[number];

export interface OutreachTrigger {
  source: TriggerSource;
  id?: string;
  note?: string;
}

export interface TriggerOutreachInput {
  source: TriggerSource;
  batchSize?: number;
  contactIds?: string[];
  campaignId?: string;
  triggerId?: string;
  note?: string;
}

const DEFAULT_CAMPAIGN_ID =
  process.env.DEFAULT_CAMPAIGN_ID ?? "11111111-1111-1111-1111-111111111111";

async function getCap(db: Db): Promise<number> {
  const [row] = await db.sql<{ value: number }[]>`
    SELECT value FROM agent_memory
    WHERE namespace = 'system' AND key = 'daily_send_cap'
  `;
  return typeof row?.value === "number" ? row.value : 10;
}

export async function triggerOutreach(
  db: Db,
  input: TriggerOutreachInput,
): Promise<{
  jobId: string;
  batchSize: number;
  payload: {
    campaignId: string;
    batchSize: number;
    dryRun: boolean;
    contactIds?: string[];
    trigger: OutreachTrigger;
  };
}> {
  const campaignId = input.campaignId ?? DEFAULT_CAMPAIGN_ID;
  const cap = await getCap(db);
  const batchSize = Math.min(input.batchSize ?? cap, cap);

  const trigger: OutreachTrigger = {
    source: input.source,
    id: input.triggerId,
    note: input.note,
  };

  const idempotencyKey = input.triggerId
    ? `outreach:trigger:${input.source}:${input.triggerId}`
    : undefined;

  const jobId = await db.jobs.enqueue({
    jobType: "outreach",
    payload: {
      campaignId,
      batchSize,
      dryRun: false,
      contactIds: input.contactIds,
      trigger,
    },
    scheduledFor: new Date(),
    idempotencyKey,
  });

  await db.activities.create({
    type: "note",
    agentId: "orchestrator",
    metadata: {
      event: "outreach_triggered",
      source: input.source,
      jobId,
      batchSize,
      contactIds: input.contactIds ?? null,
      note: input.note ?? null,
    },
  });

  return {
    jobId,
    batchSize,
    payload: {
      campaignId,
      batchSize,
      dryRun: false,
      contactIds: input.contactIds,
      trigger,
    },
  };
}
