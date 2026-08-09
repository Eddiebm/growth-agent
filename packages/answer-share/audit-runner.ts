import { randomBytes, createHash } from "node:crypto";
import type { JSONValue } from "postgres";
import type { Db } from "../../apps/api/src/jobs/db.js";
import { crawlBusinessSite } from "./crawler.js";
import {
  agreementRate,
  calculateRunConfidence,
  calculateVisibilityScore,
  positionToScore,
} from "./metrics.js";
import { generateActions } from "./recommendations.js";
import { generatePurchaseIntentQuestions, suggestStLouisHvacCompetitors } from "./questions.js";
import { buildPrompt } from "./providers/types.js";
import { resolveProvidersForAudit } from "./providers/registry.js";
import { assertSafePublicUrl, normalizeWebsiteUrl } from "./url-safety.js";
import { normalizeDomain } from "./matching.js";

export const DEMO_ORG_ID = "a1111111-1111-4111-8111-111111111111";
export const DEMO_BUSINESS_ID = "a2222222-2222-4222-8222-222222222222";
export const DEMO_AUDIT_ID = "a3333333-3333-4333-8333-333333333333";
export const DEMO_REPORT_ID = "a4444444-4444-4444-8444-444444444444";

export function newAccessToken(): string {
  return randomBytes(24).toString("hex");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function trackEvent(
  db: Db,
  input: {
    organizationId?: string | null;
    businessId?: string | null;
    eventName: string;
    properties?: Record<string, unknown>;
  },
): Promise<void> {
  return db.sql`
    INSERT INTO as_audit_events (organization_id, business_id, event_name, properties)
    VALUES (
      ${input.organizationId ?? null},
      ${input.businessId ?? null},
      ${input.eventName},
      ${db.sql.json((input.properties ?? {}) as JSONValue)}
    )
  `.then(() => undefined);
}

export interface OnboardingInput {
  businessName: string;
  websiteUrl: string;
  aliases?: string[];
  serviceCategory: string;
  city: string;
  state: string;
  serviceAreas?: string[];
  phone?: string;
  conversionUrl?: string;
  gbpUrl?: string;
  competitors?: { name: string; websiteUrl?: string }[];
  email?: string;
  forceDemo?: boolean;
}

export async function createBusinessFromOnboarding(db: Db, input: OnboardingInput) {
  const websiteNormalized = normalizeWebsiteUrl(input.websiteUrl);
  assertSafePublicUrl(websiteNormalized);

  const accessToken = newAccessToken();
  const isDemo = Boolean(input.forceDemo) || process.env.ANSWER_SHARE_FORCE_DEMO === "true";

  const [org] = await db.sql<{ id: string; access_token: string }[]>`
    INSERT INTO as_organizations (name, access_token, is_demo, plan_key)
    VALUES (${input.businessName}, ${accessToken}, ${isDemo}, 'free_audit')
    RETURNING id, access_token
  `;

  if (input.email) {
    await db.sql`
      INSERT INTO as_users (organization_id, email, name, role)
      VALUES (${org.id}, ${input.email}, ${input.businessName}, 'owner')
    `;
  }

  const [business] = await db.sql<{ id: string }[]>`
    INSERT INTO as_businesses (
      organization_id, name, website_url, website_normalized, service_category,
      phone, conversion_url, gbp_url, is_demo
    ) VALUES (
      ${org.id}, ${input.businessName}, ${websiteNormalized}, ${websiteNormalized},
      ${input.serviceCategory}, ${input.phone ?? null}, ${input.conversionUrl ?? null},
      ${input.gbpUrl ?? null}, ${isDemo}
    )
    RETURNING id
  `;

  await db.sql`
    INSERT INTO as_business_locations (business_id, city, state, service_areas, is_primary)
    VALUES (
      ${business.id},
      ${input.city},
      ${input.state},
      ${input.serviceAreas ?? []},
      true
    )
  `;

  for (const alias of input.aliases ?? []) {
    if (!alias.trim()) continue;
    await db.sql`
      INSERT INTO as_business_aliases (business_id, alias)
      VALUES (${business.id}, ${alias.trim()})
      ON CONFLICT DO NOTHING
    `;
  }

  const crawl = await crawlBusinessSite(websiteNormalized);
  await db.sql`
    UPDATE as_businesses
    SET crawl_summary = ${db.sql.json(crawl as unknown as JSONValue)}, updated_at = now()
    WHERE id = ${business.id}
  `;

  for (const page of crawl.pages) {
    await db.sql`
      INSERT INTO as_crawl_pages (
        business_id, url, status_code, title, meta_description, headings,
        canonical_url, robots, structured_data, internal_links, excerpt
      ) VALUES (
        ${business.id}, ${page.url}, ${page.statusCode}, ${page.title}, ${page.metaDescription},
        ${db.sql.json(page.headings as unknown as JSONValue)}, ${page.canonicalUrl}, ${page.robots},
        ${db.sql.json(page.structuredData as unknown as JSONValue)}, ${page.internalLinks},
        ${page.excerpt}
      )
      ON CONFLICT (business_id, url) DO UPDATE SET
        status_code = EXCLUDED.status_code,
        title = EXCLUDED.title,
        excerpt = EXCLUDED.excerpt
    `;
  }

  const questions = generatePurchaseIntentQuestions({
    businessName: input.businessName,
    serviceCategory: input.serviceCategory,
    city: input.city,
    state: input.state,
    services: crawl.extracted.servicesGuess,
  });

  const questionIds: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const [row] = await db.sql<{ id: string }[]>`
      INSERT INTO as_buyer_questions (
        business_id, question_text, intent_category, location_label, status, sort_order
      ) VALUES (
        ${business.id}, ${q.questionText}, ${q.intentCategory}, ${q.locationLabel}, 'draft', ${i}
      )
      RETURNING id
    `;
    questionIds.push(row.id);
  }

  const suggested = suggestStLouisHvacCompetitors();
  const known = input.competitors ?? [];
  const competitorRows = [
    ...known.map((c) => ({
      name: c.name,
      websiteUrl: c.websiteUrl ?? null,
      domain: c.websiteUrl ? normalizeDomain(c.websiteUrl) : null,
      approved: true,
      suggested: false,
    })),
    ...suggested.slice(0, Math.max(0, 5 - known.length)).map((c) => ({
      name: c.name,
      websiteUrl: c.websiteUrl,
      domain: c.domain,
      approved: false,
      suggested: true,
    })),
  ];

  for (const c of competitorRows.slice(0, 5)) {
    await db.sql`
      INSERT INTO as_competitors (business_id, name, website_url, domain, approved, suggested)
      VALUES (${business.id}, ${c.name}, ${c.websiteUrl}, ${c.domain}, ${c.approved}, ${c.suggested})
    `;
  }

  await trackEvent(db, {
    organizationId: org.id,
    businessId: business.id,
    eventName: "business_setup_completed",
    properties: { isDemo, questionCount: questionIds.length },
  });

  return {
    organizationId: org.id,
    accessToken: org.access_token,
    businessId: business.id,
    questionIds,
    crawl,
    isDemo,
  };
}

