import { buildSalesAssistantPayload } from "./sales-assistant.js";

const VAPI_BASE = "https://api.vapi.ai";

function requireVapiKey(): string {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY is required");
  return key;
}

export async function createOrUpdateSalesAssistant(): Promise<{
  action: "created" | "updated";
  assistantId: string;
}> {
  const apiKey = requireVapiKey();
  const payload = buildSalesAssistantPayload();
  const existingId = process.env.VAPI_SALES_ASSISTANT_ID;

  if (existingId) {
    const res = await fetch(`${VAPI_BASE}/assistant/${existingId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vapi sales assistant update failed (${res.status}): ${text}`);
    }

    return { action: "updated", assistantId: existingId };
  }

  const res = await fetch(`${VAPI_BASE}/assistant`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi sales assistant create failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return { action: "created", assistantId: data.id };
}
