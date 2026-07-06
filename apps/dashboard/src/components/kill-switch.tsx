"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface KillSwitchProps {
  initialPaused: boolean;
}

export function KillSwitch({ initialPaused }: KillSwitchProps) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
        paused
          ? "border-red-500/50 bg-red-500/10 text-red-400"
          : "border-accent/30 bg-accent/10 text-accent"
      }`}
    >
      {loading ? "…" : paused ? "Outreach PAUSED — Resume" : "Outreach active — Pause"}
    </button>
  );
}