export async function runAudit(db: Db, auditId: string): Promise<void> {
  const [audit] = await db.sql<
    {
      id: string;
      organization_id: string;
      business_id: string;
      kind: string;
      is_demo: boolean;
      runs_per_provider: number;
      status: string;
    }[]
  >`SELECT * FROM as_audits WHERE id = ${auditId}`;
  if (!audit) throw new Error("Audit not found");
  if (audit.status === "completed") return; // idempotent

  await db.sql`
    UPDATE as_audits SET status = 'running', started_at = COALESCE(started_at, now()),
      progress = ${db.sql.json({ phase: "providers", completed: 0, total: 0 } as JSONValue)}
    WHERE id = ${auditId}
  `;

  const [business] = await db.sql<
    {
      id: string;
      name: string;
      website_normalized: string | null;
      gbp_url: string | null;
      crawl_summary: { ok?: boolean };
      is_demo: boolean;
    }[]
  >`SELECT * FROM as_businesses WHERE id = ${audit.business_id}`;

  const aliases = (
    await db.sql<{ alias: string }[]>`
      SELECT alias FROM as_business_aliases WHERE business_id = ${audit.business_id}
    `
  ).map((r) => r.alias);

  const [location] = await db.sql<{ city: string; state: string }[]>`
    SELECT city, state FROM as_business_locations
    WHERE business_id = ${audit.business_id} AND is_primary = true
    LIMIT 1
  `;
  const locationLabel = location ? `${location.city}, ${location.state}` : "St. Louis, MO";

  const competitors = await db.sql<{ id: string; name: string; domain: string | null }[]>`
    SELECT id, name, domain FROM as_competitors
    WHERE business_id = ${audit.business_id} AND approved = true
  `;

  const questions = await db.sql<
    { id: string; question_text: string; location_label: string | null }[]
  >`
    SELECT id, question_text, location_label FROM as_buyer_questions
    WHERE business_id = ${audit.business_id} AND status = 'approved'
    ORDER BY sort_order ASC
  `;

  const providers = resolveProvidersForAudit({
    forceDemo: audit.is_demo || audit.kind === "demo",
    preferLive: !audit.is_demo && audit.kind !== "demo",
  });

  const runsPer = Math.max(1, Math.min(3, audit.runs_per_provider));
  const total = questions.length * providers.length * runsPer;
  let completed = 0;
  let failures = 0;

  await db.sql`
    UPDATE as_audits SET providers = ${providers.map((p) => p.id)},
      progress = ${db.sql.json({ phase: "providers", completed: 0, total } as JSONValue)}
    WHERE id = ${auditId}
  `;

  for (const q of questions) {
    for (const provider of providers) {
      for (let runIndex = 1; runIndex <= runsPer; runIndex++) {
        const prompt = buildPrompt(q.question_text, q.location_label ?? locationLabel);
        let result = await provider.run({
          question: q.question_text,
          prompt,
          location: q.location_label ?? locationLabel,
          businessName: business.name,
          aliases,
          competitors: competitors.map((c) => ({ name: c.name })),
          businessDomain: business.website_normalized
            ? normalizeDomain(business.website_normalized)
            : null,
          runIndex,
        });

        // one retry on transient errors
        if (result.errorStatus && !result.errorStatus.startsWith("auth_or_validation") && !result.errorStatus.includes("missing")) {
          result = {
            ...(await provider.run({
              question: q.question_text,
              prompt,
              location: q.location_label ?? locationLabel,
              businessName: business.name,
              aliases,
              competitors: competitors.map((c) => ({ name: c.name })),
              businessDomain: business.website_normalized
                ? normalizeDomain(business.website_normalized)
                : null,
              runIndex,
            })),
            retryCount: 1,
          };
        }

        if (result.errorStatus) failures += 1;

        await db.sql`
          INSERT INTO as_provider_runs (
            audit_id, business_id, question_id, provider, engine, model_version, run_index,
            prompt, requested_location, response_text, customer_mentioned, customer_recommended,
            customer_position, mentioned_businesses, competitors_mentioned, citations,
            cited_urls, cited_domains, sentiment, provider_request_id, raw_response_redacted,
            error_status, retry_count, cost_usd, ran_at
          ) VALUES (
            ${auditId}, ${business.id}, ${q.id}, ${result.provider}, ${result.engine},
            ${result.modelVersion ?? null}, ${runIndex}, ${result.prompt}, ${result.requestedLocation},
            ${result.responseText}, ${result.customerMentioned}, ${result.customerRecommended},
            ${result.customerPosition}, ${db.sql.json(result.mentionedBusinesses as unknown as JSONValue)},
            ${db.sql.json(result.competitorsMentioned as unknown as JSONValue)},
            ${db.sql.json(result.citations as unknown as JSONValue)}, ${result.citedUrls},
            ${result.citedDomains}, ${result.sentiment}, ${result.providerRequestId ?? null},
            ${result.rawResponseRedacted ? db.sql.json(result.rawResponseRedacted as JSONValue) : null},
            ${result.errorStatus ?? null}, ${result.retryCount}, ${result.costUsd ?? null},
            ${new Date(result.ranAt)}
          )
          ON CONFLICT (audit_id, question_id, provider, run_index) DO UPDATE SET
            response_text = EXCLUDED.response_text,
            customer_mentioned = EXCLUDED.customer_mentioned,
            customer_recommended = EXCLUDED.customer_recommended,
            error_status = EXCLUDED.error_status,
            retry_count = EXCLUDED.retry_count,
            ran_at = EXCLUDED.ran_at
        `;

        completed += 1;
        await db.sql`
          UPDATE as_audits SET progress = ${db.sql.json({ phase: "providers", completed, total } as JSONValue)}
          WHERE id = ${auditId}
        `;
      }
    }
  }

  const metrics = await computeAuditMetrics(db, auditId, providers.length);
  const lost = await lostQuestionsWithEvidence(db, auditId);
  const actions = generateActions({
    businessName: business.name,
    visibilityScore: metrics.visibilityScore,
    mentionRate: metrics.mentionRate,
    recommendationRate: metrics.recommendationRate,
    citationRate: metrics.citationRate,
    lostQuestions: lost,
    crawlOk: Boolean(business.crawl_summary?.ok),
    hasGbp: Boolean(business.gbp_url),
    topCompetitorDomain: metrics.topCompetitorDomain,
  });

  await db.sql`DELETE FROM as_recommendations WHERE audit_id = ${auditId}`;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]!;
    const retest = new Date();
    retest.setDate(retest.getDate() + a.retestDays);
    await db.sql`
      INSERT INTO as_recommendations (
        audit_id, business_id, title, explanation, category, expected_impact, effort,
        confidence, recommended_target, measurement_plan, retest_at, status,
        questions_affected, competitor_comparison, evidence_ids, sort_order
      ) VALUES (
        ${auditId}, ${business.id}, ${a.title}, ${a.explanation}, ${a.category},
        ${a.expectedImpact}, ${a.effort}, ${a.confidence}, ${a.recommendedTarget},
        ${a.measurementPlan}, ${retest.toISOString().slice(0, 10)}, 'proposed',
        ${a.questionsAffected}, ${a.competitorComparison}, ${a.evidenceIds}, ${i}
      )
    `;
  }

  const shareToken = newAccessToken();
  const shareHash = hashShareToken(shareToken);
  await db.sql`DELETE FROM as_reports WHERE audit_id = ${auditId}`;
  const [report] = await db.sql<{ id: string }[]>`
    INSERT INTO as_reports (
      audit_id, business_id, organization_id, share_token_hash, share_token_hint,
      title, summary_json, is_public
    ) VALUES (
      ${auditId}, ${business.id}, ${audit.organization_id}, ${shareHash}, ${shareToken.slice(0, 6)},
      ${`${business.name} — AnswerShare Visibility Report`},
      ${db.sql.json({ metrics, shareToken } as unknown as JSONValue)},
      true
    )
    RETURNING id
  `;

  const status = failures === total ? "failed" : failures > 0 ? "partial" : "completed";
  await db.sql`
    UPDATE as_audits SET
      status = ${status},
      metrics = ${db.sql.json({ ...metrics, reportId: report.id, shareToken } as unknown as JSONValue)},
      completed_at = now(),
      progress = ${db.sql.json({ phase: "done", completed, total, failures } as JSONValue)},
      error_message = ${failures === total ? "All provider runs failed" : null}
    WHERE id = ${auditId}
  `;

  await trackEvent(db, {
    organizationId: audit.organization_id,
    businessId: business.id,
    eventName: "audit_completed",
    properties: { auditId, status, visibilityScore: metrics.visibilityScore },
  });
}

