/**
 * Vapi voice — post-reply / warm follow-up only (not cold dial).
 * Wire after MOCK_INTEGRATIONS=false and TCPA-safe consent on contact.
 */

const VAPI_BASE = "https://api.vapi.ai";

export const DEFAULT_AREA_CODES = [
  "214",
  "713",
  "602",
  "404",
  "813",
  "702",
  "615",
  "407",
  "704",
  "210",
] as const;

/** Fallback if primary metro has no free inventory */
export const FALLBACK_AREA_CODES = [
  "512",
  "469",
  "480",
  "770",
  "904",
  "317",
  "405",
  "816",
  "629",
  "321",
] as const;

export interface VapiPhoneNumber {
  id: string;
  number?: string;
  areaCode?: string;
}

export interface CreateOutboundCallInput {
  assistantId: string;
  phoneNumberId: string;
  customerNumber: string; // E.164 e.g. +12145551234
  metadata?: Record<string, string>;
  assistantOverrides?: {
    firstMessage?: string;
    variableValues?: Record<string, string>;
  };
}

function requireVapiKey(): string {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY is required");
  return key;
}

export async function createFreePhoneNumber(opts: {
  areaCode: string;
  assistantId?: string;
  name?: string;
}): Promise<VapiPhoneNumber> {
  const apiKey = requireVapiKey();

  const res = await fetch(`${VAPI_BASE}/phone-number`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "vapi",
      numberDesiredAreaCode: opts.areaCode,
      ...(opts.assistantId ? { assistantId: opts.assistantId } : {}),
      ...(opts.name ? { name: opts.name } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi phone-number create failed (${res.status}) area ${opts.areaCode}: ${text}`);
  }

  const data = (await res.json()) as { id: string; number?: string };
  return { id: data.id, number: data.number, areaCode: opts.areaCode };
}

export async function listPhoneNumbers(): Promise<VapiPhoneNumber[]> {
  const apiKey = requireVapiKey();
  const res = await fetch(`${VAPI_BASE}/phone-number`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Vapi list phone numbers failed (${res.status})`);
  }
  const data = (await res.json()) as Array<{ id: string; number?: string }>;
  return data.map((row) => ({ id: row.id, number: row.number }));
}

export async function createOutboundCall(input: CreateOutboundCallInput): Promise<string> {
  const apiKey = requireVapiKey();

  const res = await fetch(`${VAPI_BASE}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId: input.assistantId,
      phoneNumberId: input.phoneNumberId,
      customer: { number: input.customerNumber },
      metadata: input.metadata,
      ...(input.assistantOverrides ? { assistantOverrides: input.assistantOverrides } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi outbound call failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}
