import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AnswerShareShell } from "@/components/answer-share/shell";
import { getDb } from "@/lib/db";
import { AS_COOKIE } from "@/lib/answer-share-session";

export const dynamic = "force-dynamic";

function competitorNamesFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v : typeof v === "object" && v && "name" in v ? String((v as { name: unknown }).name) : null))
    .filter((n): n is string => Boolean(n));
}

export default async function AnswerShareCompetitorsPage() {
  const jar = await cookies();
  const token = jar.get(AS_COOKIE)?.value;
  if (!token) redirect("/answer-share/free-audit");

  const db = getDb();
  try {
    const [org] = await db.sql<{ id: string; is_demo: boolean }[]>`
      SELECT id, is_demo FROM as_organizations WHERE access_token = ${token}
    `;
    if (!org) redirect("/answer-share/free-audit");

    const [business] = await db.sql<{ id: string; name: string; is_demo: boolean }[]>`
      SELECT id, name, is_demo FROM as_businesses
      WHERE organization_id = ${org.id} ORDER BY created_at LIMIT 1
    `;
    if (!business) redirect("/answer-share/free-audit");

    const competitors = await db.sql<
      {
        id: string;
        name: string;
        website_url: string | null;
        domain: string | null;
        approved: boolean;
        suggested: boolean;
      }[]
    >`
      SELECT id, name, website_url, domain, approved, suggested
      FROM as_competitors
      WHERE business_id = ${business.id}
      ORDER BY approved DESC, created_at ASC
    `;

    const [audit] = await db.sql<{ id: string; is_demo: boolean }[]>`
      SELECT id, is_demo FROM as_audits
      WHERE business_id = ${business.id}
      ORDER BY created_at DESC LIMIT 1
    `;

    const lostRuns = audit
      ? await db.sql<
          {
            id: string;
            question_id: string;
            question_text: string;
            competitors_mentioned: unknown;
            provider: string;
          }[]
        >`
          SELECT r.id, r.question_id, q.question_text, r.competitors_mentioned, r.provider
          FROM as_provider_runs r
          JOIN as_buyer_questions q ON q.id = r.question_id
          WHERE r.audit_id = ${audit.id}
            AND r.error_status IS NULL
            AND r.customer_mentioned = false
          ORDER BY q.sort_order ASC, r.ran_at ASC
        `
      : [];

    const whyTheyWin = new Map<
      string,
      { questionText: string; competitors: string[]; evidenceId: string; provider: string }
    >();
    for (const run of lostRuns) {
      if (whyTheyWin.has(run.question_id)) continue;
      const names = competitorNamesFromJson(run.competitors_mentioned);
      if (names.length === 0) continue;
      whyTheyWin.set(run.question_id, {
        questionText: run.question_text,
        competitors: names,
        evidenceId: run.id,
        provider: run.provider,
      });
    }

    return (
      <AnswerShareShell demo={org.is_demo || business.is_demo || audit?.is_demo} title={business.name}>
        <h1 className="text-2xl font-semibold">Competitors</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Tracked competitors for {business.name}, plus where others win when you are not mentioned.
        </p>

        <section aria-labelledby="tracked-h" className="mt-8">
          <h2 id="tracked-h" className="text-lg font-semibold">
            Tracked competitors
          </h2>
          {competitors.length === 0 ? (
            <p className="mt-3 text-zinc-400">No competitors configured yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {competitors.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4"
                >
                  <p className="font-medium text-zinc-100">{c.name}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {c.domain ?? c.website_url ?? "No domain"}
                    {c.suggested ? " · suggested" : ""}
                    {c.approved ? " · approved" : " · not approved"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="why-h" className="mt-10">
          <h2 id="why-h" className="text-lg font-semibold">
            Why they win
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Lost questions from the latest audit where you were not mentioned.
          </p>
          {whyTheyWin.size === 0 ? (
            <p className="mt-4 text-zinc-400">
              {audit
                ? "No clear losses with competitor mentions in the latest audit."
                : "Run an audit to see competitor wins."}
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {[...whyTheyWin.values()].map((card) => (
                <li
                  key={card.evidenceId}
                  className="rounded-xl border border-surface-border bg-surface-raised p-5"
                >
                  <h3 className="font-medium text-zinc-100">{card.questionText}</h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    Competitors mentioned: {card.competitors.join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Provider: {card.provider}</p>
                  <Link
                    href={`/answer-share/evidence/${card.evidenceId}`}
                    className="mt-3 inline-flex min-h-11 items-center text-sm text-accent hover:underline focus:outline focus:outline-2 focus:outline-accent"
                  >
                    View evidence
                  </Link>
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