async function computeAuditMetrics(db: Db, auditId: string, providersExpected: number) {
  const runs = await db.sql<
    {
      id: string;
      question_id: string;
      provider: string;
      customer_mentioned: boolean;
      customer_recommended: boolean;
      customer_position: number | null;
      cited_domains: string[];
      competitors_mentioned: unknown;
      error_status: string | null;
      business_id: string;
    }[]
  >`SELECT * FROM as_provider_runs WHERE audit_id = ${auditId}`;

  const successful = runs.filter((r) => !r.error_status);
  const [biz] = await db.sql<{ website_normalized: string | null }[]>`
    SELECT website_normalized FROM as_businesses
    WHERE id = (SELECT business_id FROM as_audits WHERE id = ${auditId})
  `;
  const bizDomain = biz?.website_normalized ? normalizeDomain(biz.website_normalized) : null;

  const mentionRate =
    successful.length === 0 ? 0 : successful.filter((r) => r.customer_mentioned).length / successful.length;
  const recommendationRate =
    successful.length === 0
      ? 0
      : successful.filter((r) => r.customer_recommended).length / successful.length;
  const citationRate =
    successful.length === 0
      ? 0
      : successful.filter((r) =>
          bizDomain ? r.cited_domains.some((d) => d === bizDomain || d.endsWith(`.${bizDomain}`)) : false,
        ).length / successful.length;

  const positions = successful
    .map((r) => r.customer_position)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const avgPos =
    positions.length === 0 ? null : positions.reduce((a, b) => a + b, 0) / positions.length;

  const competitorCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();
  for (const r of successful) {
    const comps = Array.isArray(r.competitors_mentioned)
      ? (r.competitors_mentioned as string[])
      : [];
    for (const c of comps) competitorCounts.set(c, (competitorCounts.get(c) ?? 0) + 1);
    for (const d of r.cited_domains) {
      if (bizDomain && (d === bizDomain || d.endsWith(`.${bizDomain}`))) continue;
      domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
    }
  }

  const customerMentions = successful.filter((r) => r.customer_mentioned).length;
  const competitorMentions = [...competitorCounts.values()].reduce((a, b) => a + b, 0);
  const voiceDenom = customerMentions + competitorMentions;
  const competitiveShareOfVoice = voiceDenom === 0 ? 0 : customerMentions / voiceDenom;

  const providersCompleted = new Set(successful.map((r) => r.provider)).size;
  const byQuestionMention = new Map<string, boolean[]>();
  for (const r of successful) {
    const arr = byQuestionMention.get(r.question_id) ?? [];
    arr.push(r.customer_mentioned);
    byQuestionMention.set(r.question_id, arr);
  }
  const agreements = [...byQuestionMention.values()].map((arr) => agreementRate(arr));
  const avgAgreement =
    agreements.length === 0 ? 0 : agreements.reduce((a, b) => a + b, 0) / agreements.length;

  const base = calculateVisibilityScore({
    mentionRate,
    recommendationRate,
    citationRate,
    positionScore: positionToScore(avgPos),
    competitiveShareOfVoice,
    providersCompleted,
    providersExpected,
  });

  const runConfidence = calculateRunConfidence({
    completedRuns: successful.length,
    expectedRuns: runs.length || successful.length,
    agreementRate: avgAgreement,
    providersCompleted,
    providersExpected,
  });

  let topCompetitor: string | null = null;
  let topCount = 0;
  for (const [name, count] of competitorCounts) {
    if (count > topCount) {
      topCompetitor = name;
      topCount = count;
    }
  }
  let topCompetitorDomain: string | null = null;
  let topDomCount = 0;
  for (const [d, count] of domainCounts) {
    if (count > topDomCount) {
      topCompetitorDomain = d;
      topDomCount = count;
    }
  }

  const questionStats = await questionWinLoss(db, auditId);

  return {
    ...base,
    averageRecommendationPosition: avgPos,
    runConfidence,
    topCompetitor,
    topCompetitorDomain,
    questionsWon: questionStats.won,
    questionsLost: questionStats.lost,
    successfulRuns: successful.length,
    totalRuns: runs.length,
  };
}

