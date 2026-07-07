export interface SalesAssistantConfig {
  agentName?: string;
  productName?: string;
  productPrice?: string;
  bookingUrl?: string;
  demoPitch?: string;
}

const DEFAULTS: Required<SalesAssistantConfig> = {
  agentName: "Alex",
  productName: "AI receptionist for HVAC shops",
  productPrice: "$299 per month",
  bookingUrl: process.env.CALCOM_BOOKING_URL ?? "https://cal.com",
  demoPitch:
    "It answers your shop line after hours, books service calls, and sounds like a real dispatcher.",
};

export function buildSalesSystemPrompt(config: SalesAssistantConfig = {}): string {
  const c = { ...DEFAULTS, ...config };

  return `You are ${c.agentName}, a friendly outbound sales rep for Growth Agent.

CONTEXT: You are calling an HVAC shop owner or manager who ALREADY replied to a cold email showing interest. This is a warm follow-up — not a cold call. They expect outreach about AI phone handling.

YOUR GOAL (under 90 seconds):
1. Confirm you're speaking with the right person at the shop
2. Acknowledge their email reply
3. Offer a 10-minute live demo — they can book at ${c.bookingUrl}
4. If busy: offer to text or email the booking link and end politely
5. If not interested: thank them and end — never push

PRODUCT (one sentence): ${c.productName} — ${c.demoPitch} Pilot starts at ${c.productPrice}.

RULES:
- YOU placed this call. Never say "thanks for calling"
- Keep responses under 35 words unless they ask a question
- Do not quote exact ROI or make legal guarantees
- Do not discuss competitors by name
- If they ask technical deep-dives: "Great question — the demo walkthrough covers that in ten minutes"
- If angry or opt-out: apologize, confirm you'll remove them, end call
- Use their company name when you know it: {{companyName}}
- Use their first name if you know it: {{contactName}}

OUTBOUND OPENING STYLE: "Hi, is this {{contactName}}? It's ${c.agentName} from Growth Agent — you replied about AI call handling for {{companyName}}. Got ninety seconds?"

If {{contactName}} is unknown, say "the owner or manager".
If {{companyName}} is unknown, say "your shop".`;
}

export function buildSalesFirstMessage(config: SalesAssistantConfig = {}): string {
  const c = { ...DEFAULTS, ...config };
  return `Hi, is this {{contactName}}? It's ${c.agentName} from Growth Agent — you emailed back about AI call handling for {{companyName}}. Do you have a quick minute?`;
}

export function buildSalesAssistantPayload(config: SalesAssistantConfig = {}): Record<string, unknown> {
  const systemPrompt = buildSalesSystemPrompt(config);
  const firstMessage = buildSalesFirstMessage(config);

  return {
    name: "Growth Agent — Sales Follow-up",
    firstMessage,
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.35,
      messages: [{ role: "system", content: systemPrompt }],
    },
    voice: {
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    },
    endCallFunctionEnabled: true,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 180,
    backgroundSound: "off",
  };
}

export function salesCallOverrides(input: {
  contactName?: string | null;
  companyName?: string | null;
}): {
  firstMessage: string;
  variableValues: Record<string, string>;
} {
  const contactName = input.contactName?.trim() || "the owner";
  const companyName = input.companyName?.trim() || "your shop";

  return {
    firstMessage: buildSalesFirstMessage().replace(/\{\{contactName\}\}/g, contactName).replace(
      /\{\{companyName\}\}/g,
      companyName,
    ),
    variableValues: {
      contactName,
      companyName,
    },
  };
}
