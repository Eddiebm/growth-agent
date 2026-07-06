"use client";

import { useState } from "react";

interface SignupFormProps {
  productSlug?: string;
}

export function SignupForm({ productSlug }: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
        const v = params.get(key);
        if (v) utm[key] = v;
      }

      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, company, utm, productSlug }),
      });
      if (!res.ok) throw new Error("Signup failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="mt-6 rounded-lg bg-accent/10 px-4 py-3 text-sm text-accent">
        Thanks — we&apos;ll be in touch within 24 hours.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
      />
      <input
        type="email"
        required
        placeholder="Work email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
      />
      <input
        type="text"
        placeholder="Company (optional)"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-black hover:bg-accent-muted disabled:opacity-50"
      >
        {status === "loading" ? "Sending…" : "Request info"}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-400">Something went wrong. Try again.</p>
      )}
    </form>
  );
}
