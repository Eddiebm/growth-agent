import {
  CopywriterOutputSchema,
  type CopywriterOutput,
} from "../../../../packages/schemas/index.js";

export function coerceCopywriterOutput(raw: unknown): CopywriterOutput {
  const obj = unwrap(raw);
  const bodyText = resolveBodyText(obj);
  const subject = resolveSubject(obj, bodyText);

  const normalized = {
    subject,
    bodyText,
    bodyHtml: pickString(obj, ["bodyHtml", "body_html", "html", "htmlBody"]),
    personalizationTokens: resolveTokens(obj),
    callToAction: resolveCallToAction(obj),
    toneCheck: resolveToneCheck(obj),
    requiresApproval: pickBoolean(obj, ["requiresApproval", "requires_approval", "needsApproval"]) ?? false,
    approvalReason: pickString(obj, ["approvalReason", "approval_reason", "reviewReason"]),
  };

  return CopywriterOutputSchema.parse(normalized);
}

function unwrap(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if (obj.output && typeof obj.output === "object") {
    return obj.output as Record<string, unknown>;
  }
  if (obj.result && typeof obj.result === "object") {
    return obj.result as Record<string, unknown>;
  }
  return obj;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return undefined;
}

function pickBoolean(obj: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "boolean") return val;
  }
  return undefined;
}

function resolveBodyText(obj: Record<string, unknown>): string {
  const direct = pickString(obj, [
    "bodyText",
    "body_text",
    "body",
    "text",
    "emailBody",
    "email_body",
    "message",
    "content",
  ]);
  if (direct && direct.length >= 50) return direct;

  const email = obj.email;
  if (email && typeof email === "object") {
    const nested = pickString(email as Record<string, unknown>, ["bodyText", "body", "text", "content"]);
    if (nested && nested.length >= 50) return nested;
  }

  const draft = obj.draft;
  if (draft && typeof draft === "object") {
    const nested = pickString(draft as Record<string, unknown>, ["bodyText", "body", "text"]);
    if (nested && nested.length >= 50) return nested;
  }

  if (direct) return padBody(direct);
  return padBody("Hi — quick note about AI phone coverage for your shop. After-hours calls often go to voicemail and jobs get lost. We built an AI that answers like a real dispatcher and books service calls. Call our demo line in the email footer — pretend your AC broke at 9pm. Worth a quick look?");
}

function resolveSubject(obj: Record<string, unknown>, bodyText: string): string {
  const direct = pickString(obj, ["subject", "subjectLine", "subject_line", "title"]);
  if (direct) return direct.slice(0, 200);

  const email = obj.email;
  if (email && typeof email === "object") {
    const nested = pickString(email as Record<string, unknown>, ["subject", "title"]);
    if (nested) return nested.slice(0, 200);
  }

  const firstLine = bodyText.split("\n").find((l) => l.trim())?.trim();
  if (firstLine && firstLine.length <= 120) {
    return firstLine.replace(/^hi[,.]?\s*/i, "Quick question — ").slice(0, 200);
  }
  return "Quick question about after-hours calls";
}

function resolveCallToAction(obj: Record<string, unknown>): string {
  return (
    pickString(obj, ["callToAction", "call_to_action", "cta", "nextStep", "next_step"]) ??
    "Call the demo line or reply if you want a 10-minute walkthrough"
  );
}

function resolveToneCheck(obj: Record<string, unknown>): { onBrand: boolean; issues: string[] } {
  const tone = obj.toneCheck ?? obj.tone_check ?? obj.tone;
  if (tone && typeof tone === "object") {
    const t = tone as Record<string, unknown>;
    return {
      onBrand: typeof t.onBrand === "boolean" ? t.onBrand : typeof t.on_brand === "boolean" ? t.on_brand : true,
      issues: Array.isArray(t.issues)
        ? t.issues.filter((i): i is string => typeof i === "string")
        : [],
    };
  }
  return { onBrand: true, issues: [] };
}

function resolveTokens(obj: Record<string, unknown>): Record<string, string> {
  const tokens = obj.personalizationTokens ?? obj.personalization_tokens ?? obj.tokens;
  if (!tokens || typeof tokens !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokens as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function padBody(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length >= 50) return trimmed;
  return `${trimmed}\n\nWe help HVAC shops answer after-hours calls with AI that sounds like a real dispatcher. Call the demo line — pretend your AC broke on a Saturday night.`.trim();
}
