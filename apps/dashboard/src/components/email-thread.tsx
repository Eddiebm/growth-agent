import type { EmailThreadMessage } from "@/lib/queries";

interface EmailThreadProps {
  messages: EmailThreadMessage[];
}

export function EmailThread({ messages }: EmailThreadProps) {
  if (messages.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-600">No emails yet for this contact.</p>
    );
  }

  return (
    <ul className="mt-4 space-y-4">
      {messages.map((message) => (
        <li
          key={message.id}
          className={`rounded-lg border p-4 ${
            message.direction === "outbound"
              ? "border-surface-border bg-surface-raised"
              : "border-accent/30 bg-accent/5"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`text-xs font-medium uppercase tracking-wide ${
                message.direction === "outbound" ? "text-zinc-500" : "text-accent"
              }`}
            >
              {message.direction === "outbound" ? "Sent" : "Reply"}
            </span>
            <time className="text-xs text-zinc-600">
              {message.occurredAt.toLocaleString()}
            </time>
          </div>

          <p className="mt-2 text-sm font-medium text-zinc-200">{message.subject}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
            {message.body || "(empty body)"}
          </p>

          {message.direction === "inbound" && message.classification && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Tag label={message.classification} />
              {message.nextAction && <Tag label={message.nextAction} />}
              {message.urgency && <Tag label={message.urgency} />}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-surface-border px-2 py-0.5 text-xs text-zinc-400">
      {label.replace(/_/g, " ")}
    </span>
  );
}
