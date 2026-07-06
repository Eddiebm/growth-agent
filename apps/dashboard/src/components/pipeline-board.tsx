import Link from "next/link";
import type { PipelineContact } from "@/lib/queries";

interface Column {
  key: string;
  label: string;
  statuses: string[];
}

interface PipelineBoardProps {
  columns: Column[];
  grouped: Map<string, PipelineContact[]>;
}

export function PipelineBoard({ columns, grouped }: PipelineBoardProps) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
        Pipeline
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => {
          const cards = grouped.get(col.key) ?? [];
          return (
            <div
              key={col.key}
              className="flex w-56 shrink-0 flex-col rounded-lg border border-surface-border bg-surface-raised/50"
            >
              <div className="flex items-center justify-between border-b border-surface-border px-3 py-2.5">
                <span className="text-sm font-medium">{col.label}</span>
                <span className="rounded-full bg-surface-border px-2 py-0.5 text-xs text-zinc-400">
                  {cards.length}
                </span>
              </div>
              <div className="flex min-h-[200px] flex-col gap-2 p-2">
                {cards.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-zinc-600">Empty</p>
                ) : (
                  cards.map((contact) => (
                    <ContactCard key={contact.id} contact={contact} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ContactCard({ contact }: { contact: PipelineContact }) {
  const name =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email;

  return (
    <Link href={`/dashboard/contacts/${contact.id}`}>
      <article className="rounded-md border border-surface-border bg-surface p-3 transition hover:border-accent/40">
      <p className="truncate text-sm font-medium">{name}</p>
      <p className="truncate text-xs text-zinc-500">{contact.companyName}</p>
      {contact.productName && (
        <p className="mt-1 truncate text-xs text-accent/80">{contact.productName}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        {contact.leadScore != null && (
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
            {contact.leadScore}
          </span>
        )}
        <span className="truncate text-xs text-zinc-600">{contact.status}</span>
      </div>
      </article>
    </Link>
  );
}
