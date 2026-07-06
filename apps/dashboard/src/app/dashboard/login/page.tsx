"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push(searchParams.get("from") ?? "/dashboard");
      router.refresh();
    } else {
      setError("Invalid password");
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-8 max-w-sm space-y-4">
      <input
        type="password"
        placeholder="Dashboard password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm"
      />
      <button
        type="submit"
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-black"
      >
        Sign in
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-md px-6 text-center">
        <h1 className="text-xl font-semibold">Growth Agent</h1>
        <p className="mt-2 text-sm text-zinc-500">Operator dashboard</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
