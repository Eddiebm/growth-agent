"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnswerShareShell } from "@/components/answer-share/shell";

export default function FreeAuditOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessName: "",
    websiteUrl: "",
    aliases: "",
    serviceCategory: "hvac",
    city: "St. Louis",
    state: "MO",
    serviceAreas: "",
    phone: "",
    conversionUrl: "",
    gbpUrl: "",
    competitor1: "",
    competitor2: "",
    competitor3: "",
    email: "",
    useDemo: true,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const competitors = [form.competitor1, form.competitor2, form.competitor3]
        .map((n) => n.trim())
        .filter(Boolean)
        .map((name) => ({ name }));

      const res = await fetch("/api/answer-share/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          websiteUrl: form.websiteUrl,
          aliases: form.aliases.split(",").map((s) => s.trim()).filter(Boolean),
          serviceCategory: form.serviceCategory,
          city: form.city,
          state: form.state,
          serviceAreas: form.serviceAreas.split(",").map((s) => s.trim()).filter(Boolean),
          phone: form.phone || undefined,
          conversionUrl: form.conversionUrl || undefined,
          gbpUrl: form.gbpUrl || undefined,
          competitors,
          email: form.email || undefined,
          forceDemo: form.useDemo,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; businessId?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not start onboarding");
        return;
      }
      router.push("/answer-share/onboarding");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  const steps = ["Business", "Location", "Competitors", "Review"];

  return (
    <AnswerShareShell title="Free visibility audit">
      <h1 className="text-2xl font-semibold">Run your free AI visibility audit</h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        We&apos;ll crawl a few pages on your site, propose ten purchase-intent questions, and let you
        approve competitors before testing.
      </p>

      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Onboarding progress">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 text-sm ${
              i === step ? "bg-accent text-black" : "bg-surface-raised text-zinc-400"
            }`}
            aria-current={i === step ? "step" : undefined}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="mt-8 max-w-xl space-y-4 rounded-xl border border-surface-border bg-surface-raised p-6">
        {step === 0 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-medium">Business details</legend>
            <Field label="Business name" id="businessName" value={form.businessName} onChange={(v) => update("businessName", v)} required />
            <Field label="Website URL" id="websiteUrl" value={form.websiteUrl} onChange={(v) => update("websiteUrl", v)} required placeholder="https://yoursite.com" />
            <Field label="Aliases (comma-separated)" id="aliases" value={form.aliases} onChange={(v) => update("aliases", v)} />
            <Field label="Service category" id="serviceCategory" value={form.serviceCategory} onChange={(v) => update("serviceCategory", v)} required />
            <Field label="Email (optional)" id="email" value={form.email} onChange={(v) => update("email", v)} type="email" />
          </fieldset>
        )}
        {step === 1 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-medium">Location &amp; contact</legend>
            <Field label="Primary city" id="city" value={form.city} onChange={(v) => update("city", v)} required />
            <Field label="State" id="state" value={form.state} onChange={(v) => update("state", v)} required />
            <Field label="Service areas / ZIPs (comma-separated)" id="serviceAreas" value={form.serviceAreas} onChange={(v) => update("serviceAreas", v)} />
            <Field label="Phone" id="phone" value={form.phone} onChange={(v) => update("phone", v)} />
            <Field label="Primary conversion URL" id="conversionUrl" value={form.conversionUrl} onChange={(v) => update("conversionUrl", v)} />
            <Field label="Google Business Profile URL (optional)" id="gbpUrl" value={form.gbpUrl} onChange={(v) => update("gbpUrl", v)} />
          </fieldset>
        )}
        {step === 2 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-medium">Known competitors (up to 3)</legend>
            <Field label="Competitor 1" id="c1" value={form.competitor1} onChange={(v) => update("competitor1", v)} />
            <Field label="Competitor 2" id="c2" value={form.competitor2} onChange={(v) => update("competitor2", v)} />
            <Field label="Competitor 3" id="c3" value={form.competitor3} onChange={(v) => update("competitor3", v)} />
            <p className="text-sm text-zinc-500">We&apos;ll also suggest St. Louis HVAC competitors you can approve next.</p>
          </fieldset>
        )}
        {step === 3 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-medium">Review</legend>
            <p className="text-sm text-zinc-300">
              {form.businessName || "(name)"} · {form.websiteUrl || "(website)"} · {form.city},{" "}
              {form.state}
            </p>
            <label className="flex items-start gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={form.useDemo}
                onChange={(e) => update("useDemo", e.target.checked)}
              />
              <span>
                Run in <strong>Demo mode</strong> (recommended without API keys). Results are labeled
                Demo Data and never mixed with live customer audits.
              </span>
            </label>
          </fieldset>
        )}

        {error ? (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={step === 0 || loading}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="min-h-11 rounded-lg border border-surface-border px-4 py-2 text-sm disabled:opacity-40"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={loading || (step === 0 && (!form.businessName || !form.websiteUrl))}
              onClick={() => setStep((s) => s + 1)}
              className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={submit}
              className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              {loading ? "Setting up…" : "Generate questions"}
            </button>
          )}
        </div>
      </div>
    </AnswerShareShell>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-zinc-100 outline-none focus:border-accent"
      />
    </div>
  );
}
