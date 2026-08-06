import {
  getActiveProducts,
  getMetrics,
  getPendingApprovals,
  getPipelineContacts,
  getRecentVoiceCalls,
  getSystemStatus,
  getWeeklyMetrics,
  groupContactsByColumn,
  PIPELINE_COLUMNS,
} from "@/lib/db";
import { ApprovalQueue } from "@/components/approval-queue";
import { CallsPanel } from "@/components/calls-panel";
import { DashboardNav } from "@/components/dashboard-nav";
import { GoalTracker } from "@/components/goal-tracker";
import { OutreachControls } from "@/components/outreach-controls";
import { MetricsHeader } from "@/components/metrics-header";
import { PipelineBoard } from "@/components/pipeline-board";
import { ProductFilter } from "@/components/product-filter";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ product?: string }>;
}

export default async function DashboardHomePage({ searchParams }: PageProps) {
  const { product: productSlug } = await searchParams;

  const [contacts, approvals, metrics, weekly, system, products, recentCalls] =
    await Promise.all([
      getPipelineContacts(productSlug),
      getPendingApprovals(),
      getMetrics(),
      getWeeklyMetrics(),
      getSystemStatus(),
      getActiveProducts(),
      getRecentVoiceCalls(5),
    ]);

  const grouped = groupContactsByColumn(contacts);

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <MetricsHeader metrics={metrics} />
          <div className="flex flex-wrap items-center gap-4">
            <ProductFilter
              products={products.map((p) => ({ slug: p.slug, name: p.name }))}
              current={productSlug}
            />
            <OutreachControls
              initialPaused={system.outreachPaused}
              initialMode={system.outreachMode}
              queuedCount={system.queuedCount}
              emailsSentToday={system.emailsSentToday}
              pendingJobs={system.pendingJobs}
              resend={system.resend}
            />
          </div>
        </div>
        {system.outreachPaused ? (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Kill switch is ON — all outreach sends are paused. Resume from the
            controls above when ready.
          </div>
        ) : null}
        <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            <PipelineBoard columns={PIPELINE_COLUMNS} grouped={grouped} />
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                  Recent voice calls
                </h2>
                <Link href="/dashboard/calls" className="text-sm text-accent hover:underline">
                  View all →
                </Link>
              </div>
              <CallsPanel calls={recentCalls} />
            </section>
          </div>
          <div className="space-y-6">
            <ApprovalQueue approvals={approvals} />
            <GoalTracker weekly={weekly} />
          </div>
        </div>
      </main>
    </div>
  );
}
