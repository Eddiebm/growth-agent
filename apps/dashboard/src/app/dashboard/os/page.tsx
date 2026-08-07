import Link from "next/link";
import { DashboardNav } from "@/components/dashboard-nav";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

const MAKOLA_SECTIONS = [
  {
    href: "/dashboard",
    title: "Pipeline",
    blurb: "Leads, approvals, and outreach controls.",
  },
  {
    href: "/dashboard/calls",
    title: "Calls",
    blurb: "Voice calls, dispositions, and recordings.",
  },
  {
    href: "/dashboard/activity",
    title: "Activity",
    blurb: "What the agents did today.",
  },
  {
    href: "/dashboard/products",
    title: "Products",
    blurb: "Offers, ICP, and playbooks.",
  },
  {
    href: "/dashboard/assets",
    title: "Assets",
    blurb: "Published copy and docs.",
  },
  {
    href: "/dashboard/cac",
    title: "CAC",
    blurb: "Unit economics and spend.",
  },
] as const;

function aedeBaseUrl(): string | null {
  const raw = process.env.AEDE_DASHBOARD_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export default function MakolaOsHomePage() {
  const aede = aedeBaseUrl();

  const aedeLinks = aede
    ? [
        {
          href: `${aede}/compose`,
          title: "Compose & publish",
          blurb: "Write, AI-generate, schedule, and post.",
        },
        {
          href: `${aede}/analytics`,
          title: "Analytics",
          blurb: "What published and how it performed.",
        },
        {
          href: `${aede}/videos`,
          title: "Videos",
          blurb: "Generate, edit, and autopost video.",
        },
        {
          href: `${aede}/review`,
          title: "Review queue",
          blurb: "Approve posts before they go live.",
        },
        {
          href: `${aede}/`,
          title: "AEDE home",
          blurb: "Full publishing dashboard.",
        },
      ]
    : [];

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            {BRAND.platform}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
            {BRAND.osName}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            {BRAND.tagline} Phone and sales in one place. Social publishing
            opens in AEDE when connected — each app still works on its own.
          </p>
        </div>

        <section className="mb-12">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Sales & phone
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MAKOLA_SECTIONS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-surface-border bg-surface-raised p-5 transition-colors hover:border-accent/40"
              >
                <p className="text-base font-medium text-zinc-100">{item.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{item.blurb}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Publishing (AEDE)
          </h2>
          {aede ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {aedeLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-surface-border bg-surface-raised p-5 transition-colors hover:border-accent/40"
                >
                  <p className="text-base font-medium text-zinc-100">
                    {item.title}
                    <span className="ml-2 text-xs font-normal text-zinc-500">↗</span>
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">{item.blurb}</p>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-surface-border bg-surface-raised/50 p-6 text-sm text-zinc-500">
              <p className="text-zinc-300">AEDE is not linked yet.</p>
              <p className="mt-2 leading-relaxed">
                Set <code className="text-zinc-400">AEDE_DASHBOARD_URL</code> in
                the Makola env (e.g.{" "}
                <code className="text-zinc-400">https://your-aede-host</code>) to
                show Compose, Analytics, Videos, and Review here. Makola keeps
                working without it.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
