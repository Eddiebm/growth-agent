import {
  customerCited,
  domainsFromUrls,
  extractMentionedNames,
  findCustomerPosition,
  looksRecommended,
  normalizeDomain,
} from "../matching.js";
import type { NormalizedProviderResult, ProviderAdapter, ProviderRunRequest } from "./types.js";

/** Deterministic demo provider — never presented as live. */
export function createDemoProvider(): ProviderAdapter {
  return {
    id: "demo",
    displayName: "Demo (seeded)",
    isConfigured: () => true,
    async run(req: ProviderRunRequest): Promise<NormalizedProviderResult> {
      const competitors = req.competitors.map((c) => c.name);
      const catalog = [req.businessName, ...req.aliases, ...competitors];
      const seed = hash(`${req.question}|${req.runIndex}|${req.businessName}`);
      const includeCustomer = seed % 3 !== 0;
      const topCompetitor = competitors[seed % Math.max(competitors.length, 1)] ?? "Gateway Heating & Cooling";

      const mentioned = includeCustomer
        ? [req.businessName, topCompetitor].filter(Boolean)
        : [topCompetitor, competitors[(seed + 1) % Math.max(competitors.length, 1)] ?? topCompetitor];

      const responseText = includeCustomer
        ? `For "${req.question}" in ${req.location}, homeowners often consider ${req.businessName} and ${topCompetitor}. ` +
          `Many locals recommend ${seed % 2 === 0 ? req.businessName : topCompetitor} for fast response. ` +
          `See https://${normalizeDomain(req.businessDomain ?? "example-hvac-stl.com")}/emergency and https://example.com/${slug(topCompetitor)}.`
        : `For "${req.question}" near ${req.location}, ${topCompetitor} appears frequently in local guides. ` +
          `${competitors.filter((c) => c !== topCompetitor).slice(0, 2).join(" and ") || "Other shops"} are also mentioned. ` +
          `Source: https://example.com/${slug(topCompetitor)}/emergency-hvac.`;

      const urls = Array.from(responseText.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]!);
      const citedDomains = domainsFromUrls(urls);
      const mentionedBusinesses = extractMentionedNames(responseText, catalog);
      const customerMentioned = mentionedBusinesses.some((n) =>
        n.toLowerCase().includes(req.businessName.split(" ")[0]!.toLowerCase()),
      ) || includeCustomer;
      const customerRecommended =
        customerMentioned && looksRecommended(responseText, req.businessName, req.aliases);
      const customerPosition = findCustomerPosition(mentioned, req.businessName, req.aliases);

      return {
        provider: "demo",
        engine: "demo-seed",
        modelVersion: "demo-1",
        question: req.question,
        prompt: req.prompt,
        ranAt: new Date().toISOString(),
        requestedLocation: req.location,
        responseText,
        mentionedBusinesses: mentionedBusinesses.length ? mentionedBusinesses : mentioned,
        customerMentioned,
        customerRecommended: customerRecommended || (includeCustomer && seed % 2 === 0),
        customerPosition,
        competitorsMentioned: competitors.filter((c) =>
          responseText.toLowerCase().includes(c.toLowerCase().slice(0, 8)),
        ),
        citations: urls.map((url) => ({ url, domain: normalizeDomain(url) })),
        citedUrls: urls,
        citedDomains,
        sentiment: customerMentioned ? "positive" : "neutral",
        providerRequestId: `demo_${seed}`,
        rawResponseRedacted: { demo: true, seed },
        retryCount: 0,
        costUsd: 0,
      };
    },
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function enrichExtraction(
  result: NormalizedProviderResult,
  req: ProviderRunRequest,
): NormalizedProviderResult {
  const catalog = [req.businessName, ...req.aliases, ...req.competitors.map((c) => c.name)];
  const mentioned = extractMentionedNames(result.responseText, catalog);
  const customerMentioned =
    result.customerMentioned ||
    mentioned.some((m) => m.toLowerCase() === req.businessName.toLowerCase()) ||
    req.aliases.some((a) => mentioned.some((m) => m.toLowerCase() === a.toLowerCase()));
  const citedDomains =
    result.citedDomains.length > 0 ? result.citedDomains : domainsFromUrls(result.citedUrls);
  const cited = customerCited(citedDomains, req.businessDomain);
  return {
    ...result,
    mentionedBusinesses: mentioned.length ? mentioned : result.mentionedBusinesses,
    customerMentioned: customerMentioned || cited,
    customerRecommended:
      result.customerRecommended ||
      looksRecommended(result.responseText, req.businessName, req.aliases),
    citedDomains,
  };
}
