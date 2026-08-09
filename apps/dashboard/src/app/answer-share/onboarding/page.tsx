"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnswerShareShell } from "@/components/answer-share/shell";

interface Q {
  id: string;
  question_text: string;
  intent_category: string;
  status: string;
}
interface C {
  id: string;
  name: string;
  suggested: boolean;
  approved: boolean;
}

export default function OnboardingApprovePage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Q[]>([]);
  const [competitors, setCompetitors] = useState<C[]>([]);
  const [selectedQ, setSelectedQ] = useState<Set<string>>(new Set());
  const [selectedC, setSelectedC] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [status, setStatus] = useState("Loading draft questions…");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/answer-share/setup");
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        questions?: Q[];
        competitors?: C[];
        isDemo?: boolean;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not load setup");
        setLoading(false);
        return;
      }
      setQuestions(data.questions ?? []);
      setCompetitors(data.competitors ?? []);
      setSelectedQ(new Set((data.questions ?? []).map((q) => q.id)));
      setSelectedC(
        new Set(
          (data.competitors ?? [])
            .filter((c) => c.approved || !c.suggested)
            .map((c) => c.id)
            .concat(
              (data.competitors ?? []).filter((c) => c.suggested).slice(0, 3).map((c) => c.id),
            ),
        ),
      );
      setDemo(Boolean(data.isDemo));
      setLoading(false);
      setStatus("Review and approve questions and competitors");
    })();
  }, []);

  async function run() {
    setRunning(true);
    setError(null);
    setStatus("Running audit — this may take a minute…");
    try {
      const res = await fetch("/api/answer-share/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: [...selectedQ],
          competitorIds: [...selectedC],
          runAudit: true,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; auditId?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Audit failed");
        setStatus("Audit failed");
        return;
      }
      setStatus("Audit complete. Opening dashboard…");
      router.push("/answer-share/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setRunning(false);
    }
  }

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  return (
    <AnswerShareShell demo={demo} title="Approve questions & competitors">
      <h1 className="text-2xl font-semibold">Approve before we test</h1>
      <p className="mt-2 text-zinc-400" aria-live="polite">
        {status}
      </p>

      {loading ? <p className="mt-8 text-zinc-500">Loading…</p> : null}
      {error ? (
        <p role="alert" className="mt-4 text-red-300">
          {error}
        </p>
      ) : null}

      {!loading && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="q-heading">
            <h2 id="q-heading" className="text-lg font-semibold">
              Purchase-intent questions
            </h2>
            <ul className="mt-4 space-y-3">
              {questions.map((q) => (
                <li key={q.id}>
                  <label className="flex min-h-11 items-start gap-3 rounded-lg border border-surface-border bg-surface-raised p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5"
                      checked={selectedQ.has(q.id)}
                      onChange={() => toggle(selectedQ, q.id, setSelectedQ)}
                    />
                    <span>
                      <span className="block text-zinc-100">{q.question_text}</span>
                      <span className="text-xs text-zinc-500">{q.intent_category}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="c-heading">
            <h2 id="c-heading" className="text-lg font-semibold">
              Competitors
            </h2>
            <ul className="mt-4 space-y-3">
              {competitors.map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-11 items-start gap-3 rounded-lg border border-surface-border bg-surface-raised p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5"
                      checked={selectedC.has(c.id)}
                      onChange={() => toggle(selectedC, c.id, setSelectedC)}
                    />
                    <span>
                      {c.name}
                      {c.suggested ? (
                        <span className="ml-2 text-xs text-zinc-500">suggested</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <div className="mt-8">
        <button
          type="button"
          disabled={running || loading || selectedQ.size === 0 || selectedC.size === 0}
          onClick={run}
          className="min-h-11 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black disabled:opacity-40"
        >
          {running ? "Running audit…" : "Approve & run audit"}
        </button>
      </div>
    </AnswerShareShell>
  );
}
