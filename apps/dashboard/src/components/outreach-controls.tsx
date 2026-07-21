"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface OutreachControlsProps {
  initialPaused: boolean;
  initialMode: "automatic" | "triggered";
  queuedCount: number;
  emailsSentToday: number;
  pendingJobs: number;
  resend: {
    domain: string | null;
    status: string;
    detail?: string;
  };
}

export function OutreachControls({
  initialPaused,
  initialMode,
  queuedCount,
  emailsSentToday,
  pendingJobs,
  resend,
}: OutreachControlsProps) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState<"pause" | "mode" | "push" | "force" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function togglePause() {
    setLoading("pause");
    const next = !paused;
    try {
      const res = await fetch("/api/system/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      if (res.ok) {
        setPaused(next);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function toggleMode() {
    setLoading("mode");
    const next = mode === "triggered" ? "automatic" : "triggered";
    try {
      const res = await fetch("/api/system/outreach-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (res.ok) {
        setMode(next);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function pushBatch() {
    setLoading("push");
    setMessage(null);
    try {
      const res = await fetch("/api/system/trigger-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { ok?: boolean; batchSize?: number; error?: string };
      if (res.ok && data.ok) {
        setMessage(`Queued ${data.batchSize ?? 0} sends — worker picks up in ~5s`);
        router.refresh();
      } else {
        setMessage(data.error ?? "Push failed");
      }
    } finally {
      setLoading(null);
    }
  }

  async function forceRun() {
    if (
      !window.confirm(
        "Force today's pipeline now?\n\nThis re-queues lead gen, scoring, and outreach (up to 10 sends). Contacts emailed in the last 20h are skipped.",
      )
    ) {
      return;
    }
    setLoading("force");
    setMessage(null);
    try {
      const res = await fetch("/api/system/force-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 10, resetSendCounter: true }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        today?: string;
        jobs?: string[];
        error?: string;
      };
      if (res.ok && data.ok) {
        setMessage(`Forced ${data.today} — ${data.jobs?.length ?? 0} jobs queued`);
        router.refresh();
      } else {
        setMessage(data.error ?? "Force run failed");
      }
    } finally {
      setLoading(null);
    }
  }

  const resendOk = resend.status === "verified" || resend.status === "mock";
  const resendLabel = resend.domain
    ? `${resend.domain}: ${resend.status}`
    : `resend: ${resend.status}`;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span
          title={resend.detail ?? resendLabel}
          className={`rounded-lg border px-3 py-2 text-xs font-medium ${
            resendOk
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {resendLabel}
        </span>

        <button
          type="button"
          onClick={toggleMode}
          disabled={loading !== null}
          className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
            mode === "triggered"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-surface-border bg-surface-raised text-zinc-400"
          }`}
        >
          {loading === "mode"
            ? "…"
            : mode === "triggered"
              ? "Mode: Triggered"
              : "Mode: Automatic"}
        </button>

        <button
          type="button"
          onClick={togglePause}
          disabled={loading !== null}
          className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
            paused
              ? "border-red-500/50 bg-red-500/10 text-red-400"
              : "border-accent/30 bg-accent/10 text-accent"
          }`}
        >
          {loading === "pause" ? "…" : paused ? "Paused" : "Live"}
        </button>

        {mode === "triggered" && (
          <button
            type="button"
            onClick={pushBatch}
            disabled={loading !== null || paused || queuedCount === 0}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading === "push" ? "Pushing…" : `Push ${Math.min(queuedCount, 5)} now`}
          </button>
        )}

        <button
          type="button"
          onClick={forceRun}
          disabled={loading !== null || paused || !resendOk}
          className="rounded-lg border border-zinc-500/40 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading === "force" ? "Forcing…" : "Force run"}
        </button>
      </div>

      <p className="max-w-md text-right text-xs text-zinc-600">
        {queuedCount} queued · {emailsSentToday} sent today · {pendingJobs} jobs pending
        {mode === "triggered"
          ? " · cron won't send until you push"
          : " · automatic 08:00 UTC"}
        {message ? ` · ${message}` : ""}
      </p>
    </div>
  );
}
