"use client";

import { useState } from "react";
import type { ProductRow } from "@/lib/queries";

interface ProductListProps {
  products: ProductRow[];
}

const STATUS_OPTIONS = ["active", "beta", "paused", "archived"] as const;

export function ProductList({ products }: ProductListProps) {
  const [items, setItems] = useState(products);
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("update failed");
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this product from the catalog?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setItems((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-surface-border bg-surface-raised/50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Leads</th>
            <th className="px-4 py-3">Landing</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-b border-surface-border/50 last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-zinc-500">{p.repo ?? p.slug}</p>
                {p.description && (
                  <p className="mt-1 text-xs text-zinc-600 line-clamp-2">{p.description}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <select
                  value={p.status}
                  disabled={busy === p.id}
                  onChange={(e) => void setStatus(p.id, e.target.value)}
                  className="rounded border border-surface-border bg-surface px-2 py-1 text-xs"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-zinc-400">{p.contactCount}</td>
              <td className="px-4 py-3">
                {p.landingPath && (
                  <a href={p.landingPath} className="text-xs text-accent hover:underline">
                    {p.landingPath}
                  </a>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => void remove(p.id)}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
