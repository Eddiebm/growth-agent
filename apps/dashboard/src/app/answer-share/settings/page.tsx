import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AnswerShareShell } from "@/components/answer-share/shell";
import { getDb } from "@/lib/db";
import { AS_COOKIE, hashAccessToken } from "@/lib/answer-share-session";
import {
  ANSWER_SHARE_PLAN,
  providerConfigStatus,
} from "../../../../../../packages/answer-share/index";

export const dynamic = "force-dynamic";

export default async function AnswerShareSettingsPage() {
  const jar = await cookies();
  const token = jar.get(AS_COOKIE)?.value;
  if (!token) redirect("/answer-share/free-audit");

  const db = getDb();
  try {
    const [org] = await db.sql<
      {
        id: string;
        name: string;
        is_demo: boolean;
        subscription_status: string;
        plan_key: string;
      }[]
    >`
      SELECT id, name, is_demo, subscription_status, plan_key
      FROM as_organizations WHERE access_token_hash = ${hashAccessToken(token)}
    `;
    if (!org) redirect("/answer-share/free-audit");

    const [business] = await db.sql<{ id: string; name: string; is_demo: boolean }[]>`
      SELECT id, name, is_demo FROM as_businesses
      WHERE organization_id = ${org.id} ORDER BY created_at LIMIT 1
    `;
    if (!business) redirect("/answer-share/free-audit");

    const providers = providerConfigStatus();

    return (
      <AnswerShareShell demo={org.is_demo || business.is_demo} title={business.name}>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Organization subscription, provider credentials, and methodology notes.
        </p>

        <section aria-labelledby="sub-h" className="mt-8 rounded-xl border border-surface-border bg-surface-raised p-6">
          <h2 id="sub-h" className="text-lg font-semibold">
            Subscription
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Organization</dt>
              <dd className="mt-1 text-zinc-100">{org.name}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Status</dt>
              <dd className="mt-1 capitalize text-zinc-100">{org.subscription_status}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Plan key</dt>
              <dd className="mt-1 text-zinc-100">{org.plan_key}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Monitoring</dt>
              <dd className="mt-1 text-zinc-100">
                {ANSWER_SHARE_PLAN.name} · ${ANSWER_SHARE_PLAN.priceUsd}/
                {ANSWER_SHARE_PLAN.interval}
              </dd>
            </div>
          </dl>
          {org.subscription_status !== "active" && org.subscription_status !== "trialing" ? (
            <form method="POST" action="/api/answer-share/checkout" className="mt-6">
              <button
                type="submit"
                className="min-h-11 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-black hover:bg-accent/90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              >
                Start monitoring — ${ANSWER_SHARE_PLAN.priceUsd}/mo
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-accent">Monitoring subscription is active.</p>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            Checkout uses Stripe when configured. If Stripe is not set up, the API returns an
            unconfigured state instead of failing hard.
          </p>
        </section>

        <section aria-labelledby="providers-h" className="mt-8 rounded-xl border border-surface-border bg-surface-raised p-6">
          <h2 id="providers-h" className="text-lg font-semibold">
            Provider configuration
          </h2>
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">AI and search provider credential status</caption>
            <thead>
              <tr className="text-zinc-500">
                <th scope="col" className="py-2 font-medium">
                  Provider
                </th>
                <th scope="col" className="py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-t border-surface-border">
                  <td className="py-2 text-zinc-200">{p.name}</td>
                  <td className="py-2">
                    {p.configured ? (
                      <span className="text-accent">Configured</span>
                    ) : (
                      <span className="text-zinc-500">Not configured</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-zinc-500">
            Missing credentials disable an adapter; audits continue with available providers.
          </p>
        </section>

        <section
          aria-labelledby="method-h"
          className="mt-8 rounded-lg border border-surface-border p-4 text-sm text-zinc-500"
        >
          <h2 id="method-h" className="font-medium text-zinc-300">
            Methodology
          </h2>
          <p className="mt-2">
            AnswerShare measures repeatable API-based model answers and licensed search-result
            snapshots. These are not identical to every consumer website view. AI answers vary by
            run; one observation is never treated as definitive. Visibility improvements are not
            guaranteed. We do not recommend spam, fake reviews, or artificial mentions.
          </p>
          <p className="mt-2">
            Limits for {ANSWER_SHARE_PLAN.name}: {ANSWER_SHARE_PLAN.limits.businesses} business,{" "}
            {ANSWER_SHARE_PLAN.limits.locations} location, {ANSWER_SHARE_PLAN.limits.questions}{" "}
            questions, {ANSWER_SHARE_PLAN.limits.competitors} competitors.
          </p>
          <p className="mt-4">
            <Link href="/answer-share" className="text-accent hover:underline">
              Back to AnswerShare home
            </Link>
          </p>
        </section>
      </AnswerShareShell>
    );
  } finally {
    await db.sql.end();
  }
}
