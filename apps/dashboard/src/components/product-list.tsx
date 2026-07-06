"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GlobalCacDefaults } from "@/lib/db";
import type { ProductRow } from "@/lib/queries";
import {
  computeProductCac,
  formatUsd,
  type BillingPeriod,
} from "../../../../packages/economics/cac";

interface ProductListProps {
  products: ProductRow[];
  globalCacDefaults: GlobalCacDefaults;
}

const STATUS_OPTIONS = ["active", "beta", "paused", "archived"] as const;

function billingFromString(b: string | null): BillingPeriod {
  if (b === "annual" || b === "one_time" || b === "monthly") return b;
  return "monthly";
}

export function ProductList({ products, globalCacDefaults }: ProductListProps) {
  const [items, setItems] = useState(products);
  const [busy, setBusy] = useState<string | null>(null);

  const activePricedCount = items.filter(
    (p) =>
      p.priceCents != null &&
      p.priceCents > 0 &&
      (p.status === "active" || p.status === "beta"),
  ).length;

  const cacById = useMemo(() => {
    const share = Math.max(activePricedCount, 1);
    const map = new Map<string, ReturnType<typeof computeProductCac>>();
    for (const p of items) {
      if (!p.priceCents || p.priceCents <= 0) continue;
      map.set(
        p.id,
        computeProductCac(
          p.priceCents,
          billingFromString(p.billing),
          globalCacDefaults,
          p.cacAssumptions,
          share,
        ),
      );
    }
    return map;
  }, [items, globalCacDefaults, activePricedCount]);

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

  async function savePitch(id: string, laymanPitch: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laymanPitch }),
      });
      if (!res.ok) throw new Error("update failed");
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, laymanPitch: laymanPitch.trim() || null } : p)),
      );
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
            <th className="min-w-[280px] px-4 py-3">10-second pitch</th>
            <th className="px-4 py-3">CAC</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Leads</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const cac = cacById.get(p.id);
            return (
            <tr key={p.id} className="border-b border-surface-border/50 align-top last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-zinc-500">{p.repo ?? p.slug}</p>
                {p.landingPath && (
                  <a href={p.landingPath} className="mt-1 inline-block text-xs text-accent hover:underline">
                    {p.landingPath}
                  </a>
                )}
              </td>
              <td className="px-4 py-3">
                <PitchEditor
                  value={p.laymanPitch ?? ""}
                  disabled={busy === p.id}
                  onSave={(pitch) => void savePitch(p.id, pitch)}
                />
              </td>
              <td className="px-4 py-3">
                {cac?.fullyLoadedCac != null ? (
                  <div>
                    <p
                      className={`font-medium tabular-nums ${
                        cac.healthy ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {formatUsd(cac.fullyLoadedCac)}
                    </p>
                    <Link
                      href={`/dashboard/cac?product=${p.slug}`}
                      className="text-xs text-zinc-500 hover:text-accent"
                    >
                      Edit assumptions
                    </Link>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PitchEditor({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (pitch: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="space-y-2">
      <textarea
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="What is it, and what does it do — in plain English, ~10 seconds to read."
        rows={3}
        className="w-full min-w-[260px] resize-y rounded border border-surface-border bg-surface px-2 py-1.5 text-xs leading-relaxed text-zinc-300 outline-none focus:border-accent"
      />
      {dirty && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(draft)}
          className="rounded bg-accent/15 px-2 py-1 text-xs text-accent hover:bg-accent/25 disabled:opacity-50"
        >
          Save pitch
        </button>
      )}
    </div>
  );
}
