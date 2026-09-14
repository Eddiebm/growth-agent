import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AnswerShareShell } from "@/components/answer-share/shell";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";

export const dynamic = "force-dynamic";

function highlightResponse(
  text: string,
  businessName: string,
  aliases: string[],
  competitors: string[],
): ReactNode[] {
  const needles = [businessName, ...aliases, ...competitors]
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!text || needles.length === 0) return [text || "—"];

  const pattern = new RegExp(
    `(${needles.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const isHit = needles.some((n) => n.toLowerCase() === part.toLowerCase());
    if (!isHit) return <span key={i}>{part}</span>;
    const isCustomer =
      part.toLowerCase() === businessName.toLowerCase() ||
      aliases.some((a) => a.toLowerCase() === part.toLowerCase());
    return (
      <mark
        key={i}
        className={
          isCustomer
            ? "rounded bg-accent/30 px-0.5 text-accent"
            : "rounded bg-amber-500/20 px-0.5 text-amber-100"
        }
      >
        {part}
      </mark>
    );
  });
}

export default async function AnswerShareEvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jar = await cookies();
  const token = jar.get(AS_COOKIE)?.value;
  if (!token) redirect("/answer-share/free-audit");

  const db = getDb();
  try {
    const [org] = await db.sql<{ id: string; is_demo: boolean }[]>`
      SELECT id, is_demo FROM as_organizations WHERE access_token_hash = ${hashAccessToken(token)}
    `;
    if (!org) redirect("/answer-share/free-audit");

    const [run] = await db.sql<
      {
        id: string;
        audit_id: string;
        business_id: string;
        question_id: string;
        provider: string;
        engine: string | null;
        model_version: string | null;
        run_index: number;
        prompt: string;
        requested_location: string | null;
        response_text: string | null;
        customer_mentioned: boolean;
        customer_recommended: boolean;
        customer_position: number | null;
        mentioned_businesses: unknown;
        competitors_mentioned: unknown;
        citations: unknown;
        cited_urls: string[];
        cited_domains: string[];
        sentiment: string | null;
        error_status: string | null;
        ran_at: Date;
      }[]
    >`
      SELECT id, audit_id, business_id, question_id, provider, engine, model_version, run_index,
             prompt, requested_location, response_text, customer_mentioned, customer_recommended,
             customer_position, mentioned_businesses, competitors_mentioned, citations,
             cited_urls, cited_domains, sentiment, error_status, ran_at
      FROM as_provider_runs WHERE id = ${id}
    `;
    if (!run) notFound();

    const [business] = await db.sql<
      { id: string; name: string; is_demo: boolean; organization_id: string }[]
    >`
      SELECT id, name, is_demo, organization_id FROM as_businesses WHERE id = ${run.business_id}
    `;
    if (!business || business.organization_id !== org.id) notFound();

    const [question] = await db.sql<{ question_text: string }[]>`
      SELECT question_text FROM as_buyer_questions WHERE id = ${run.question_id}
    `;
    const aliases = (
      await db.sql<{ alias: string }[]>`
        SELECT alias FROM as_business_aliases WHERE business_id = ${business.id}
      `
    ).map((r) => r.alias);

    const competitors = Array.isArray(run.competitors_mentioned)
      ? (run.competitors_mentioned as unknown[]).map((c) =>
          typeof c === "string" ? c : String((c as { name?: string })?.name ?? ""),
        ).filter(Boolean)
      : [];

    const mentioned = Array.isArray(run.mentioned_businesses)
      ? (run.mentioned_businesses as unknown[]).map(String)
      : [];

    const citations = Array.isArray(run.citations) ? run.citations : [];

    return (
      <AnswerShareShell demo={org.is_demo || business.is_demo} title={business.name}>
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
          <Link href="/answer-share/dashboard" className="hover:text-accent">
            Dashboard
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-zinc-300">Evidence</span>
        </nav>

        <h1 className="mt-4 text-2xl font-semibold">Provider run evidence</h1>
        <p className="mt-2 text-sm text-zinc-500">
          One observation — not a definitive answer. Raw redacted payloads are omitted.
        </p>

        <section aria-labelledby="meta-h" className="mt-8 rounded-xl border border-surface-border bg-surface-raised p-5">
          <h2 id="meta-h" className="text-lg font-semibold">
            Run metadata
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Provider</dt>
              <dd className="mt-1 text-zinc-100">
                {run.provider}
                {run.engine ? ` · ${run.engine}` : ""}
                {run.model_version ? ` · ${run.model_version}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Run index</dt>
              <dd className="mt-1 text-zinc-100">{run.run_index}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Location</dt>
              <dd className="mt-1 text-zinc-100">{run.requested_location ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Ran at</dt>
              <dd className="mt-1 text-zinc-100">{new Date(run.ran_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Customer mentioned</dt>
              <dd className="mt-1 text-zinc-100">{run.customer_mentioned ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Customer recommended</dt>
              <dd className="mt-1 text-zinc-100">{run.customer_recommended ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Position</dt>
              <dd className="mt-1 text-zinc-100">{run.customer_position ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Sentiment</dt>
              <dd className="mt-1 capitalize text-zinc-100">{run.sentiment ?? "—"}</dd>
            </div>
          </dl>
          {run.error_status ? (
            <p role="status" className="mt-4 text-sm text-amber-200">
              Error status: {run.error_status}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="q-h" className="mt-8">
          <h2 id="q-h" className="text-lg font-semibold">
            Question
          </h2>
          <p className="mt-2 text-zinc-200">{question?.question_text ?? "—"}</p>
        </section>

        <section aria-labelledby="prompt-h" className="mt-8">
          <h2 id="prompt-h" className="text-lg font-semibold">
            Prompt
          </h2>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-surface-border bg-surface-raised p-4 text-sm text-zinc-300">
            {run.prompt}
          </pre>
        </section>

        <section aria-labelledby="response-h" className="mt-8">
          <h2 id="response-h" className="text-lg font-semibold">
            Response
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Highlights: customer names in accent, competitors in amber.
          </p>
          <div className="mt-3 rounded-xl border border-surface-border bg-surface-raised p-4 text-sm leading-relaxed text-zinc-200">
            {highlightResponse(
              run.response_text ?? "",
              business.name,
              aliases,
              competitors,
            )}
          </div>
        </section>

        <section aria-labelledby="extract-h" className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h2 id="extract-h" className="font-semibold">
              Mentioned businesses
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {mentioned.length ? mentioned.map((n) => <li key={n}>{n}</li>) : <li>None</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h2 className="font-semibold">Competitors mentioned</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {competitors.length ? competitors.map((n) => <li key={n}>{n}</li>) : <li>None</li>}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cite-h" className="mt-8">
          <h2 id="cite-h" className="text-lg font-semibold">
            Citations
          </h2>
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">Cited URLs and domains</caption>
            <thead>
              <tr className="text-zinc-500">
                <th scope="col" className="py-2">
                  URL / domain
                </th>
              </tr>
            </thead>
            <tbody>
              {(run.cited_urls?.length ? run.cited_urls : run.cited_domains).map((u) => (
                <tr key={u} className="border-t border-surface-border">
                  <td className="py-2 text-zinc-300 break-all">{u}</td>
                </tr>
              ))}
              {!run.cited_urls?.length && !run.cited_domains?.length ? (
                <tr>
                  <td className="py-2 text-zinc-500">No citations</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {citations.length > 0 ? (
            <p className="mt-2 text-xs text-zinc-600">{citations.length} structured citation(s)</p>
          ) : null}
        </section>

        <p className="mt-8">
          <Link
            href="/answer-share/actions"
            className="inline-flex min-h-11 items-center text-sm text-accent hover:underline focus:outline focus:outline-2 focus:outline-accent"
          >
            ← Back to actions
          </Link>
        </p>
      </AnswerShareShell>
    );
  } finally {
    await db.sql.end();
  }
}
