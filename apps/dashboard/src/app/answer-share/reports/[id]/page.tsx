import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { AnswerShareShell } from "@/components/answer-share/shell";
import { MetricBars } from "@/components/answer-share/metric-bars";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";
import { hashShareToken } from "../../../../../../../packages/answer-share/index";

export const dynamic = "force-dynamic";

type Metrics = {
  visibilityScore?: number;
  mentionRate?: number;
  recommendationRate?: number;
  citationRate?: number;
  competitiveShareOfVoice?: number;
  runConfidence?: number;
  providerCoverage?: number;
  partialCoverage?: boolean;
  formulaNote?: string;
  questionsWon?: number;
  questionsLost?: number;
  topCompetitor?: string;
  topCompetitorDomain?: string;
};

const SAMPLE = {
  title: "Laclede Comfort HVAC — Sample Visibility Report",
  businessName: "Laclede Comfort HVAC",
  metrics: {
    visibilityScore: 42,
    mentionRate: 0.38,
    recommendationRate: 0.22,
    citationRate: 0.15,
    competitiveShareOfVoice: 0.28,
    runConfidence: 0.72,
    providerCoverage: 1,
    partialCoverage: false,
    formulaNote:
      "35% mention + 25% recommendation + 20% citation + 10% position + 10% share of voice",
    questionsWon: 4,
    questionsLost: 6,
    topCompetitor: "Gateway Heating & Cooling",
    topCompetitorDomain: "example.com",
  } satisfies Metrics,
  actions: [
    {
      title: "Strengthen emergency service evidence",
      explanation:
        "On emergency HVAC questions you were often absent while Gateway Heating appeared. A clearer emergency-hours page may help — correlation only.",
    },
    {
      title: "Publish weekend availability proof",
      explanation:
        "Weekend repair intent questions favored competitors with explicit Saturday coverage language.",
    },
    {
      title: "Add citation-worthy service area pages",
      explanation:
        "Citation rate lagged mention rate — deeper local landing pages can give models something to cite.",
    },
  ],
};

export default async function AnswerShareReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token: shareToken } = await searchParams;

  if (id === "sample") {
    return (
      <ReportView
        demo
        title={SAMPLE.title}
        businessName={SAMPLE.businessName}
        metrics={SAMPLE.metrics}
        actions={SAMPLE.actions}
        printClass
      />
    );
  }

  const jar = await cookies();
  const sessionToken = jar.get(AS_COOKIE)?.value;
  const db = getDb();

  try {
    const [report] = await db.sql<
      {
        id: string;
        title: string;
        summary_json: Record<string, unknown>;
        share_token_hash: string | null;
        is_public: boolean;
        organization_id: string;
        business_id: string;
        audit_id: string;
      }[]
    >`
      SELECT id, title, summary_json, share_token_hash, is_public, organization_id, business_id, audit_id
      FROM as_reports WHERE id = ${id}
    `;
    if (!report) notFound();

    let allowed = false;
    if (sessionToken) {
      const [org] = await db.sql<{ id: string }[]>`
        SELECT id FROM as_organizations WHERE access_token_hash = ${hashAccessToken(sessionToken)}
      `;
      if (org?.id === report.organization_id) allowed = true;
    }
    if (!allowed && shareToken && report.share_token_hash) {
      if (hashShareToken(shareToken) === report.share_token_hash) allowed = true;
    }
    if (!allowed) notFound();

    const [business] = await db.sql<{ name: string; is_demo: boolean }[]>`
      SELECT name, is_demo FROM as_businesses WHERE id = ${report.business_id}
    `;
    const [audit] = await db.sql<{ is_demo: boolean; metrics: Record<string, unknown> }[]>`
      SELECT is_demo, metrics FROM as_audits WHERE id = ${report.audit_id}
    `;
    const [org] = await db.sql<{ is_demo: boolean }[]>`
      SELECT is_demo FROM as_organizations WHERE id = ${report.organization_id}
    `;

    const rawSummary = report.summary_json ?? {};
    const summaryMetrics = (rawSummary.metrics ?? audit?.metrics ?? {}) as Metrics;
    // Intentionally omit shareToken / any raw provider payloads from the UI

    const actions = await db.sql<{ title: string; explanation: string }[]>`
      SELECT title, explanation FROM as_recommendations
      WHERE audit_id = ${report.audit_id}
      ORDER BY sort_order ASC LIMIT 5
    `;

    return (
      <ReportView
        demo={Boolean(org?.is_demo || business?.is_demo || audit?.is_demo)}
        title={report.title}
        businessName={business?.name ?? "Business"}
        metrics={summaryMetrics}
        actions={actions}
        printClass
      />
    );
  } finally {
    await db.sql.end();
  }
}

