import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AnswerShareShell } from "@/components/answer-share/shell";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";

export const dynamic = "force-dynamic";

export default async function AnswerShareExperimentsPage() {
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

    const experiments = await db.sql<
      {
        id: string;
        hypothesis: string;
        outcome: string;
        causation_note: string;
        change_implemented: string | null;
        implemented_at: Date | null;
        retest_at: Date | null;
        confidence: number | null;
        recommendation_id: string | null;
        created_at: Date;
      }[]
    >`
      SELECT id, hypothesis, outcome, causation_note, change_implemented, implemented_at,
             retest_at, confidence, recommendation_id, created_at
      FROM as_experiments
      WHERE business_id = ${business.id}
      ORDER BY created_at DESC
    `;

    return (
      <AnswerShareShell demo={org.is_demo || business.is_demo} title={business.name}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Experiments</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Track changes against visibility metrics. Outcomes are correlational unless proven
              otherwise.
            </p>
          </div>
          <Link
            href="/answer-share/actions"
            className="inline-flex min-h-11 items-center rounded-lg border border-surface-border px-4 py-2 text-sm hover:border-accent/40 focus:outline focus:outline-2 focus:outline-accent"
          >
            Action center →
          </Link>
        </div>

        <section aria-labelledby="experiments-h" className="mt-8">
          <h2 id="experiments-h" className="sr-only">
            Experiment list
          </h2>
          {experiments.length === 0 ? (
            <p className="text-zinc-400">
              No experiments yet. Start one from a recommendation in the{" "}
              <Link href="/answer-share/actions" className="text-accent underline">
                action center
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-4">
              {experiments.map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl border border-surface-border bg-surface-raised p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-medium text-zinc-100">{e.hypothesis}</h3>
                    <span className="rounded border border-surface-border px-2 py-1 text-xs capitalize text-zinc-400">
                      {e.outcome.replace(/_/g, " ")}
                    </span>
                  </div>
                  {e.change_implemented ? (
                    <p className="mt-2 text-sm text-zinc-400">{e.change_implemented}</p>
                  ) : null}
                  <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">
                    {e.causation_note}
                  </p>
                  <p className="mt-3 text-xs text-zinc-500">
                    Created {new Date(e.created_at).toLocaleString()}
                    {e.retest_at
                      ? ` · Retest ${new Date(e.retest_at).toLocaleDateString()}`
                      : ""}
                    {e.confidence != null
                      ? ` · Confidence ${Math.round(Number(e.confidence) * 100)}%`
                      : ""}
                  </p>
                  {e.recommendation_id ? (
                    <Link
                      href={`/answer-share/actions#${e.recommendation_id}`}
                      className="mt-2 inline-flex min-h-11 items-center text-sm text-accent hover:underline focus:outline focus:outline-2 focus:outline-accent"
                    >
                      Related recommendation
                    </Link>
                  ) : null}
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
