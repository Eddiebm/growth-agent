import { DashboardNav } from "@/components/dashboard-nav";
import { ProductList } from "@/components/product-list";
import { getProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="mx-auto max-w-[1200px] px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Product catalog</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Activate 2–3 products at a time. Each lead gets routed to exactly one product.
          </p>
        </div>
        <ProductList products={products} />
      </main>
    </div>
  );
}