async function questionWinLoss(db: Db, auditId: string) {
  const rows = await db.sql<{ question_id: string; mentioned: boolean }[]>`
    SELECT question_id, BOOL_OR(customer_mentioned) AS mentioned
    FROM as_provider_runs
    WHERE audit_id = ${auditId} AND error_status IS NULL
    GROUP BY question_id
  `;
  return {
    won: rows.filter((r) => r.mentioned).length,
    lost: rows.filter((r) => !r.mentioned).length,
  };
}

async function lostQuestionsWithEvidence(db: Db, auditId: string) {
  const rows = await db.sql<
    {
      question_id: string;
      question_text: string;
      mentioned: boolean;
    }[]
  >`
    SELECT q.id AS question_id, q.question_text,
           COALESCE(BOOL_OR(r.customer_mentioned), false) AS mentioned
    FROM as_buyer_questions q
    JOIN as_provider_runs r ON r.question_id = q.id AND r.audit_id = ${auditId}
    WHERE r.error_status IS NULL
    GROUP BY q.id, q.question_text
  `;

  const lost = [];
  for (const row of rows.filter((r) => !r.mentioned).slice(0, 5)) {
    const evidence = await db.sql<{ id: string; competitors_mentioned: unknown }[]>`
      SELECT id, competitors_mentioned FROM as_provider_runs
      WHERE audit_id = ${auditId} AND question_id = ${row.question_id}
      LIMIT 6
    `;
    const competitorNames = evidence.flatMap((e) =>
      Array.isArray(e.competitors_mentioned) ? (e.competitors_mentioned as string[]) : [],
    );
    lost.push({
      id: row.question_id,
      text: row.question_text,
      topCompetitor: competitorNames[0] ?? "a competitor",
      evidenceIds: evidence.map((e) => e.id),
    });
  }
  return lost;
}

