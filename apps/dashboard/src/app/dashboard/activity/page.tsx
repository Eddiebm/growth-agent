import Link from "next/link";
import { getActivities } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const activities = await getActivities(100);

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-6">
        <h1 className="text-lg font-semibold">Activity feed</h1>
        <p className="mt-1 text-sm text-zinc-500">Last 100 agent actions</p>
        <ul className="mt-6 space-y-2">
          {activities.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase text-accent">{a.type}</span>
                <time className="text-xs text-zinc-600">
                  {new Date(a.occurredAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-sm text-zinc-300">
                {a.subject ?? a.body?.slice(0, 120) ?? "—"}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                {a.agentId && `${a.agentId} · `}
                {a.contactEmail ?? a.companyName ?? ""}
              </p>
            </li>
          ))}
        </ul>
        <Link href="/dashboard" className="mt-8 inline-block text-sm text-accent hover:underline">
          ← Pipeline
        </Link>
      </main>
    </div>
  );
}
