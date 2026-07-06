import type { DashboardMetrics } from "@/lib/db";

interface MetricsHeaderProps {
  metrics: DashboardMetrics;
}

const items: { key: keyof DashboardMetrics; label: string }[] = [
  { key: "totalContacts", label: "Contacts" },
  { key: "emailsSent", label: "Sent today" },
  { key: "replies", label: "Replies today" },
  { key: "meetingsBooked", label: "Meetings today" },
  { key: "pendingApprovals", label: "Pending approvals" },
];

export function MetricsHeader({ metrics }: MetricsHeaderProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ key, label }) => (
        <div
          key={key}
          className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {key === "pendingApprovals" && metrics[key] > 0 ? (
              <span className="text-amber-400">{metrics[key]}</span>
            ) : (
              metrics[key]
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