export async function startAudit(
  db: Db,
  input: {
    organizationId: string;
    businessId: string;
    kind?: "free" | "monitoring" | "demo";
    runsPerProvider?: number;
    isDemo?: boolean;
  },
): Promise<string> {
  const kind = input.kind ?? "free";
  const isDemo = input.isDemo ?? kind === "demo";
  const runs = input.runsPerProvider ?? (kind === "free" ? Number(process.env.ANSWER_SHARE_FREE_RUNS ?? 1) : 3);

  const [audit] = await db.sql<{ id: string }[]>`
    INSERT INTO as_audits (
      organization_id, business_id, kind, status, is_demo, runs_per_provider
    ) VALUES (
      ${input.organizationId}, ${input.businessId}, ${kind}, 'queued', ${isDemo}, ${runs}
    )
    RETURNING id
  `;

  await trackEvent(db, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    eventName: "audit_started",
    properties: { auditId: audit.id, kind, runs },
  });

  // Enqueue background job (idempotent)
  await db.jobs.enqueue({
    jobType: "answer_share_audit",
    payload: { auditId: audit.id },
    idempotencyKey: `answer_share_audit:${audit.id}`,
  });

  // Sync path for demo / local without worker
  if (isDemo || process.env.ANSWER_SHARE_SYNC_DEMO === "true" || process.env.ANSWER_SHARE_SYNC === "true") {
    await runAudit(db, audit.id);
  }

  return audit.id;
}
