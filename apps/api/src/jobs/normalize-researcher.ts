import {
  ResearcherOutputSchema,
  type ResearcherInput,
  type ResearcherOutput,
} from "../../../../packages/schemas/index.js";

export function coerceResearcherOutput(
  raw: unknown,
  input: Pick<ResearcherInput, "domain" | "companyName">,
): ResearcherOutput {
  const obj = unwrap(raw);

  const domain = pickString(obj, ["domain", "website", "url"]) ?? input.domain;
  const companyName =
    pickString(obj, ["companyName", "company_name", "name", "company"]) ??
    input.companyName ??
    domain;

  const normalized = {
    domain,
    companyName,
    industry: pickString(obj, ["industry", "sector", "vertical"]) ?? null,
    employeeCount: pickInt(obj, ["employeeCount", "employee_count", "employees", "headcount"]),
    country: pickString(obj, ["country", "region"]) ?? "US",
    description:
      pickString(obj, ["description", "summary", "overview", "about"]) ??
      `${companyName} is a local service business.`,
    linkedinUrl: pickUrl(obj, ["linkedinUrl", "linkedin_url", "linkedin"]),
    techStack: pickStringArray(obj, ["techStack", "tech_stack", "technologies", "tools"]),
    recentSignals: pickSignals(obj),
    confidence: pickConfidence(obj),
    sources: pickStringArray(obj, ["sources", "source"]),
  };

  return ResearcherOutputSchema.parse(normalized);
}

function unwrap(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if (obj.output && typeof obj.output === "object") return obj.output as Record<string, unknown>;
  if (obj.result && typeof obj.result === "object") return obj.result as Record<string, unknown>;
  if (obj.company && typeof obj.company === "object") return obj.company as Record<string, unknown>;
  return obj;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return undefined;
}

function pickInt(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && Number.isFinite(val)) return Math.round(val);
    if (typeof val === "string" && /^\d+$/.test(val)) return Number(val);
  }
  return null;
}

function pickUrl(obj: Record<string, unknown>, keys: string[]): string | null {
  const s = pickString(obj, keys);
  if (!s) return null;
  if (s.startsWith("http")) return s;
  return `https://${s.replace(/^\/\//, "")}`;
}

function pickConfidence(obj: Record<string, unknown>): number {
  for (const key of ["confidence", "score", "certainty"]) {
    const val = obj[key];
    if (typeof val === "number") return Math.min(1, Math.max(0, val > 1 ? val / 100 : val));
  }
  return 0.6;
}

function pickStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) {
      return val.filter((v): v is string => typeof v === "string");
    }
  }
  return [];
}

function pickSignals(obj: Record<string, unknown>): ResearcherOutput["recentSignals"] {
  const raw = obj.recentSignals ?? obj.recent_signals ?? obj.signals;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { signal: item, source: "research" };
      if (item && typeof item === "object") {
        const s = item as Record<string, unknown>;
        const signal = pickString(s, ["signal", "text", "description", "name"]);
        if (!signal) return null;
        return {
          signal,
          source: pickString(s, ["source", "type"]) ?? "research",
          observedAt: pickString(s, ["observedAt", "observed_at", "date"]),
        };
      }
      return null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}
