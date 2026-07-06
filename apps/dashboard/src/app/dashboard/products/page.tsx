import { DashboardNav } from "@/components/dashboard-nav";
import { ProductList } from "@/components/product-list";
import { getGlobalCacDefaults, getProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [products, globalDefaults] = await Promise.all([
    getProducts(),
    getGlobalCacDefaults(),
  ]);

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Product catalog</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Activate 2–3 products at a time. Each lead gets routed to exactly one product.
              Edit the <span className="text-zinc-400">10-second pitch</span> so anyone instantly
              gets what it does.
            </p>
          </div>
          <a
            href="/dashboard/cac"
            className="text-sm text-accent hover:underline"
          >
            CAC for all products →
          </a>
        </div>
        <ProductList products={products} globalCacDefaults={globalDefaults} />
      </main>
    </div>
  );
}
