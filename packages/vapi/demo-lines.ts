import { listPhoneNumbers, type VapiPhoneNumber } from "./index.js";

export interface DemoLine {
  areaCode: string;
  number: string;
  phoneNumberId: string;
  label: string;
  states: string[];
}

/** Known free-tier numbers (IDs resolved from Vapi when possible). */
const DEMO_LINE_CATALOG: Omit<DemoLine, "phoneNumberId">[] = [
  { areaCode: "513", number: "+15138227392", label: "Cincinnati", states: ["OH", "KY"] },
  { areaCode: "813", number: "+18135180562", label: "Tampa", states: ["FL"] },
  { areaCode: "405", number: "+14058042346", label: "Oklahoma City", states: ["OK", "TX", "KS"] },
  { areaCode: "201", number: "+12015863772", label: "North Jersey", states: ["NJ", "NY"] },
  { areaCode: "207", number: "+12073158236", label: "Maine", states: ["ME", "NH", "VT"] },
  { areaCode: "209", number: "+12094482258", label: "Central California", states: ["CA", "NV", "AZ"] },
  { areaCode: "219", number: "+12192857724", label: "Northwest Indiana", states: ["IN"] },
  { areaCode: "224", number: "+12245043711", label: "Chicago suburbs", states: ["IL", "WI"] },
  { areaCode: "228", number: "+12285884642", label: "Gulf Coast", states: ["MS", "LA", "AL"] },
  { areaCode: "231", number: "+12318336818", label: "Michigan", states: ["MI"] },
];

const STATE_TO_AREA: Record<string, string> = {};
for (const line of DEMO_LINE_CATALOG) {
  for (const state of line.states) {
    if (!STATE_TO_AREA[state]) STATE_TO_AREA[state] = line.areaCode;
  }
}

let cachedLines: DemoLine[] | null = null;

function areaCodeFromNumber(number: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return null;
}

function resolveIds(catalog: Omit<DemoLine, "phoneNumberId">[], live: VapiPhoneNumber[]): DemoLine[] {
  const byNumber = new Map(live.map((n) => [n.number, n.id]));
  const defaultId = process.env.VAPI_PHONE_NUMBER_ID ?? live[0]?.id ?? "";

  return catalog.map((line) => ({
    ...line,
    phoneNumberId: byNumber.get(line.number) ?? defaultId,
  }));
}

export async function getDemoLines(): Promise<DemoLine[]> {
  if (cachedLines) return cachedLines;

  if (process.env.VAPI_API_KEY) {
    try {
      const live = await listPhoneNumbers();
      cachedLines = resolveIds(DEMO_LINE_CATALOG, live);
      return cachedLines;
    } catch {
      // fall through to static catalog
    }
  }

  const defaultId = process.env.VAPI_PHONE_NUMBER_ID ?? "";
  cachedLines = DEMO_LINE_CATALOG.map((line) => ({
    ...line,
    phoneNumberId: line.number === "+15138227392" ? defaultId : defaultId,
  }));
  return cachedLines;
}

export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const national = digits.length === 11 ? digits.slice(1) : digits;
  if (national.length !== 10) return e164;
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

export function parseStateFromSearchCity(searchCity?: string | null): string | null {
  if (!searchCity) return null;
  const parts = searchCity.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.toUpperCase();
  return last && last.length === 2 ? last : null;
}

export async function pickDemoLine(opts: {
  state?: string | null;
  searchCity?: string | null;
}): Promise<DemoLine> {
  const lines = await getDemoLines();
  const state = (opts.state ?? parseStateFromSearchCity(opts.searchCity))?.toUpperCase() ?? null;
  const preferredArea = state ? STATE_TO_AREA[state] : null;

  if (preferredArea) {
    const match = lines.find((l) => l.areaCode === preferredArea);
    if (match) return match;
  }

  return lines[0] ?? lines.find((l) => l.areaCode === "513")!;
}

export async function buildEmailFooter(opts: {
  state?: string | null;
  searchCity?: string | null;
}): Promise<{ text: string; html: string; demoLine: DemoLine }> {
  const demoLine = await pickDemoLine(opts);
  const display = formatPhoneDisplay(demoLine.number);

  const text = [
    "",
    "---",
    `Want to hear it? Call our ${demoLine.label} demo line: ${display}`,
    "Pretend you're a customer with a broken AC — that's what your shop would get.",
  ].join("\n");

  const html = [
    "<hr />",
    `<p><strong>Want to hear it?</strong> Call our ${demoLine.label} demo line: <a href="tel:${demoLine.number}">${display}</a></p>`,
    "<p><em>Pretend you're a customer with a broken AC — that's what your shop would get.</em></p>",
  ].join("");

  return { text, html, demoLine };
}

export function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}
