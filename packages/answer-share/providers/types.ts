export type ProviderId = "demo" | "openai" | "anthropic" | "perplexity" | "google_serp";

export interface ProviderRunRequest {
  question: string;
  prompt: string;
  location: string;
  businessName: string;
  aliases: string[];
  competitors: { name: string; aliases?: string[] }[];
  businessDomain?: string | null;
  runIndex: number;
}

export interface NormalizedCitation {
  url: string;
  domain: string;
  title?: string;
}

export interface NormalizedProviderResult {
  provider: ProviderId;
  engine: string;
  modelVersion?: string;
  question: string;
  prompt: string;
  ranAt: string;
  requestedLocation: string;
  responseText: string;
  mentionedBusinesses: string[];
  customerMentioned: boolean;
  customerRecommended: boolean;
  customerPosition: number | null;
  competitorsMentioned: string[];
  citations: NormalizedCitation[];
  citedUrls: string[];
  citedDomains: string[];
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  providerRequestId?: string;
  rawResponseRedacted?: Record<string, unknown>;
  errorStatus?: string;
  retryCount: number;
  costUsd?: number;
}

export interface ProviderAdapter {
  id: ProviderId;
  displayName: string;
  isConfigured(): boolean;
  run(req: ProviderRunRequest): Promise<NormalizedProviderResult>;
}

export function buildPrompt(question: string, location: string): string {
  return [
    `You are answering a local-service purchase-intent question for a homeowner.`,
    `Location context: ${location}.`,
    `Question: ${question}`,
    `Name specific local businesses when you can. Include any sources or websites you rely on.`,
    `Be practical and concise.`,
  ].join("\n");
}
