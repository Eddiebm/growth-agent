import {
  LeadScorerOutputSchema,
  type LeadScorerOutput,
} from "../../../../packages/schemas/index.js";

const FITS = ["high", "medium", "low", "disqualified"] as const;
const ACTIONS = ["enroll_outreach", "nurture_only", "skip", "manual_review"] as const;

type Fit = (typeof FITS)[number];
type Action = (typeof ACTIONS)[number];

export function coerceLeadScorerOutput(raw: unknown): LeadScorerOutput {
  const obj = unwrap(raw);

  const companyScore = pickScore(obj, ["companyScore", "company_score", "score", "icpScore"]);
  const fit = resolveFit(obj, companyScore);
  const disqualify = pickBoolean(obj, ["disqualify", "disqualified"]) ?? fit === "disqualified";

  const normalized = {
    companyScore,
    contactScore: pickScoreOptional(obj, ["contactScore", "contact_score"]),
    fit,
    reasons: resolveReasons(obj),
    disqualify,
    disqualifyReason: pickString(obj, ["disqualifyReason", "disqualify_reason", "rejectReason"]),
    recommendedAction: resolveAction(obj, fit, disqualify),
    assignedProductSlug: pickString(obj, ["assignedProductSlug", "assigned_product_slug", "productSlug"]),
  };

  return LeadScorerOutputSchema.parse(normalized);
}

function unwrap(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if (obj.output && typeof obj.output === "object") return obj.output as Record<string, unknown>;
  if (obj.result && typeof obj.result === "object") return obj.result as Record<string, unknown>;
  if (obj.scoring && typeof obj.scoring === "object") return obj.scoring as Record<string, unknown>;
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

function pickScore(obj: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      return Math.min(100, Math.max(0, Math.round(val)));
    }
  }
  return 65;
}

function pickScoreOptional(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      return Math.min(100, Math.max(0, Math.round(val)));
    }
  }
  return undefined;
}

function resolveFit(obj: Record<string, unknown>, score: number): Fit {
  const raw = pickString(obj, ["fit", "tier", "qualification", "quality"]);
  if (raw && FITS.includes(raw as Fit)) return raw as Fit;
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  if (score >= 40) return "low";
  return "disqualified";
}

function resolveReasons(obj: Record<string, unknown>): string[] {
  const raw = obj.reasons ?? obj.reason ?? obj.rationale ?? obj.factors;
  if (Array.isArray(raw)) {
    const reasons = raw
      .map((r) => (typeof r === "string" ? r : typeof r === "object" && r && "text" in r ? String((r as { text: unknown }).text) : null))
      .filter((r): r is string => Boolean(r?.trim()))
      .slice(0, 5);
    if (reasons.length) return reasons;
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return ["Scored against HVAC ICP rules"];
}

function resolveAction(obj: Record<string, unknown>, fit: Fit, disqualify: boolean): Action {
  const raw = pickString(obj, ["recommendedAction", "recommended_action", "action", "nextStep"]);
  if (raw && ACTIONS.includes(raw as Action)) return raw as Action;
  if (disqualify || fit === "disqualified") return "skip";
  if (fit === "high" || fit === "medium") return "enroll_outreach";
  return "nurture_only";
}
