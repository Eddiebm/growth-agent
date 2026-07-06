"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProductFilterProps {
  products: { slug: string; name: string }[];
  current?: string;
}

export function ProductFilter({ products, current }: ProductFilterProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-zinc-500">Product</span>
      <select
        value={current ?? ""}
        onChange={(e) => {
          const slug = e.target.value;
          router.push(slug ? `/dashboard?product=${slug}` : "/dashboard");
        }}
        className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
      >
        <option value="">All products</option>
        {products.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name}
          </option>
        ))}
      </select>
      <Link href="/dashboard/products" className="text-xs text-accent hover:underline">
        Manage →
      </Link>
    </div>
  );
}
