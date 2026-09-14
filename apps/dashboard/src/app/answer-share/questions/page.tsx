import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AnswerShareShell } from "@/components/answer-share/shell";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";

export const dynamic = "force-dynamic";

export default async function AnswerShareQuestionsPage() {
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

    const questions = await db.sql<
      {
        id: string;
        question_text: string;
        intent_category: string;
        status: string;
        location_label: string | null;
      }[]
    >`
      SELECT id, question_text, intent_category, status, location_label
      FROM as_buyer_questions
      WHERE business_id = ${business.id}
      ORDER BY sort_order ASC
    `;

    const rates = audit
      ? await db.sql<
          {
            question_id: string;
            mention_rate: number;
            recommendation_rate: number;
            first_run_id: string | null;
          }[]
        >`
          SELECT
            question_id,
            AVG(CASE WHEN customer_mentioned THEN 1.0 ELSE 0.0 END)::float AS mention_rate,
            AVG(CASE WHEN customer_recommended THEN 1.0 ELSE 0.0 END)::float AS recommendation_rate,
            (ARRAY_AGG(id ORDER BY ran_at ASC, created_at ASC))[1] AS first_run_id
          FROM as_provider_runs
          WHERE audit_id = ${audit.id} AND error_status IS NULL
          GROUP BY question_id
        `
      : [];

    const rateByQ = new Map(rates.map((r) => [r.question_id, r]));

    return (
      <AnswerShareShell demo={org.is_demo || business.is_demo || audit?.is_demo} title={business.name}>
        <h1 className="text-2xl font-semibold">Buyer questions</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Mention and recommendation rates from the latest audit. Question editing via API comes
          later — this list is read-only for the MVP.
        </p>

        <section aria-labelledby="questions-h" className="mt-8">
          <h2 id="questions-h" className="sr-only">
            Question list
          </h2>
          {questions.length === 0 ? (
            <p className="text-zinc-400">
              No questions yet.{" "}
              <Link href="/answer-share/onboarding" className="text-accent underline">
                Finish onboarding
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">
                  Buyer questions with mention and recommendation rates
                </caption>
                <thead className="border-b border-surface-border bg-surface-raised text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Question
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Mention
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Recommended
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Evidence
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const r = rateByQ.get(q.id);
                    return (
                      <tr key={q.id} className="border-b border-surface-border last:border-0">
                        <td className="px-4 py-3 text-zinc-200">
                          <p>{q.question_text}</p>
                          {q.location_label ? (
                            <p className="mt-1 text-xs text-zinc-500">{q.location_label}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 capitalize text-zinc-400">{q.status}</td>
                        <td className="px-4 py-3 font-medium">
                          {r ? `${Math.round(r.mention_rate * 100)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {r ? `${Math.round(r.recommendation_rate * 100)}%` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {r?.first_run_id ? (
                            <Link
                              href={`/answer-share/evidence/${r.first_run_id}`}
                              className="inline-flex min-h-11 items-center text-accent hover:underline focus:outline focus:outline-2 focus:outline-accent"
                            >
                              View run
                            </Link>
                          ) : (
                            <span className="text-zinc-600">No runs</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AnswerShareShell>
    );
  } finally {
    await db.sql.end();
  }
}
