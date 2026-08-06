"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const KINDS = ["ICP", "OFFER", "VOICE", "PLAYBOOK", "RATE_CARD"] as const;
type Kind = (typeof KINDS)[number];

export interface AssetSnapshot {
  kind: Kind;
  content: string;
  version: number | null;
  source: "published" | "file";
  updatedAt: string | null;
  updatedBy: string | null;
}

interface AssetEditorProps {
  productSlug: string;
  assets: AssetSnapshot[];
}

export function AssetEditor({ productSlug, assets }: AssetEditorProps) {
  const router = useRouter();
  const byKind = useMemo(() => {
    const map = new Map<Kind, AssetSnapshot>();
    for (const a of assets) map.set(a.kind, a);
    return map;
  }, [assets]);

  const [kind, setKind] = useState<Kind>("PLAYBOOK");
  const current = byKind.get(kind);
  const [content, setContent] = useState(current?.content ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function selectKind(next: Kind) {
    setKind(next);
    setContent(byKind.get(next)?.content ?? "");
    setMessage(null);
  }

  async function publish() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug, kind, content }),
      });
      const data = (await res.json()) as { ok?: boolean; version?: number; error?: string };
      if (res.ok && data.ok) {
        setMessage(`Published v${data.version ?? "?"}`);
        router.refresh();
      } else {
        setMessage(data.error ?? "Publish failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const snap = byKind.get(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => selectKind(k)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                kind === k
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-surface-border bg-surface-raised text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {k}
              {snap?.source === "published" ? (
                <span className="ml-1 text-[10px] text-zinc-500">v{snap.version}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <p>
          Source: {current?.source === "published" ? "operator-published" : "repo file fallback"}
          {current?.updatedAt
            ? ` · updated ${new Date(current.updatedAt).toLocaleString()}`
            : ""}
          {current?.updatedBy ? ` · by ${current.updatedBy}` : ""}
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={publish}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-black hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? "Publishing…" : "Publish version"}
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={24}
        className="w-full rounded-lg border border-surface-border bg-surface-raised px-4 py-3 font-mono text-sm text-zinc-200 outline-none focus:border-accent/40"
        spellCheck={false}
      />

      {message ? <p className="text-sm text-zinc-400">{message}</p> : null}
    </div>
  );
}
