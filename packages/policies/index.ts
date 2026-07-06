import type { PolicyCheckInput, PolicyCheckOutput } from "../schemas/index.js";

const DAILY_SEND_CAP = 10;
const DAILY_SPEND_CAP_USD = 5;

export interface PolicyContext {
  emailsSentToday: number;
  spendTodayUsd: number;
  isSuppressed: boolean;
  isUnsubscribed: boolean;
  isDoNotContact: boolean;
  rateCardIds: Set<string>;
  requiresApprovalForHighValue: boolean;
}

export function checkPolicy(
  input: PolicyCheckInput,
  ctx: PolicyContext,
): PolicyCheckOutput {
  if (ctx.isSuppressed || ctx.isUnsubscribed || ctx.isDoNotContact) {
    return {
      decision: "deny",
      reason: "Contact is suppressed, unsubscribed, or marked do-not-contact",
    };
  }

  switch (input.action) {
    case "send_email":
    case "send_sequence":
      if (ctx.emailsSentToday >= DAILY_SEND_CAP) {
        return {
          decision: "deny",
          reason: `Daily send cap reached (${DAILY_SEND_CAP})`,
        };
      }
      if (ctx.spendTodayUsd >= DAILY_SPEND_CAP_USD) {
        return {
          decision: "deny",
          reason: `Daily spend cap reached ($${DAILY_SPEND_CAP_USD})`,
        };
      }
      return { decision: "allow", reason: "Within send and spend limits" };

    case "quote_price":
      if (input.rateCardId && ctx.rateCardIds.has(input.rateCardId)) {
        return { decision: "allow", reason: "Price matches rate card" };
      }
      return {
        decision: "escalate",
        reason: "Custom or unknown pricing requires human approval",
      };

    case "send_proposal":
      if (input.customPriceCents !== undefined) {
        return {
          decision: "escalate",
          reason: "Custom proposal pricing requires approval",
        };
      }
      return { decision: "allow", reason: "Standard proposal from rate card" };

    case "sign_contract":
      return {
        decision: "escalate",
        reason: "Contracts always require human approval",
      };

    case "publish_content":
      return { decision: "allow", reason: "Content publish allowed within playbook" };

    case "enroll_campaign":
      return { decision: "allow", reason: "Campaign enrollment allowed" };

    default: {
      const _exhaustive: never = input.action;
      return _exhaustive;
    }
  }
}
