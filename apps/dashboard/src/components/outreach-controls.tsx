"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface OutreachControlsProps {
  initialPaused: boolean;
  initialMode: "automatic" | "triggered";
  queuedCount: number;
}

export function OutreachControls({
  initialPaused,
  initialMode,
  queuedCount,
}: OutreachControlsProps) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState<"pause" | "mode" | "push" | null>(null);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

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
    setPushMessage(null);
    try {
      const res = await fetch("/api/system/trigger-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { ok?: boolean; batchSize?: number; error?: string };
      if (res.ok && data.ok) {
        setPushMessage(`Queued ${data.batchSize ?? 0} sends — worker picks up in ~5s`);
        router.refresh();
      } else {
        setPushMessage(data.error ?? "Push failed");
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
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
      </div>

      <p className="max-w-xs text-right text-xs text-zinc-600">
        {mode === "triggered"
          ? `${queuedCount} queued · cron won't send until you push`
          : "Automatic · cron sends daily at 08:00 UTC"}
        {pushMessage ? ` · ${pushMessage}` : ""}
      </p>
    </div>
  );
}
