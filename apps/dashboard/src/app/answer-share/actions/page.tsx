import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AnswerShareShell } from "@/components/answer-share/shell";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";

export const dynamic = "force-dynamic";

export default async function AnswerShareActionsPage() {
  const jar = await cookies();
  const token = jar.get(AS_COOKIE)?.value;
  if (!token) redirect("/answer-share/free-audit");

  const db = getDb();
  try {
    const [org] = await db.sql<{ id: string; is_demo: boolean }[]>`
      SELECT id, is_demo FROM as_organizations WHERE access_token_hash = ${hashAccessToken(token)}
    `;
    if (!org) redirect("/answer-share/free-audit");

    const [business] = await db.sql<{ id: string; name: string; is_demo: boolean }[]>`
      SELECT id, name, is_demo FROM as_businesses
      WHERE organization_id = ${org.id} ORDER BY created_at LIMIT 1
    `;
    if (!business) redirect("/answer-share/free-audit");

    const [audit] = await db.sql<{ id: string; is_demo: boolean }[]>`
      SELECT id, is_demo FROM as_audits
      WHERE business_id = ${business.id}
      ORDER BY created_at DESC LIMIT 1
    `;

    const actions = audit
      ? await db.sql<
          {
            id: string;
            title: string;
            explanation: string;
            category: string;
            effort: string;
            confidence: number;
            expected_impact: string | null;
            measurement_plan: string | null;
            competitor_comparison: string | null;
            evidence_ids: string[];
            status: string;
          }[]
        >`
          SELECT id, title, explanation, category, effort, confidence, expected_impact,
                 measurement_plan, competitor_comparison, evidence_ids, status
          FROM as_recommendations
          WHERE audit_id = ${audit.id}
          ORDER BY sort_order ASC
        `
      : [];

    return (
      <AnswerShareShell demo={org.is_demo || business.is_demo || audit?.is_demo} title={business.name}>
        <h1 className="text-2xl font-semibold">Action center</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Evidence-backed recommendations from your latest audit. Start an experiment to track a
          change over time.
        </p>

        <section aria-labelledby="actions-h" className="mt-8">
          <h2 id="actions-h" className="sr-only">
            Recommendations
          </h2>
          {!audit ? (
            <p className="text-zinc-400">
              No audit yet.{" "}
              <Link href="/answer-share/onboarding" className="text-accent underline">
                Finish onboarding
              </Link>
            </p>
          ) : actions.length === 0 ? (
            <p className="text-zinc-400">No recommendations for this audit.</p>
          ) : (
            <ul className="space-y-4">
              {actions.map((a) => (
                <li
                  key={a.id}
                  id={a.id}
                  className="rounded-xl border border-surface-border bg-surface-raised p-5 scroll-mt-24"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-zinc-100">{a.title}</h3>
                      <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                        {a.category} · Effort {a.effort} · Confidence{" "}
                        {Math.round(Number(a.confidence) * 100)}% · {a.status}
                      </p>
                    </div>
                    <form method="POST" action="/api/answer-share/experiments">
                      <input type="hidden" name="recommendationId" value={a.id} />
                      <button
                        type="submit"
                        className="min-h-11 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 focus:outline focus:outline-2 focus:outline-accent"
                      >
                        Start experiment
                      </button>
                    </form>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">{a.explanation}</p>
                  {a.expected_impact ? (
                    <p className="mt-2 text-sm text-zinc-400">
                      <span className="text-zinc-500">Expected impact:</span> {a.expected_impact}
                    </p>
                  ) : null}
                  {a.competitor_comparison ? (
                    <p className="mt-2 text-sm text-zinc-400">{a.competitor_comparison}</p>
                  ) : null}
                  {a.measurement_plan ? (
                    <p className="mt-2 text-sm text-zinc-500">{a.measurement_plan}</p>
                  ) : null}
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Evidence
                    </p>
                    {(a.evidence_ids ?? []).length === 0 ? (
                      <p className="mt-1 text-sm text-zinc-600">No evidence linked</p>
                    ) : (
                      <ul className="mt-2 flex flex-wrap gap-3">
                        {(a.evidence_ids ?? []).map((eid, i) => (
                          <li key={eid}>
                            <Link
                              href={`/answer-share/evidence/${eid}`}
                              className="inline-flex min-h-11 items-center text-sm text-accent hover:underline focus:outline focus:outline-2 focus:outline-accent"
                            >
                              Evidence {i + 1}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </AnswerShareShell>
    );
  } finally {
    await db.sql.end();
  }
}
