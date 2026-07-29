import type { VoiceCallRow } from "@/lib/db";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCost(cents: number | null): string {
  if (cents == null || cents === 0) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function CallsPanel({ calls }: { calls: VoiceCallRow[] }) {
  if (calls.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-8 text-center text-sm text-zinc-500">
        No voice calls yet. Warm follow-ups appear here after hot email replies.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-surface-border bg-surface-raised text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Disposition</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 font-medium">Cost</th>
            <th className="px-4 py-3 font-medium">Recording</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id} className="border-b border-surface-border/60 hover:bg-white/5">
              <td className="px-4 py-3 tabular-nums text-zinc-400">
                {new Date(call.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-100">
                  {call.contactName ?? call.contactEmail ?? "Unknown"}
                </div>
                <div className="text-xs text-zinc-500">{call.companyName}</div>
              </td>
              <td className="px-4 py-3">
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                  {call.status}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-300">{call.disposition ?? "—"}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-300">
                {formatDuration(call.durationSeconds)}
              </td>
              <td className="px-4 py-3 tabular-nums text-zinc-300">
                {formatCost(call.costCents)}
              </td>
              <td className="px-4 py-3">
                {call.recordingUrl ? (
                  <a
                    href={call.recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
