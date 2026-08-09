import Link from "next/link";
import { redirect } from "next/navigation";
import { AnswerShareShell } from "@/components/answer-share/shell";
import { getDb } from "@/lib/db";
import { AS_COOKIE } from "@/lib/answer-share-session";
import { cookies } from "next/headers";
import { MetricBars } from "@/components/answer-share/metric-bars";

export const dynamic = "force-dynamic";

export default async function AnswerShareDashboardPage() {
  const jar = await cookies();
  const token = jar.get(AS_COOKIE)?.value;
  if (!token) redirect("/answer-share/free-audit");

  const db = getDb();
  try {
    const [org] = await db.sql<{ id: string; is_demo: boolean; subscription_status: string }[]>`
      SELECT id, is_demo, subscription_status FROM as_organizations WHERE access_token = ${token}
    `;
    if (!org) redirect("/answer-share/free-audit");

    const [business] = await db.sql<{ id: string; name: string; is_demo: boolean }[]>`
      SELECT id, name, is_demo FROM as_businesses WHERE organization_id = ${org.id} ORDER BY created_at LIMIT 1
    `;
    if (!business) redirect("/answer-share/free-audit");

    const [audit] = await db.sql<
      {
        id: string;
        status: string;
        metrics: Record<string, unknown>;
        completed_at: Date | null;
        progress: Record<string, unknown>;
        is_demo: boolean;
      }[]
    >`
      SELECT id, status, metrics, completed_at, progress, is_demo FROM as_audits
      WHERE business_id = ${business.id}
      ORDER BY created_at DESC LIMIT 1
    `;

    const actions = audit
      ? await db.sql<
          { id: string; title: string; explanation: string; effort: string; confidence: number }[]
        >`
          SELECT id, title, explanation, effort, confidence FROM as_recommendations
          WHERE audit_id = ${audit.id} ORDER BY sort_order ASC LIMIT 3
        `
      : [];

    const report = audit
      ? await db.sql<{ id: string }[]>`
          SELECT id FROM as_reports WHERE audit_id = ${audit.id} LIMIT 1
        `
      : [];

    const m = (audit?.metrics ?? {}) as {
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
      averageRecommendationPosition?: number | null;
    };

    return (
      <AnswerShareShell demo={org.is_demo || business.is_demo || audit?.is_demo} title={business.name}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Visibility dashboard</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Audit status: {audit?.status ?? "none"}
              {audit?.completed_at
                ? ` · Updated ${new Date(audit.completed_at).toLocaleString()}`
                : ""}
            </p>
          </div>
          {report[0] ? (
            <Link
              href={`/answer-share/reports/${report[0].id}`}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm hover:border-accent/40"
            >
              Open report
            </Link>
          ) : null}
        </div>

        {!audit ? (
          <p className="mt-8 text-zinc-400">
            No audit yet.{" "}
            <Link href="/answer-share/onboarding" className="text-accent underline">
              Finish onboarding
            </Link>
          </p>
        ) : (
          <>
            <section aria-labelledby="score-h" className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
              <div className="rounded-xl border border-surface-border bg-surface-raised p-6 text-center">
                <h2 id="score-h" className="text-sm uppercase tracking-wide text-zinc-500">
                  Visibility score
                </h2>
                <p className="mt-2 text-5xl font-bold text-accent" aria-label={`Score ${m.visibilityScore ?? 0} of 100`}>
                  {m.visibilityScore ?? 0}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Confidence {(Math.round((m.runConfidence ?? 0) * 100))}%
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

            <p className="mt-4 text-xs text-zinc-500">{m.formulaNote}</p>

            <section aria-labelledby="summary-h" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Questions won" value={String(m.questionsWon ?? 0)} />
              <Stat label="Questions lost" value={String(m.questionsLost ?? 0)} />
              <Stat label="Top competitor" value={m.topCompetitor ?? "—"} />
              <Stat label="Top cited competitor domain" value={m.topCompetitorDomain ?? "—"} />
            </section>

            <section aria-labelledby="actions-h" className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="actions-h" className="text-lg font-semibold">
                  Top recommended actions
                </h2>
                <Link href="/answer-share/actions" className="text-sm text-accent hover:underline">
                  Action center →
                </Link>
              </div>
              <ul className="space-y-3">
                {actions.map((a) => (
                  <li key={a.id} className="rounded-xl border border-surface-border bg-surface-raised p-4">
                    <h3 className="font-medium">{a.title}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{a.explanation}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Effort {a.effort} · Confidence {Math.round(Number(a.confidence) * 100)}%
                    </p>
                    <Link
                      href={`/answer-share/actions#${a.id}`}
                      className="mt-2 inline-block text-sm text-accent hover:underline"
                    >
                      View evidence
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="method-h" className="mt-10 rounded-lg border border-surface-border p-4 text-sm text-zinc-500">
              <h2 id="method-h" className="font-medium text-zinc-300">
                Methodology
              </h2>
              <p className="mt-2">
                Scores use API-based observations and search snapshots — not identical to every
                consumer browser view. Repeated runs are stored separately; one answer is never
                treated as definitive.
              </p>
            </section>
          </>
        )}
      </AnswerShareShell>
    );
  } finally {
    await db.sql.end();
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
