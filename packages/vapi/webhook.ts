import { z } from "zod";

/** Tolerant Vapi end-of-call / status webhook payload */
const vapiWebhookSchema = z
  .object({
    message: z
      .object({
        type: z.string().optional(),
        timestamp: z.number().optional(),
        endedReason: z.string().optional(),
        recordingUrl: z.string().optional(),
        stereoRecordingUrl: z.string().optional(),
        transcript: z.string().optional(),
        summary: z.string().optional(),
        cost: z.number().optional(),
        durationSeconds: z.number().optional(),
        durationMs: z.number().optional(),
        call: z
          .object({
            id: z.string().optional(),
            status: z.string().optional(),
            type: z.string().optional(),
            startedAt: z.string().optional(),
            endedAt: z.string().optional(),
            cost: z.number().optional(),
            metadata: z.record(z.unknown()).optional(),
            customer: z
              .object({
                number: z.string().optional(),
              })
              .optional(),
            phoneNumber: z
              .object({
                number: z.string().optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .optional(),
        artifact: z
          .object({
            transcript: z.string().optional(),
            recordingUrl: z.string().optional(),
          })
          .passthrough()
          .optional(),
        analysis: z
          .object({
            summary: z.string().optional(),
            successEvaluation: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    // Some payloads put call at the top level
    call: z
      .object({
        id: z.string().optional(),
        status: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ParsedVapiWebhook = {
  eventType: string;
  callId: string | null;
  status: string;
  endedReason: string | null;
  durationSeconds: number | null;
  costCents: number | null;
  recordingUrl: string | null;
  transcriptExcerpt: string | null;
  summary: string | null;
  disposition: string | null;
  contactId: string | null;
  campaignId: string | null;
  customerNumber: string | null;
  fromNumber: string | null;
  startedAt: string | null;
  endedAt: string | null;
  rawMetadata: Record<string, unknown>;
};

function mapStatus(raw: string | undefined, endedReason: string | null): string {
  const s = (raw ?? "").toLowerCase();
  const reason = (endedReason ?? "").toLowerCase();
  if (reason.includes("no-answer") || reason.includes("no_answer")) return "no_answer";
  if (reason.includes("busy")) return "busy";
  if (reason.includes("cancel")) return "canceled";
  if (reason.includes("fail") || reason.includes("error")) return "failed";
  if (s.includes("end") || s === "completed" || s === "ended") return "completed";
  if (s.includes("progress") || s === "in-progress") return "in_progress";
  if (s.includes("ring")) return "ringing";
  if (s) return "completed";
  return "completed";
}

function estimateDisposition(summary: string | null, endedReason: string | null): string | null {
  const text = `${summary ?? ""} ${endedReason ?? ""}`.toLowerCase();
  if (!text.trim()) return null;
  if (text.includes("not interested") || text.includes("opt out") || text.includes("unsubscribe")) {
    return "not_interested";
  }
  if (
    text.includes("booked") ||
    text.includes("book a meeting") ||
    text.includes("meeting scheduled") ||
    text.includes("appointment")
  ) {
    return "meeting_booked";
  }
  if (text.includes("book") || text.includes("scheduled") || text.includes("calendar")) {
    return "booking_link_sent";
  }
  if (text.includes("callback") || text.includes("call back") || text.includes("busy")) {
    return "callback_requested";
  }
  if (text.includes("no-answer") || text.includes("voicemail")) return "no_answer";
  return "completed";
}

/** True when end-of-call disposition implies a meeting was agreed / link sent. */
export function dispositionSuggestsBooked(disposition: string | null): boolean {
  if (!disposition) return false;
  const d = disposition.toLowerCase();
  return (
    d === "meeting_booked" ||
    d === "booking_link_sent" ||
    d.includes("book") ||
    d.includes("scheduled")
  );
}

export function parseVapiWebhook(payload: unknown): ParsedVapiWebhook {
  const parsed = vapiWebhookSchema.safeParse(payload);
  const data = parsed.success ? parsed.data : (payload as Record<string, unknown>);
  const message =
    data && typeof data === "object" && "message" in data
      ? (data.message as Record<string, unknown>)
      : {};
  const call =
    (message.call as Record<string, unknown> | undefined) ??
    (data && typeof data === "object" && "call" in data
      ? (data.call as Record<string, unknown>)
      : {});

  const metadata = (call.metadata as Record<string, unknown> | undefined) ?? {};
  const artifact = (message.artifact as Record<string, unknown> | undefined) ?? {};
  const analysis = (message.analysis as Record<string, unknown> | undefined) ?? {};

  const transcript =
    (typeof message.transcript === "string" ? message.transcript : null) ??
    (typeof artifact.transcript === "string" ? artifact.transcript : null);
  const summary =
    (typeof message.summary === "string" ? message.summary : null) ??
    (typeof analysis.summary === "string" ? analysis.summary : null);

  const durationSeconds =
    typeof message.durationSeconds === "number"
      ? message.durationSeconds
      : typeof message.durationMs === "number"
        ? Math.round(message.durationMs / 1000)
        : null;

  const costUsd =
    typeof message.cost === "number"
      ? message.cost
      : typeof call.cost === "number"
        ? call.cost
        : null;

  const endedReason =
    typeof message.endedReason === "string" ? message.endedReason : null;
  const recordingUrl =
    (typeof message.recordingUrl === "string" ? message.recordingUrl : null) ??
    (typeof message.stereoRecordingUrl === "string" ? message.stereoRecordingUrl : null) ??
    (typeof artifact.recordingUrl === "string" ? artifact.recordingUrl : null);

  const customer = call.customer as { number?: string } | undefined;
  const phoneNumber = call.phoneNumber as { number?: string } | undefined;

  const callId =
    (typeof call.id === "string" ? call.id : null) ??
    (typeof (data as { id?: string }).id === "string" ? (data as { id: string }).id : null);

  const status = mapStatus(
    typeof call.status === "string" ? call.status : undefined,
    endedReason,
  );

  return {
    eventType: typeof message.type === "string" ? message.type : "unknown",
    callId,
    status,
    endedReason,
    durationSeconds,
    costCents: costUsd != null ? Math.round(costUsd * 100) : null,
    recordingUrl,
    transcriptExcerpt: transcript ? transcript.slice(0, 2000) : null,
    summary,
    disposition: estimateDisposition(summary, endedReason),
    contactId: typeof metadata.contactId === "string" ? metadata.contactId : null,
    campaignId: typeof metadata.campaignId === "string" ? metadata.campaignId : null,
    customerNumber: customer?.number ?? null,
    fromNumber: phoneNumber?.number ?? null,
    startedAt: typeof call.startedAt === "string" ? call.startedAt : null,
    endedAt: typeof call.endedAt === "string" ? call.endedAt : null,
    rawMetadata: metadata,
  };
}

export function estimateCostCents(
  durationSeconds: number | null,
  centsPerMinute = Number(process.env.VAPI_COST_PER_MIN_CENTS ?? 15),
): number | null {
  if (durationSeconds == null || durationSeconds < 0) return null;
  return Math.max(1, Math.ceil((durationSeconds / 60) * centsPerMinute));
}
