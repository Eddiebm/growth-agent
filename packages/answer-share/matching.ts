/** Brand / competitor / citation matching helpers */

export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(llc|inc|co|company|heating|cooling|hvac|air|plumbing)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(candidate: string, target: string, aliases: string[] = []): boolean {
  const c = normalizeName(candidate);
  if (!c) return false;
  const targets = [target, ...aliases].map(normalizeName).filter(Boolean);
  for (const t of targets) {
    if (c === t) return true;
    if (c.includes(t) || t.includes(c)) return true;
  }
  return false;
}

export function extractMentionedNames(text: string, catalog: string[]): string[] {
  const found: string[] = [];
  for (const name of catalog) {
    if (!name.trim()) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(text)) found.push(name);
  }
  return found;
}

export function looksRecommended(text: string, businessName: string, aliases: string[] = []): boolean {
  if (!namesMatch(businessName, businessName, aliases) && !extractMentionedNames(text, [businessName, ...aliases]).length) {
    // still try mention first
  }
  const mentioned = extractMentionedNames(text, [businessName, ...aliases]);
  if (mentioned.length === 0) return false;

  const recommendPatterns = [
    /\b(recommend|top pick|best (choice|option)|go with|call|hire|choose)\b/i,
    /\b(standout|leading|preferred)\b/i,
  ];
  const lower = text.toLowerCase();
  const idx = lower.search(new RegExp(mentioned[0]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  if (idx < 0) return false;
  const window = text.slice(Math.max(0, idx - 120), idx + mentioned[0]!.length + 120);
  return recommendPatterns.some((p) => p.test(window));
}

export function normalizeDomain(input: string): string {
  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const host = new URL(withProto).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return input
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]!
      .trim();
  }
}

export function domainsFromUrls(urls: string[]): string[] {
  const set = new Set<string>();
  for (const u of urls) {
    const d = normalizeDomain(u);
    if (d) set.add(d);
  }
  return [...set];
}

export function customerCited(
  citedDomains: string[],
  businessDomain: string | null | undefined,
): boolean {
  if (!businessDomain) return false;
  const target = normalizeDomain(businessDomain);
  return citedDomains.some((d) => d === target || d.endsWith(`.${target}`));
}

export function findCustomerPosition(
  mentionedInOrder: string[],
  businessName: string,
  aliases: string[] = [],
): number | null {
  for (let i = 0; i < mentionedInOrder.length; i++) {
    if (namesMatch(mentionedInOrder[i]!, businessName, aliases)) return i + 1;
  }
  return null;
}
