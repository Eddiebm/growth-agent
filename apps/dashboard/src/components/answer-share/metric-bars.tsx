export function MetricBars({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Transparent metrics
      </h2>
      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">Visibility component rates</caption>
        <thead>
          <tr className="text-zinc-500">
            <th scope="col" className="py-1">Metric</th>
            <th scope="col" className="py-1">Value</th>
            <th scope="col" className="py-1">
              <span className="sr-only">Bar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = Math.round(Math.max(0, Math.min(1, r.value)) * 100);
            return (
              <tr key={r.label}>
                <td className="py-2 pr-3 text-zinc-300">{r.label}</td>
                <td className="py-2 pr-3 font-medium">{pct}%</td>
                <td className="py-2 w-full">
                  <div
                    className="h-3 rounded bg-surface"
                    role="img"
                    aria-label={`${r.label} ${pct} percent`}
                  >
                    <div
                      className="h-3 rounded bg-accent motion-safe:transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
