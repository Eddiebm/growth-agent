"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ProductRow } from "@/lib/queries";
import type { GlobalCacDefaults } from "@/lib/db";
import {
  computeProductCac,
  DEFAULT_GLOBAL_CAC,
  DEFAULT_PRODUCT_CAC,
  formatUsd,
  parseGlobalCacDefaults,
  type BillingPeriod,
  type ProductCacAssumptions,
} from "../../../../packages/economics/cac";

interface ProductCacOverviewProps {
  products: ProductRow[];
  initialGlobal: GlobalCacDefaults;
  highlightSlug?: string;
}

function billingFromString(b: string | null): BillingPeriod {
  if (b === "annual" || b === "one_time" || b === "monthly") return b;
  return "monthly";
}

function formatPrice(cents: number | null, billing: string | null): string {
  if (cents == null) return "—";
  const base = formatUsd(cents / 100);
  if (billing === "monthly") return `${base}/mo`;
  if (billing === "annual") return `${base}/yr`;
  return base;
}

export function ProductCacOverview({
  products,
  initialGlobal,
  highlightSlug,
}: ProductCacOverviewProps) {
  const [globalDefaults, setGlobalDefaults] = useState(initialGlobal);
  const [items, setItems] = useState(products);
  const [expandedId, setExpandedId] = useState<string | null>(
    products.find((p) => p.slug === highlightSlug)?.id ?? null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"priced" | "active" | "all">("priced");

  const activePricedCount = items.filter(
    (p) =>
      p.priceCents != null &&
      p.priceCents > 0 &&
      (p.status === "active" || p.status === "beta"),
  ).length;

  const visible = items.filter((p) => {
    if (filter === "active") return p.status === "active" || p.status === "beta";
    if (filter === "priced") return p.priceCents != null && p.priceCents > 0;
    return true;
  });

  const rows = useMemo(() => {
    const share = Math.max(activePricedCount, 1);
    return visible.map((p) => {
      if (!p.priceCents || p.priceCents <= 0) {
        return { product: p, results: null };
      }
      const results = computeProductCac(
        p.priceCents,
        billingFromString(p.billing),
        globalDefaults,
        p.cacAssumptions,
        share,
      );
      return { product: p, results };
    });
  }, [visible, globalDefaults, activePricedCount]);

  async function saveGlobal() {
    setBusy("global");
    try {
      const res = await fetch("/api/system/cac-defaults", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(globalDefaults),
      });
      if (!res.ok) throw new Error("save failed");
      setGlobalDefaults(parseGlobalCacDefaults(await res.json()));
    } finally {
      setBusy(null);
    }
  }

  async function saveProductCac(id: string, cacAssumptions: ProductCacAssumptions) {
    setBusy(id);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cacAssumptions }),
      });
      if (!res.ok) throw new Error("save failed");
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, cacAssumptions } : p)),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-surface-border bg-surface-raised p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              Shared tool costs
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              Fixed stack is split across {activePricedCount} active priced product
              {activePricedCount === 1 ? "" : "s"}.
            </p>
          </div>
          <button
            type="button"
            disabled={busy === "global"}
            onClick={() => void saveGlobal()}
            className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-50"
          >
            Save shared defaults
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <GlobalField
            label="Fixed stack / mo"
            value={globalDefaults.monthlyFixedTools}
            onChange={(v) => setGlobalDefaults((g) => ({ ...g, monthlyFixedTools: v }))}
            prefix="$"
          />
          <GlobalField
            label="Enrichment / lead"
            value={globalDefaults.costPerLeadEnrichment}
            onChange={(v) => setGlobalDefaults((g) => ({ ...g, costPerLeadEnrichment: v }))}
            prefix="$"
            step={0.01}
          />
          <GlobalField
            label="Emails / lead"
            value={globalDefaults.emailsPerLead}
            onChange={(v) => setGlobalDefaults((g) => ({ ...g, emailsPerLead: v }))}
          />
          <GlobalField
            label="Cost / email"
            value={globalDefaults.costPerEmail}
            onChange={(v) => setGlobalDefaults((g) => ({ ...g, costPerEmail: v }))}
            prefix="$"
            step={0.001}
          />
          <GlobalField
            label="LLM / lead"
            value={globalDefaults.llmCostPerLead}
            onChange={(v) => setGlobalDefaults((g) => ({ ...g, llmCostPerLead: v }))}
            prefix="$"
            step={0.01}
          />
          <GlobalField
            label="Your hourly rate"
            value={globalDefaults.hourlyRate}
            onChange={(v) => setGlobalDefaults((g) => ({ ...g, hourlyRate: v }))}
            prefix="$"
          />
          <GlobalField
            label="LTV months"
            value={globalDefaults.targetChurnMonths}
            onChange={(v) => setGlobalDefaults((g) => ({ ...g, targetChurnMonths: v }))}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            CAC by product
          </h2>
          <div className="flex gap-1 rounded-lg border border-surface-border p-0.5 text-xs">
            {(
              [
                ["priced", "With price"],
                ["active", "Active only"],
                ["all", "All"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-2.5 py-1 ${
                  filter === key ? "bg-accent/15 text-accent" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-surface-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-border bg-surface-raised/50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">CAC</th>
                <th className="px-4 py-3">Payback</th>
                <th className="px-4 py-3">Closes/mo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, results }) => (
                <ProductCacRow
                  key={product.id}
                  product={product}
                  results={results}
                  expanded={expandedId === product.id}
                  busy={busy === product.id}
                  onToggle={() =>
                    setExpandedId((id) => (id === product.id ? null : product.id))
                  }
                  onSave={(cac) => void saveProductCac(product.id, cac)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ProductCacRow({
  product,
  results,
  expanded,
  busy,
  onToggle,
  onSave,
}: {
  product: ProductRow;
  results: ReturnType<typeof computeProductCac> | null;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onSave: (cac: ProductCacAssumptions) => void;
}) {
  const [draft, setDraft] = useState(product.cacAssumptions);
  const dirty = JSON.stringify(draft) !== JSON.stringify(product.cacAssumptions);

  useEffect(() => {
    setDraft(product.cacAssumptions);
  }, [product.cacAssumptions, product.id]);

  return (
    <>
      <tr className="border-b border-surface-border/50 align-middle">
        <td className="px-4 py-3">
          <p className="font-medium">{product.name}</p>
          <p className="text-xs text-zinc-500">{product.slug}</p>
        </td>
        <td className="px-4 py-3 tabular-nums text-zinc-400">
          {formatPrice(product.priceCents, product.billing)}
        </td>
        <td className="px-4 py-3">
          {results?.fullyLoadedCac != null ? (
            <span
              className={`font-semibold tabular-nums ${
                results.healthy ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {formatUsd(results.fullyLoadedCac)}
            </span>
          ) : (
            <span className="text-xs text-zinc-600">Set price</span>
          )}
        </td>
        <td className="px-4 py-3 tabular-nums text-zinc-400">
          {results?.paybackMonths != null && product.billing !== "one_time"
            ? `${results.paybackMonths.toFixed(1)} mo`
            : results && product.billing === "one_time"
              ? `${results.grossMarginFirstMonthPct?.toFixed(0) ?? "—"}% margin`
              : "—"}
        </td>
        <td className="px-4 py-3 tabular-nums text-zinc-400">
          {results ? results.customersPerMonth.toFixed(2) : "—"}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={onToggle}
            className="text-xs text-accent hover:underline"
          >
            {expanded ? "Close" : "Assumptions"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-surface-border/50 bg-surface-raised/30">
          <td colSpan={6} className="px-4 py-4">
            {!product.priceCents ? (
              <p className="text-sm text-zinc-500">
                Add a price in the database to calculate CAC for this product.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <AssumptionField
                    label="Leads / mo"
                    value={draft.leadsPerMonth}
                    onChange={(v) => setDraft((d) => ({ ...d, leadsPerMonth: v }))}
                  />
                  <AssumptionField
                    label="Sales hrs / mo"
                    value={draft.salesHoursPerMonth}
                    onChange={(v) => setDraft((d) => ({ ...d, salesHoursPerMonth: v }))}
                  />
                  <AssumptionField
                    label="Reply %"
                    value={draft.replyRatePct}
                    onChange={(v) => setDraft((d) => ({ ...d, replyRatePct: v }))}
                    step={0.5}
                  />
                  <AssumptionField
                    label="Reply → mtg %"
                    value={draft.meetingRatePct}
                    onChange={(v) => setDraft((d) => ({ ...d, meetingRatePct: v }))}
                  />
                  <AssumptionField
                    label="Mtg → close %"
                    value={draft.closeRatePct}
                    onChange={(v) => setDraft((d) => ({ ...d, closeRatePct: v }))}
                  />
                </div>
                <div className="rounded-lg border border-surface-border bg-surface p-4 text-xs">
                  <p className="text-zinc-500">{results?.healthNote}</p>
                  {dirty && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSave(draft)}
                      className="mt-3 rounded bg-accent/15 px-2 py-1 text-accent hover:bg-accent/25 disabled:opacity-50"
                    >
                      Save for {product.name}
                    </button>
                  )}
                  <Link
                    href={`/p/${product.slug}`}
                    className="mt-2 block text-accent hover:underline"
                  >
                    View landing →
                  </Link>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function GlobalField({
  label,
  value,
  onChange,
  prefix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  step?: number;
}) {
  return (
    <label className="block text-xs">
      <span className="text-zinc-500">{label}</span>
      <div className="relative mt-1">
        {prefix && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600">
            {prefix}
          </span>
        )}
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={`w-full rounded border border-surface-border bg-surface py-1.5 text-sm tabular-nums outline-none focus:border-accent ${prefix ? "pl-6 pr-2" : "px-2"}`}
        />
      </div>
    </label>
  );
}

function AssumptionField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <label className="block text-xs">
      <span className="text-zinc-500">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded border border-surface-border bg-surface px-2 py-1.5 tabular-nums outline-none focus:border-accent"
      />
    </label>
  );
}

export { DEFAULT_GLOBAL_CAC, DEFAULT_PRODUCT_CAC };
