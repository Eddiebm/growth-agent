import type { Metadata } from "next";
import Link from "next/link";
import { DemoCallCta } from "@/components/demo-call-cta";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} — Never miss an after-hours HVAC call`,
  description:
    "AI answers your shop line 24/7, books service calls, and routes emergencies. Call the live demo — $299/mo pilot for HVAC shops.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-surface-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-semibold tracking-tight">{BRAND.name}</span>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-accent"
          >
            Operators →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            For HVAC shops · $299/mo pilot
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Stop losing jobs to voicemail.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            Your shop line gets answered after hours, on weekends, and when the team&apos;s on a
            job — calls get booked, emergencies get routed. Call the demo below and pretend your AC
            just died on a Saturday night.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/hvac"
              className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent/90"
            >
              Start pilot →
            </Link>
            <Link
              href="/hvac"
              className="rounded-lg border border-surface-border px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-accent/40"
            >
              How it works
            </Link>
          </div>
        </div>

        <section className="mt-16" id="demo">
          <DemoCallCta />
        </section>

        <section className="mt-20 grid gap-8 sm:grid-cols-3">
          {[
            {
              title: "More booked jobs",
              desc: "After-hours and overflow calls get answered — not sent to voicemail.",
            },
            {
              title: "Fewer missed calls",
              desc: "Peak season and nights covered without hiring extra dispatch staff.",
            },
            {
              title: "One job pays for it",
              desc: "A single booked emergency call often covers the $299 monthly pilot.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-surface-border bg-surface-raised p-6"
            >
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-20 rounded-2xl border border-surface-border bg-surface-raised p-8">
          <h2 className="text-lg font-semibold">How the pilot works</h2>
          <ol className="mt-6 space-y-4 text-sm text-zinc-400">
            <li>
              <span className="font-medium text-zinc-200">1. Hear it.</span> Call the demo line
              above — that&apos;s your shop after hours.
            </li>
            <li>
              <span className="font-medium text-zinc-200">2. Pilot.</span> $299/mo, 30-day tuning,
              calendar integration included.
            </li>
            <li>
              <span className="font-medium text-zinc-200">3. Go live.</span> Forward overflow and
              after-hours to the AI — keep your team on complex jobs.
            </li>
          </ol>
          <div className="mt-8 flex flex-wrap gap-4">
            <DemoCallCta variant="compact" />
            <Link
              href="/hvac"
              className="inline-flex items-center rounded-lg border border-surface-border px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-accent/40"
            >
              Full details & signup →
            </Link>
          </div>
        </section>

        <p className="mt-16 text-center text-xs text-zinc-600">
          {BRAND.name} · AI phone coverage for local service shops
        </p>
      </main>

      <footer className="border-t border-surface-border py-8 text-center text-xs text-zinc-600">
        {BRAND.domain}
      </footer>
    </div>
  );
}
