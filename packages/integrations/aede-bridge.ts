/**
 * Optional outbound bridge: Makola → AEDE content hints.
 * If AEDE_CONTENT_HINTS_URL is unset, this is a no-op — Makola runs fully independently.
 */

export type AedeContentHintsPayload = {
  productSlug: string;
  themesSummary: string;
  periodStart?: string;
  periodEnd?: string;
};

export type PostAedeContentHintsResult =
  | { skipped: true; reason: string }
  | { skipped: false; ok: true; status: number }
  | { skipped: false; ok: false; status: number; error: string };

export async function postAedeContentHints(
  payload: AedeContentHintsPayload,
): Promise<PostAedeContentHintsResult> {
  const url = process.env.AEDE_CONTENT_HINTS_URL?.trim();
  if (!url) {
    return { skipped: true, reason: "AEDE_CONTENT_HINTS_URL not set" };
  }

  const secret =
    process.env.AEDE_WEBHOOK_SECRET?.trim() ||
    process.env.MAKOLA_INBOUND_API_KEY?.trim() ||
    "";
  if (!secret) {
    return {
      skipped: true,
      reason: "AEDE_WEBHOOK_SECRET (or MAKOLA_INBOUND_API_KEY) not set",
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.text().catch(() => res.statusText);
      console.error("[AedeBridge] push failed", res.status, error.slice(0, 400));
      return { skipped: false, ok: false, status: res.status, error };
    }
    console.log("[AedeBridge] pushed content hints to AEDE", payload.productSlug);
    return { skipped: false, ok: true, status: res.status };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[AedeBridge] push error", error);
    return { skipped: false, ok: false, status: 0, error };
  }
}

/** Build a short themes summary Makola already has from weekly learning. */
export function buildThemesSummaryFromWeekly(input: {
  summary: string;
  wins: string[];
  losses: string[];
  recommendations: Array<{ type: string; description: string }>;
  playbookWrites?: {
    objectionsWritten?: number;
    dispositionsWritten?: number;
  };
}): string {
  const lines: string[] = [];
  if (input.summary?.trim()) {
    lines.push(input.summary.trim());
  }
  if (input.wins?.length) {
    lines.push("Wins:");
    for (const w of input.wins.slice(0, 5)) lines.push(`- ${w}`);
  }
  if (input.losses?.length) {
    lines.push("Losses / friction:");
    for (const w of input.losses.slice(0, 5)) lines.push(`- ${w}`);
  }
  const messaging = input.recommendations?.filter(
    (r) => r.type === "messaging_change" || r.type.includes("messag"),
  );
  if (messaging?.length) {
    lines.push("Messaging notes:");
    for (const r of messaging.slice(0, 5)) {
      lines.push(`- ${r.description}`);
    }
  }
  if (
    input.playbookWrites &&
    (input.playbookWrites.objectionsWritten ||
      input.playbookWrites.dispositionsWritten)
  ) {
    lines.push(
      `Playbook updates this week: objections=${input.playbookWrites.objectionsWritten ?? 0}, call dispositions=${input.playbookWrites.dispositionsWritten ?? 0}.`,
    );
  }
  return lines.join("\n").slice(0, 11_000);
}
