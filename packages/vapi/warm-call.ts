import { createOutboundCall } from "./index.js";
import { pickDemoLine, toE164, type DemoLine } from "./demo-lines.js";
import { salesCallOverrides } from "./sales-assistant.js";

export interface WarmFollowUpInput {
  contactId: string;
  campaignId?: string | null;
  phone: string;
  contactName?: string | null;
  companyName?: string | null;
  state?: string | null;
  searchCity?: string | null;
  summary?: string;
}

export interface WarmFollowUpResult {
  placed: boolean;
  callId?: string;
  reason?: string;
  demoLine?: DemoLine;
}

function isMockMode(): boolean {
  return process.env.MOCK_INTEGRATIONS === "true" || !process.env.VAPI_API_KEY;
}

function salesAssistantId(): string | undefined {
  return process.env.VAPI_SALES_ASSISTANT_ID ?? process.env.VAPI_ASSISTANT_ID;
}

export async function warmFollowUpCall(input: WarmFollowUpInput): Promise<WarmFollowUpResult> {
  const customerNumber = toE164(input.phone);
  if (!customerNumber) {
    return { placed: false, reason: "invalid_phone" };
  }

  const assistantId = salesAssistantId();
  if (!assistantId && !isMockMode()) {
    return { placed: false, reason: "missing_sales_assistant" };
  }

  const demoLine = await pickDemoLine({
    state: input.state,
    searchCity: input.searchCity,
  });

  if (!demoLine.phoneNumberId && !isMockMode()) {
    return { placed: false, reason: "missing_phone_number_id" };
  }

  const overrides = salesCallOverrides({
    contactName: input.contactName,
    companyName: input.companyName,
  });

  if (isMockMode()) {
    console.log(
      `[mock-vapi] Sales warm call → ${customerNumber} from ${demoLine.number}`,
    );
    console.log(`[mock-vapi] Opening: ${overrides.firstMessage}`);
    return { placed: true, callId: `mock_call_${Date.now()}`, demoLine };
  }

  const callId = await createOutboundCall({
    assistantId: assistantId!,
    phoneNumberId: demoLine.phoneNumberId,
    customerNumber,
    assistantOverrides: overrides,
    metadata: {
      contactId: input.contactId,
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      intent: "warm_sales_follow_up",
      ...(input.companyName ? { companyName: input.companyName } : {}),
    },
  });

  return { placed: true, callId, demoLine };
}