function ReportView({
  demo,
  title,
  businessName,
  metrics,
  actions,
  printClass,
}: {
  demo?: boolean;
  title: string;
  businessName: string;
  metrics: Metrics;
  actions: { title: string; explanation: string }[];
  printClass?: boolean;
}) {
  const m = metrics;
  return (
    <AnswerShareShell demo={demo} title={businessName}>
      <article className={printClass ? "print-friendly as-report" : undefined}>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-zinc-500">
              AnswerShare visibility report for {businessName}
            </p>
          </div>
          <Link
            href="/answer-share/settings"
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-black hover:bg-accent/90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent print:hidden"
          >
            Monitor for $199/mo
          </Link>
        </header>

        <section aria-labelledby="score-h" className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="rounded-xl border border-surface-border bg-surface-raised p-6 text-center">
            <h2 id="score-h" className="text-sm uppercase tracking-wide text-zinc-500">
              Visibility score
            </h2>
            <p
              className="mt-2 text-5xl font-bold text-accent"
              aria-label={`Score ${m.visibilityScore ?? 0} of 100`}
            >
              {m.visibilityScore ?? 0}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Confidence {Math.round((m.runConfidence ?? 0) * 100)}%
              {m.partialCoverage ? " · partial provider coverage" : ""}
            </p>
          </div>
          <MetricBars
            rows={[
              { label: "Mention rate", value: m.mentionRate ?? 0 },
              { label: "Recommendation rate", value: m.recommendationRate ?? 0 },
              { label: "Citation rate", value: m.citationRate ?? 0 },
              { label: "Competitive share of voice", value: m.competitiveShareOfVoice ?? 0 },
              { label: "Provider coverage", value: m.providerCoverage ?? 0 },
            ]}
          />
        </section>

        {m.formulaNote ? <p className="mt-4 text-xs text-zinc-500">{m.formulaNote}</p> : null}

        <section aria-labelledby="summary-h" className="mt-8">
          <h2 id="summary-h" className="text-lg font-semibold">
            Audit summary
          </h2>
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">Won and lost questions and top competitor</caption>
            <tbody className="text-zinc-300">
              <tr className="border-b border-surface-border">
                <th scope="row" className="py-2 pr-4 font-medium text-zinc-500">
                  Questions won
                </th>
                <td className="py-2">{m.questionsWon ?? 0}</td>
              </tr>
              <tr className="border-b border-surface-border">
                <th scope="row" className="py-2 pr-4 font-medium text-zinc-500">
                  Questions lost
                </th>
                <td className="py-2">{m.questionsLost ?? 0}</td>
              </tr>
              <tr className="border-b border-surface-border">
                <th scope="row" className="py-2 pr-4 font-medium text-zinc-500">
                  Top competitor
                </th>
                <td className="py-2">{m.topCompetitor ?? "—"}</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 pr-4 font-medium text-zinc-500">
                  Top competitor domain
                </th>
                <td className="py-2">{m.topCompetitorDomain ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section aria-labelledby="actions-h" className="mt-10">
          <h2 id="actions-h" className="text-lg font-semibold">
            Recommended actions
          </h2>
          <ul className="mt-4 space-y-3">
            {actions.map((a) => (
              <li key={a.title} className="rounded-xl border border-surface-border bg-surface-raised p-4">
                <h3 className="font-medium">{a.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{a.explanation}</p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="mt-10 rounded-lg border border-surface-border p-4 text-sm text-zinc-500">
          <p>
            <strong className="text-zinc-400">Methodology:</strong> Scores use API-based
            observations and search snapshots — not identical to every consumer browser view.
            Repeated runs are stored separately. Correlation is not causation.
          </p>
        </aside>

        <section
          aria-labelledby="cta-h"
          className="mt-10 rounded-xl border border-accent/30 bg-accent/5 p-6 text-center print:hidden"
        >
          <h2 id="cta-h" className="text-lg font-semibold">
            Keep watching your visibility
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
            AnswerShare Monitoring retests your questions monthly and keeps an action center —
            ${199}/month.
          </p>
          <Link
            href="/answer-share/settings"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black hover:bg-accent/90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          >
            Monitor for $199/mo
          </Link>
        </section>
      </article>
    </AnswerShareShell>
  );
}
