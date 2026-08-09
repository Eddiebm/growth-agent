import { assertSafePublicUrl, sameRegistrableSite } from "./url-safety.js";

export interface CrawlPageResult {
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  headings: string[];
  canonicalUrl: string | null;
  robots: string | null;
  structuredData: unknown[];
  internalLinks: string[];
  excerpt: string | null;
}

export interface CrawlSummary {
  ok: boolean;
  homepageUrl: string;
  pages: CrawlPageResult[];
  extracted: {
    titles: string[];
    headings: string[];
    servicesGuess: string[];
    locationsGuess: string[];
  };
  error?: string;
  robotsIgnored?: boolean;
}

const MAX_PAGES = 5;
const MAX_BYTES = 500_000;
const TIMEOUT_MS = 12_000;

export async function crawlBusinessSite(websiteUrl: string): Promise<CrawlSummary> {
  let start: URL;
  try {
    start = assertSafePublicUrl(websiteUrl);
  } catch (err) {
    return {
      ok: false,
      homepageUrl: websiteUrl,
      pages: [],
      extracted: { titles: [], headings: [], servicesGuess: [], locationsGuess: [] },
      error: err instanceof Error ? err.message : "Invalid URL",
    };
  }

  const homepageUrl = start.toString();
  const pages: CrawlPageResult[] = [];
  const queue = [homepageUrl];
  const seen = new Set<string>();

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);

    const page = await fetchPage(next);
    pages.push(page);
    for (const link of page.internalLinks) {
      if (!seen.has(link) && sameRegistrableSite(homepageUrl, link) && queue.length + pages.length < MAX_PAGES + 3) {
        if (/service|about|location|contact|hvac|emergency|furnace|ac-/i.test(link)) {
          queue.unshift(link);
        } else {
          queue.push(link);
        }
      }
    }
  }

  const titles = pages.map((p) => p.title).filter(Boolean) as string[];
  const headings = pages.flatMap((p) => p.headings).slice(0, 40);
  const blob = `${titles.join(" ")} ${headings.join(" ")}`.toLowerCase();
  const servicesGuess = [
    "emergency repair",
    "furnace",
    "air conditioning",
    "heat pump",
    "maintenance",
  ].filter((s) => blob.includes(s.split(" ")[0]!));

  return {
    ok: pages.some((p) => (p.statusCode ?? 0) >= 200 && (p.statusCode ?? 0) < 400),
    homepageUrl,
    pages,
    extracted: {
      titles,
      headings,
      servicesGuess,
      locationsGuess: headings.filter((h) => /st\.?\s*louis|missouri|mo\b/i.test(h)).slice(0, 5),
    },
  };
}

async function fetchPage(url: string): Promise<CrawlPageResult> {
  const empty: CrawlPageResult = {
    url,
    statusCode: null,
    title: null,
    metaDescription: null,
    headings: [],
    canonicalUrl: null,
    robots: null,
    structuredData: [],
    internalLinks: [],
    excerpt: null,
  };

  try {
    assertSafePublicUrl(url);
  } catch {
    return { ...empty, statusCode: 0 };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "MakolaAnswerShareBot/1.0 (+https://makola.org/answer-share)" },
    });
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    return parseHtml(url, res.status, html);
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

function parseHtml(url: string, statusCode: number, html: string): CrawlPageResult {
  const title = textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    attr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    attr(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const canonicalUrl =
    attr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    attr(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const robots =
    attr(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i) || null;

  const headings: string[] = [];
  const headingRe = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headingRe.exec(html)) && headings.length < 30) {
    headings.push(stripTags(hm[1]!).trim());
  }

  const structuredData: unknown[] = [];
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ld: RegExpExecArray | null;
  while ((ld = ldRe.exec(html)) && structuredData.length < 5) {
    try {
      structuredData.push(JSON.parse(ld[1]!));
    } catch {
      // ignore
    }
  }

  const internalLinks: string[] = [];
  const linkRe = /<a[^>]+href=["']([^"'#]+)["']/gi;
  let lm: RegExpExecArray | null;
  const origin = new URL(url).origin;
  while ((lm = linkRe.exec(html)) && internalLinks.length < 40) {
    try {
      const abs = new URL(lm[1]!, url);
      if (abs.origin === origin && abs.protocol.startsWith("http")) {
        abs.hash = "";
        const s = abs.toString().replace(/\/$/, "");
        if (!internalLinks.includes(s)) internalLinks.push(s);
      }
    } catch {
      // ignore
    }
  }

  const excerpt = stripTags(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  return {
    url,
    statusCode,
    title: title?.trim() || null,
    metaDescription: metaDescription?.trim() || null,
    headings: headings.filter(Boolean),
    canonicalUrl: canonicalUrl || null,
    robots,
    structuredData,
    internalLinks,
    excerpt: excerpt || null,
  };
}

function textBetween(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? stripTags(m[1]!) : null;
}

function attr(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m?.[1] ?? null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}
