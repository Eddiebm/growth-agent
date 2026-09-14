"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/answer-share/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError("That access token isn't valid. Check it and try again.");
        setLoading(false);
        return;
      }
      router.push("/answer-share/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const urlError = params.get("error");

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-xl border border-surface-border bg-surface-raised p-8">
      <Link href="/answer-share" className="text-sm text-zinc-500 hover:text-accent">
        ← AnswerShare
      </Link>
      <h1 className="mt-4 text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Paste the access token you were given for your organization.
      </p>

      {urlError && (
        <p className="mt-4 text-sm text-red-400">That link is no longer valid. Paste your token below.</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="text-zinc-400">Access token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            autoFocus
            className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-accent"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !token.trim()}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-xs text-zinc-500">
        Lost your token? Contact us to have it reset.
      </p>
    </div>
  );
}

export default function AnswerShareLoginPage() {
  return (
    <div className="min-h-screen bg-surface px-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
