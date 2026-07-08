import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactById } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { EmailThread } from "@/components/email-thread";

export const dynamic = "force-dynamic";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) notFound();

  const name =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email;

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-6">
        <Link href="/dashboard" className="text-sm text-accent hover:underline">
          ← Pipeline
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">{name}</h1>
        <p className="text-zinc-400">{contact.companyName} · {contact.email}</p>

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-surface-border bg-surface-raised p-4 text-sm">
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium">{contact.status}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Lead score</dt>
            <dd className="font-medium">{contact.leadScore ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">ICP score</dt>
            <dd className="font-medium">{contact.icpScore ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Domain</dt>
            <dd className="font-medium">{contact.domain}</dd>
          </div>
        </dl>

        {contact.leadScoreReason && (
          <p className="mt-4 text-sm text-zinc-400">{contact.leadScoreReason}</p>
        )}

        <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Email thread
        </h2>
        <EmailThread messages={contact.emailThread} />

        <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Timeline
        </h2>
        <ul className="mt-4 space-y-2">
          {contact.activities.map((a) => (
            <li key={a.id} className="border-l-2 border-surface-border pl-4 py-1">
              <span className="text-xs text-accent">{a.type}</span>
              <p className="text-sm text-zinc-300">{a.subject ?? a.body?.slice(0, 200)}</p>
              <time className="text-xs text-zinc-600">
                {new Date(a.occurredAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
