import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SignupForm } from "@/components/signup-form";
import { getProductBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.name} — Growth Agent`,
    description: product.laymanPitch ?? product.description ?? undefined,
  };
}

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

export default async function ProductLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.status === "archived") notFound();

  const price = formatPrice(product.priceCents, product.billing);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-surface-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold tracking-tight">
            Growth Agent
          </Link>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-accent">
            Dashboard →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            {price && (
              <p className="text-sm font-medium uppercase tracking-widest text-accent">
                From {price}
              </p>
            )}
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-zinc-300">
              {product.laymanPitch ??
                product.description ??
                "AI-powered solution built for your workflow."}
            </p>
            {product.laymanPitch && product.description && product.description !== product.laymanPitch && (
              <p className="mt-3 text-sm text-zinc-500">{product.description}</p>
            )}
            {product.repo && (
              <p className="mt-4 text-sm text-zinc-500">
                Open source:{" "}
                <a
                  href={`https://github.com/${product.repo}`}
                  className="text-accent hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {product.repo}
                </a>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-raised p-8">
            <h2 className="text-lg font-semibold">Get details</h2>
            <p className="mt-2 text-sm text-zinc-400">
              We&apos;ll route your inquiry to the right playbook — one product, one conversation.
            </p>
            <SignupForm productSlug={slug} />
          </div>
        </div>
      </main>
    </div>
  );
}
