import Link from "next/link";
import { BRAND } from "@/lib/brand";

const nav = [
  { href: "/answer-share/dashboard", label: "Dashboard" },
  { href: "/answer-share/questions", label: "Questions" },
  { href: "/answer-share/competitors", label: "Competitors" },
  { href: "/answer-share/actions", label: "Actions" },
  { href: "/answer-share/experiments", label: "Experiments" },
  { href: "/answer-share/settings", label: "Settings" },
];

export function AnswerShareShell({
  children,
  demo = false,
  title,
}: {
  children: React.ReactNode;
  demo?: boolean;
  title?: string;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>
      <header className="border-b border-surface-border bg-surface-raised/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/answer-share" className="text-lg font-semibold tracking-tight">
              AnswerShare <span className="text-zinc-500">by {BRAND.name}</span>
            </Link>
            {title ? <p className="text-sm text-zinc-500">{title}</p> : null}
          </div>
          <nav aria-label="AnswerShare" className="flex flex-wrap gap-3">
            {nav.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded px-2 py-1 text-sm text-zinc-400 hover:text-zinc-100 focus:outline focus:outline-2 focus:outline-accent"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        {demo ? (
          <div
            role="status"
            className="border-t border-amber-500/30 bg-amber-500/10 px-6 py-2 text-center text-sm text-amber-100"
          >
            Demo Data — results are seeded for exploration and are not live AI observations.
          </div>
        ) : null}
      </header>
      <main id="main" className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
