import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AnswerShare by ${BRAND.name} — Does Google or AI recommend your business?`,
  description:
    "AnswerShare tests purchase-intent questions across Google and leading AI assistants, shows which competitors are winning, and tells you what to improve.",
};

export default function AnswerShareLandingPage() {
  return (
    <div className="min-h-screen bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>
      <header className="border-b border-surface-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/answer-share" className="font-semibold tracking-tight">
            AnswerShare <span className="text-zinc-500">by {BRAND.name}</span>
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/answer-share/reports/sample" className="text-zinc-400 hover:text-accent">
              Sample report
            </Link>
            <Link href="/answer-share/free-audit" className="text-accent hover:underline">
              Free audit
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-6 py-16">
        <section aria-labelledby="hero-heading" className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            For local service businesses · HVAC St. Louis first
          </p>
          <h1 id="hero-heading" className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Does Google or AI recommend your business?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            AnswerShare tests the questions your customers ask across Google and leading AI
            assistants, shows which competitors are winning, and tells you what to improve.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/answer-share/free-audit"
              className="rounded-lg bg-accent px-6 py-3 text-base font-semibold text-black hover:bg-accent/90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            >
              Run My Free Visibility Audit
            </Link>
            <Link
              href="/answer-share/reports/sample"
              className="rounded-lg border border-surface-border px-6 py-3 text-base font-medium text-zinc-200 hover:border-accent/40 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            >
              See a Sample Report
            </Link>
          </div>
        </section>

        <section aria-labelledby="steps-heading" className="mt-20">
          <h2 id="steps-heading" className="text-center text-2xl font-semibold">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Tell us about your shop",
                body: "Name, website, city, and services — we crawl key pages and propose purchase-intent questions.",
              },
              {
                step: "2",
                title: "Approve questions & competitors",
                body: "Edit the ten buyer questions and confirm who you compete with before any tests run.",
              },
              {
                step: "3",
                title: "Get evidence & actions",
                body: "See mention, recommendation, and citation rates — plus three prioritized experiments.",
              },
            ].map((s) => (
              <li
                key={s.step}
                className="rounded-xl border border-surface-border bg-surface-raised p-6"
              >
                <p className="text-sm font-semibold text-accent">Step {s.step}</p>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="score-heading" className="mt-20 grid gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
            <h2 id="score-heading" className="text-xl font-semibold">
              Example visibility score
            </h2>
            <p className="mt-4 text-5xl font-bold text-accent" aria-label="Visibility score 42 out of 100">
              42
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              AnswerShare Visibility Score (0–100). Formula: 35% mention + 25% recommendation + 20%
              citation + 10% position + 10% share of voice.
            </p>
            <table className="mt-6 w-full text-left text-sm">
              <caption className="sr-only">Example component rates</caption>
              <thead>
                <tr className="text-zinc-500">
                  <th scope="col" className="py-1 font-medium">Metric</th>
                  <th scope="col" className="py-1 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr><td className="py-1">Mention rate</td><td>38%</td></tr>
                <tr><td className="py-1">Recommendation rate</td><td>22%</td></tr>
                <tr><td className="py-1">Citation rate</td><td>15%</td></tr>
                <tr><td className="py-1">Share of voice</td><td>28%</td></tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
            <h2 className="text-xl font-semibold">Example competitor comparison</h2>
            <table className="mt-6 w-full text-left text-sm">
              <caption className="sr-only">Share of voice example</caption>
              <thead>
                <tr className="text-zinc-500">
                  <th scope="col" className="py-1">Business</th>
                  <th scope="col" className="py-1">Mentions</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="py-1">Gateway Heating</td><td>41%</td></tr>
                <tr><td className="py-1">Your shop</td><td>28%</td></tr>
                <tr><td className="py-1">River City Air</td><td>19%</td></tr>
                <tr><td className="py-1">Others</td><td>12%</td></tr>
              </tbody>
            </table>
            <p className="mt-4 text-sm text-zinc-400">
              Observed difference — not causation. AI answers vary by run; we measure repeatable
              API-based observations and search snapshots.
            </p>
          </div>
        </section>

        <section aria-labelledby="action-heading" className="mt-12 rounded-xl border border-surface-border bg-surface-raised p-6">
          <h2 id="action-heading" className="text-xl font-semibold">
            Example evidence-backed recommendation
          </h2>
          <p className="mt-3 text-zinc-300">
            <strong>Strengthen emergency service evidence</strong> — On “best emergency HVAC in St.
            Louis,” you were not mentioned while Gateway Heating appeared in multiple completed
            runs. Evidence suggests a clearer emergency-hours page may help. Recommended
            experiment — retest in 30 days.
          </p>
        </section>

        <section aria-labelledby="pricing-heading" className="mt-20 text-center">
          <h2 id="pricing-heading" className="text-2xl font-semibold">
            Ongoing monitoring
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            After your free audit, monitor visibility monthly: twenty questions, five competitors,
            action center, and a branded report.
          </p>
          <div className="mx-auto mt-8 max-w-md rounded-xl border border-accent/30 bg-accent/5 p-8">
            <p className="text-sm uppercase tracking-wide text-accent">AnswerShare Monitoring</p>
            <p className="mt-2 text-4xl font-bold">
              $199<span className="text-lg font-normal text-zinc-400">/month</span>
            </p>
            <ul className="mt-6 space-y-2 text-left text-sm text-zinc-300">
              <li>One business · one primary location</li>
              <li>Twenty monitored questions · up to five competitors</li>
              <li>Monthly full audit · historical dashboard</li>
              <li>Action Center · monthly report</li>
            </ul>
            <Link
              href="/answer-share/free-audit"
              className="mt-8 inline-block rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black hover:bg-accent/90"
            >
              Start with a free audit
            </Link>
          </div>
        </section>

        <aside className="mt-16 rounded-lg border border-surface-border p-4 text-sm text-zinc-500">
          <p>
            <strong className="text-zinc-400">Methodology &amp; disclaimer:</strong> AnswerShare
            measures repeatable API-based model answers and licensed search-result snapshots. These
            are not identical to every consumer website view. AI answers vary; visibility is not
            guaranteed. We do not recommend spam, fake reviews, or artificial mentions.
          </p>
        </aside>
      </main>
    </div>
  );
}
