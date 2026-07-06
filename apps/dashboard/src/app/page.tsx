import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { getActiveProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Growth Agent — AI products for agencies & operators",
  description: "Portfolio of AI agents — each lead gets matched to exactly one product.",
};

function formatPrice(cents: number | null, billing: string | null): string | null {
  if (cents == null) return null;
  const dollars = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  if (billing === "monthly") return `${dollars}/mo`;
  if (billing === "annual") return `${dollars}/yr`;
  return dollars;
}

export default async function LandingPage() {
  const products = await getActiveProducts();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-surface-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-semibold tracking-tight">Growth Agent</span>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-accent">
            Dashboard →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Autonomous marketing · surgical routing
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            One lead. One product. No blast.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            We match each prospect to the single best-fit offer from our catalog — then run
            personalized outreach with that product&apos;s playbook only.
          </p>
        </div>

        <section className="mt-16">
          <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Active products
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link
                key={p.id}
                href={p.landingPath ?? `/p/${p.slug}`}
                className="rounded-xl border border-surface-border bg-surface-raised p-6 transition hover:border-accent/40"
              >
                <p className="font-medium">{p.name}</p>
                {formatPrice(p.priceCents, p.billing) && (
                  <p className="mt-1 text-sm text-accent">
                    {formatPrice(p.priceCents, p.billing)}
                  </p>
                )}
                <p className="mt-3 text-sm text-zinc-500 line-clamp-3">
                  {p.description ?? "Learn more →"}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-12 rounded-xl border border-surface-border bg-surface-raised p-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-lg font-semibold">Not sure which fits?</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Leave your email — we&apos;ll score your profile and route you to the right product.
            </p>
          </div>
          <SignupForm />
        </section>

        <section className="mt-24 border-t border-surface-border pt-16">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-zinc-500">
            How routing works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              { step: "1", title: "Score", desc: "Lead matched against active product ICPs" },
              { step: "2", title: "Assign", desc: "One product_id locked on the contact" },
              { step: "3", title: "Outreach", desc: "Copy uses only that product's playbook" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                  {item.step}
                </div>
                <h3 className="mt-4 font-medium">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-surface-border py-8 text-center text-xs text-zinc-600">
        Growth Agent · Built by Eddie Bannerman-Menson
      </footer>
    </div>
  );
}
