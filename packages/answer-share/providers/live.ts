import type { NormalizedProviderResult, ProviderAdapter, ProviderRunRequest } from "./types.js";
import { enrichExtraction } from "./demo.js";
import { domainsFromUrls, normalizeDomain } from "../matching.js";

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = 25000,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function unconfigured(
  provider: ProviderAdapter["id"],
  engine: string,
  req: ProviderRunRequest,
  reason: string,
): NormalizedProviderResult {
  return {
    provider,
    engine,
    question: req.question,
    prompt: req.prompt,
    ranAt: new Date().toISOString(),
    requestedLocation: req.location,
    responseText: "",
    mentionedBusinesses: [],
    customerMentioned: false,
    customerRecommended: false,
    customerPosition: null,
    competitorsMentioned: [],
    citations: [],
    citedUrls: [],
    citedDomains: [],
    sentiment: "unknown",
    errorStatus: reason,
    retryCount: 0,
    costUsd: 0,
  };
}

export function createOpenAIProvider(): ProviderAdapter {
  return {
    id: "openai",
    displayName: "OpenAI",
    isConfigured: () => Boolean(process.env.OPENAI_API_KEY || process.env.ANSWER_SHARE_OPENAI_API_KEY),
    async run(req) {
      const key = process.env.ANSWER_SHARE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!key) return unconfigured("openai", "openai", req, "missing_credentials");

      const model = process.env.ANSWER_SHARE_OPENAI_MODEL || "gpt-4o-mini";
      const { ok, status, json } = await fetchJson("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Answer with local business names and URLs when possible." },
            { role: "user", content: req.prompt },
          ],
          temperature: 0.4,
        }),
      });

      if (!ok) {
        const permanent = status === 401 || status === 403 || status === 400;
        return {
          ...unconfigured("openai", model, req, permanent ? `auth_or_validation_${status}` : `http_${status}`),
          rawResponseRedacted: { status },
        };
      }

      const data = json as {
        id?: string;
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      const urls = Array.from(text.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]!);
      const base: NormalizedProviderResult = {
        provider: "openai",
        engine: "chat.completions",
        modelVersion: model,
        question: req.question,
        prompt: req.prompt,
        ranAt: new Date().toISOString(),
        requestedLocation: req.location,
        responseText: text,
        mentionedBusinesses: [],
        customerMentioned: false,
        customerRecommended: false,
        customerPosition: null,
        competitorsMentioned: [],
        citations: urls.map((url) => ({ url, domain: normalizeDomain(url) })),
        citedUrls: urls,
        citedDomains: domainsFromUrls(urls),
        sentiment: "unknown",
        providerRequestId: data.id,
        rawResponseRedacted: { id: data.id, usage: data.usage },
        retryCount: 0,
        costUsd: 0.002,
      };
      return enrichExtraction(base, req);
    },
  };
}

export function createAnthropicProvider(): ProviderAdapter {
  return {
    id: "anthropic",
    displayName: "Anthropic",
    isConfigured: () =>
      Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANSWER_SHARE_ANTHROPIC_API_KEY),
    async run(req) {
      const key = process.env.ANSWER_SHARE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
      if (!key) return unconfigured("anthropic", "anthropic", req, "missing_credentials");
      const model = process.env.ANSWER_SHARE_ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

      const { ok, status, json } = await fetchJson("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: "user", content: req.prompt }],
        }),
      });

      if (!ok) {
        const permanent = status === 401 || status === 403 || status === 400;
        return {
          ...unconfigured("anthropic", model, req, permanent ? `auth_or_validation_${status}` : `http_${status}`),
          rawResponseRedacted: { status },
        };
      }

      const data = json as {
        id?: string;
        content?: { type: string; text?: string }[];
      };
      const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
      const urls = Array.from(text.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]!);
      const base: NormalizedProviderResult = {
        provider: "anthropic",
        engine: "messages",
        modelVersion: model,
        question: req.question,
        prompt: req.prompt,
        ranAt: new Date().toISOString(),
        requestedLocation: req.location,
        responseText: text,
        mentionedBusinesses: [],
        customerMentioned: false,
        customerRecommended: false,
        customerPosition: null,
        competitorsMentioned: [],
        citations: urls.map((url) => ({ url, domain: normalizeDomain(url) })),
        citedUrls: urls,
        citedDomains: domainsFromUrls(urls),
        sentiment: "unknown",
        providerRequestId: data.id,
        rawResponseRedacted: { id: data.id },
        retryCount: 0,
        costUsd: 0.003,
      };
      return enrichExtraction(base, req);
    },
  };
}

