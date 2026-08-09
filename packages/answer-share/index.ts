export {
  SCORE_WEIGHTS,
  calculateVisibilityScore,
  calculateRunConfidence,
  agreementRate,
  positionToScore,
  clamp01,
  type VisibilityInputs,
  type VisibilityMetrics,
} from "./metrics.js";

export {
  normalizeName,
  namesMatch,
  extractMentionedNames,
  looksRecommended,
  normalizeDomain,
  domainsFromUrls,
  customerCited,
  findCustomerPosition,
} from "./matching.js";

export {
  normalizeWebsiteUrl,
  assertSafePublicUrl,
  isPrivateIpv4,
  sameRegistrableSite,
} from "./url-safety.js";

export {
  generatePurchaseIntentQuestions,
  suggestStLouisHvacCompetitors,
  type QuestionSeedInput,
  type GeneratedQuestion,
} from "./questions.js";

export { crawlBusinessSite, type CrawlSummary, type CrawlPageResult } from "./crawler.js";

export {
  generateActions,
  recommendationHasEvidence,
  type GeneratedAction,
  type ActionGenInput,
} from "./recommendations.js";

export {
  createBusinessFromOnboarding,
  startAudit,
  runAudit,
  trackEvent,
  newAccessToken,
  hashShareToken,
  DEMO_ORG_ID,
  DEMO_BUSINESS_ID,
  DEMO_AUDIT_ID,
  DEMO_REPORT_ID,
  type OnboardingInput,
} from "./audit-runner.js";

export {
  resolveProvidersForAudit,
  providerConfigStatus,
  getAllAdapters,
} from "./providers/registry.js";

export { buildPrompt, type ProviderId, type NormalizedProviderResult } from "./providers/types.js";

export {
  ANSWER_SHARE_PLAN,
  createStripeCheckoutSession,
  verifyStripeWebhook,
} from "./stripe.js";
