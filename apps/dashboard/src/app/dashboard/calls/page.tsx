import { DashboardNav } from "@/components/dashboard-nav";
import { CallsPanel } from "@/components/calls-panel";
import { getRecentVoiceCalls, getVoiceCostMetrics } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const [calls, costs] = await Promise.all([getRecentVoiceCalls(100), getVoiceCostMetrics()]);

  const cards = [
    { label: "Calls today", value: String(costs.callsToday) },
    { label: "Completed", value: String(costs.completedToday) },
    {
      label: "Talk time",
      value: `${Math.floor(costs.durationSecondsToday / 60)}m`,
    },
    {
      label: "Est. cost today",
      value: `$${(costs.costCentsToday / 100).toFixed(2)}`,
    },
    {
      label: "Cost / completed",
      value:
        costs.costPerCompletedCents != null
          ? `$${(costs.costPerCompletedCents / 100).toFixed(2)}`
          : "—",
    },
  ];

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Voice calls</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Warm follow-ups after hot email replies — costs are estimated when Vapi omits pricing.
          </p>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
            </div>
          ))}
        </div>
        <CallsPanel calls={calls} />
      </main>
    </div>
  );
}
