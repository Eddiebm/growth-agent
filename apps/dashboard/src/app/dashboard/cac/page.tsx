import { DashboardNav } from "@/components/dashboard-nav";
import { ProductCacOverview } from "@/components/product-cac-overview";
import { getGlobalCacDefaults, getProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ product?: string }>;
}

export default async function CacPage({ searchParams }: PageProps) {
  const { product: highlightSlug } = await searchParams;
  const [products, globalDefaults] = await Promise.all([
    getProducts(),
    getGlobalCacDefaults(),
  ]);

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-8">
          <h1 className="text-xl font-semibold">CAC by product</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Every product in your catalog gets its own customer acquisition cost. Shared tool
            spend is split across active priced products; each product has its own funnel
            assumptions.
          </p>
        </div>
        <ProductCacOverview
          products={products}
          initialGlobal={globalDefaults}
          highlightSlug={highlightSlug}
        />
      </main>
    </div>
  );
}
