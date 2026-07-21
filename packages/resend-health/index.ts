const RESEND_BASE = "https://api.resend.com";

export interface ResendDomainHealth {
  domain: string | null;
  status: "verified" | "pending" | "failed" | "unknown" | "mock" | "missing_key";
  detail?: string;
}

export function fromEmailDomain(from = process.env.RESEND_FROM_EMAIL ?? ""): string | null {
  const match = from.match(/@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Read-only domain status for dashboards (does not trigger verify). */
export async function getResendDomainHealth(): Promise<ResendDomainHealth> {
  if (process.env.MOCK_INTEGRATIONS === "true") {
    return { domain: "mock", status: "mock" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const domain = fromEmailDomain();
  if (!apiKey) return { domain, status: "missing_key", detail: "RESEND_API_KEY not set" };
  if (!domain) return { domain: null, status: "unknown", detail: "RESEND_FROM_EMAIL missing domain" };

  try {
    const res = await fetch(`${RESEND_BASE}/domains`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      return { domain, status: "unknown", detail: `list failed (${res.status})` };
    }
    const body = (await res.json()) as { data?: Array<{ name: string; status: string }> };
    const entry = (body.data ?? []).find((d) => d.name.toLowerCase() === domain);
    if (!entry) return { domain, status: "failed", detail: "domain not registered in Resend" };

    const status = entry.status as ResendDomainHealth["status"];
    if (status === "verified" || status === "pending" || status === "failed") {
      return { domain, status };
    }
    return { domain, status: "unknown", detail: entry.status };
  } catch (err) {
    return {
      domain,
      status: "unknown",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
