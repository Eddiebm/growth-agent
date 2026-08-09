import { createDemoProvider } from "./demo.js";
import {
  createAnthropicProvider,
  createGoogleSerpProvider,
  createOpenAIProvider,
  createPerplexityProvider,
} from "./live.js";
import type { ProviderAdapter, ProviderId } from "./types.js";

export function getAllAdapters(): ProviderAdapter[] {
  return [
    createDemoProvider(),
    createOpenAIProvider(),
    createAnthropicProvider(),
    createPerplexityProvider(),
    createGoogleSerpProvider(),
  ];
}

export function resolveProvidersForAudit(opts: {
  forceDemo?: boolean;
  preferLive?: boolean;
}): ProviderAdapter[] {
  if (opts.forceDemo || process.env.ANSWER_SHARE_FORCE_DEMO === "true") {
    return [createDemoProvider()];
  }

  const live = getAllAdapters().filter((a) => a.id !== "demo" && a.isConfigured());
  if (live.length === 0 || !opts.preferLive) {
    // Free audit default: demo only unless explicitly live
    if (process.env.ANSWER_SHARE_USE_LIVE === "true" && live.length > 0) {
      return live;
    }
    return [createDemoProvider()];
  }
  return live;
}

export function adapterById(id: ProviderId): ProviderAdapter | undefined {
  return getAllAdapters().find((a) => a.id === id);
}

export function providerConfigStatus(): {
  id: ProviderId;
  name: string;
  configured: boolean;
}[] {
  return getAllAdapters()
    .filter((a) => a.id !== "demo")
    .map((a) => ({ id: a.id, name: a.displayName, configured: a.isConfigured() }));
}
