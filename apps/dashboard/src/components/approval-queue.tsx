"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApprovalItem } from "@/lib/queries";

interface ApprovalQueueProps {
  approvals: ApprovalItem[];
}

export function ApprovalQueue({ approvals }: ApprovalQueueProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Human review
        </h2>
        {approvals.length > 0 ? (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
            {approvals.length} needs review
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        {approvals.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-raised/50 px-4 py-8 text-center text-sm text-zinc-500">
            No pending approvals
          </div>
        ) : (
          approvals.map((item) => <ApprovalCard key={item.id} item={item} />)
        )}
      </div>
    </section>
  );
}

function ApprovalCard({ item }: { item: ApprovalItem }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function resolve(decision: "approved" | "rejected") {
    setLoading(decision === "approved" ? "approve" : "reject");
    try {
      const res = await fetch(`/api/approvals/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const subject =
    typeof item.payload.subject === "string" ? item.payload.subject : null;
  const body =
    typeof item.payload.body === "string"
      ? item.payload.body
      : typeof item.payload.appendBlock === "string"
        ? item.payload.appendBlock
        : typeof item.payload.content === "string"
          ? item.payload.content
          : null;
  const preview = subject ?? (body ? body.slice(0, 160) : item.reason);

  return (
    <article className="rounded-lg border border-amber-500/20 bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
            {item.action.replace(/_/g, " ")}
          </span>
          <span className="rounded border border-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200/80">
            needs human review
          </span>
        </div>
        <span className="text-xs text-zinc-600">{item.agentId}</span>
      </div>

      {(item.contactName || item.companyName) && (
        <p className="mt-2 text-sm font-medium">
          {item.contactName}
          {item.companyName && (
            <span className="font-normal text-zinc-500"> · {item.companyName}</span>
          )}
        </p>
      )}

      {subject ? (
        <p className="mt-2 text-sm font-medium text-zinc-200">Subject: {subject}</p>
      ) : null}

      {preview && !subject ? (
        <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{preview}</p>
      ) : null}

      {body ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-accent hover:underline"
          >
            {expanded ? "Hide body" : "Show full body"}
          </button>
          {expanded ? (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-surface-border bg-surface/60 p-3 text-xs text-zinc-300">
              {body}
            </pre>
          ) : subject ? (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{body}</p>
          ) : null}
        </div>
      ) : null}

      {item.reason && (
        <p className="mt-1 text-xs text-zinc-600">{item.reason}</p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => resolve("approved")}
          className="flex-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-black hover:bg-accent-muted disabled:opacity-50"
        >
          {loading === "approve" ? "…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => resolve("rejected")}
          className="flex-1 rounded-md border border-surface-border px-3 py-1.5 text-sm text-zinc-300 hover:bg-surface disabled:opacity-50"
        >
          {loading === "reject" ? "…" : "Reject"}
        </button>
      </div>
    </article>
  );
}