export function createPerplexityProvider(): ProviderAdapter {
  return {
    id: "perplexity",
    displayName: "Perplexity",
    isConfigured: () => Boolean(process.env.PERPLEXITY_API_KEY || process.env.ANSWER_SHARE_PERPLEXITY_API_KEY),
    async run(req) {
      const key = process.env.ANSWER_SHARE_PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
      if (!key) return unconfigured("perplexity", "sonar", req, "missing_credentials");
      const model = process.env.ANSWER_SHARE_PERPLEXITY_MODEL || "sonar";

      const { ok, status, json } = await fetchJson("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: req.prompt }],
        }),
      });

      if (!ok) {
        const permanent = status === 401 || status === 403 || status === 400;
        return {
          ...unconfigured("perplexity", model, req, permanent ? `auth_or_validation_${status}` : `http_${status}`),
          rawResponseRedacted: { status },
        };
      }

      const data = json as {
        id?: string;
        choices?: { message?: { content?: string } }[];
        citations?: string[];
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      const urls = data.citations?.length
        ? data.citations
        : Array.from(text.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]!);
      const base: NormalizedProviderResult = {
        provider: "perplexity",
        engine: "sonar",
        modelVersion: model,
        question: req.question,
        prompt: req.prompt,
        ranAt: new Date().toISOString(),
        requestedLocation: req.location,
        responseText: text,
        mentionedBusinesses: [],
        customerMentioned: false,
        customerRecommended: false,
        customerPosition: null,
        competitorsMentioned: [],
        citations: urls.map((url) => ({ url, domain: normalizeDomain(url) })),
        citedUrls: urls,
        citedDomains: domainsFromUrls(urls),
        sentiment: "unknown",
        providerRequestId: data.id,
        rawResponseRedacted: { id: data.id, citationCount: urls.length },
        retryCount: 0,
        costUsd: 0.005,
      };
      return enrichExtraction(base, req);
    },
  };
}

export function createGoogleSerpProvider(): ProviderAdapter {
  return {
    id: "google_serp",
    displayName: "Google (SERP API)",
    isConfigured: () =>
      Boolean(process.env.SERPAPI_API_KEY || process.env.ANSWER_SHARE_SERPAPI_KEY || process.env.SERPER_API_KEY),
    async run(req) {
      const serpApi = process.env.ANSWER_SHARE_SERPAPI_KEY || process.env.SERPAPI_API_KEY;
      const serper = process.env.SERPER_API_KEY;
      if (!serpApi && !serper) return unconfigured("google_serp", "serp", req, "missing_credentials");

      if (serper && !serpApi) {
        const { ok, status, json } = await fetchJson("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": serper,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: req.question, gl: "us", hl: "en", location: req.location }),
        });
        if (!ok) {
          return {
            ...unconfigured("google_serp", "serper", req, status === 401 ? "auth_or_validation_401" : `http_${status}`),
          };
        }
        const data = json as {
          organic?: { title?: string; link?: string; snippet?: string }[];
          answerBox?: { snippet?: string; title?: string };
        };
        const organic = data.organic ?? [];
        const lines = organic.slice(0, 8).map((o, i) => `${i + 1}. ${o.title ?? ""} — ${o.snippet ?? ""} (${o.link ?? ""})`);
        const text = [data.answerBox?.snippet, ...lines].filter(Boolean).join("\n");
        const urls = organic.map((o) => o.link).filter(Boolean) as string[];
        const base: NormalizedProviderResult = {
          provider: "google_serp",
          engine: "serper",
          modelVersion: "google-organic",
          question: req.question,
          prompt: req.prompt,
          ranAt: new Date().toISOString(),
          requestedLocation: req.location,
          responseText: text,
          mentionedBusinesses: [],
          customerMentioned: false,
          customerRecommended: false,
          customerPosition: null,
          competitorsMentioned: [],
          citations: urls.map((url) => ({ url, domain: normalizeDomain(url) })),
          citedUrls: urls,
          citedDomains: domainsFromUrls(urls),
          sentiment: "unknown",
          rawResponseRedacted: { organicCount: organic.length },
          retryCount: 0,
          costUsd: 0.001,
        };
        return enrichExtraction(base, req);
      }

      const params = new URLSearchParams({
        engine: "google",
        q: req.question,
        api_key: serpApi!,
        location: req.location,
      });
      const { ok, status, json } = await fetchJson(`https://serpapi.com/search.json?${params}`, {
        method: "GET",
      });
      if (!ok) {
        return {
          ...unconfigured("google_serp", "serpapi", req, status === 401 ? "auth_or_validation_401" : `http_${status}`),
        };
      }
      const data = json as {
        search_metadata?: { id?: string };
        organic_results?: { title?: string; link?: string; snippet?: string }[];
      };
      const organic = data.organic_results ?? [];
      const text = organic
        .slice(0, 8)
        .map((o, i) => `${i + 1}. ${o.title ?? ""} — ${o.snippet ?? ""} (${o.link ?? ""})`)
        .join("\n");
      const urls = organic.map((o) => o.link).filter(Boolean) as string[];
      const base: NormalizedProviderResult = {
        provider: "google_serp",
        engine: "serpapi",
        modelVersion: "google-organic",
        question: req.question,
        prompt: req.prompt,
        ranAt: new Date().toISOString(),
        requestedLocation: req.location,
        responseText: text,
        mentionedBusinesses: [],
        customerMentioned: false,
        customerRecommended: false,
        customerPosition: null,
        competitorsMentioned: [],
        citations: urls.map((url) => ({ url, domain: normalizeDomain(url) })),
        citedUrls: urls,
        citedDomains: domainsFromUrls(urls),
        sentiment: "unknown",
        providerRequestId: data.search_metadata?.id,
        rawResponseRedacted: { organicCount: organic.length },
        retryCount: 0,
        costUsd: 0.01,
      };
      return enrichExtraction(base, req);
    },
  };
}
