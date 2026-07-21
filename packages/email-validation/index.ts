/** Shared outreach email gate — rejects scrape junk (images, noreply, fake TLDs). */

const FILE_EXT_TLDS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "svg",
  "css",
  "js",
  "map",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "ico",
  "pdf",
  "mp4",
  "webm",
]);

const SKIP_SUBSTRINGS = [
  "example.com",
  "example.org",
  "sentry",
  "wixpress",
  "godaddy",
  "noreply@",
  "no-reply@",
  "donotreply@",
  "do-not-reply@",
  "mailer-daemon",
  "postmaster@",
];

const BASIC_EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/** True if this address is safe to store and email for outreach. */
export function isValidOutreachEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  if (!BASIC_EMAIL_RE.test(lower)) return false;
  if (SKIP_SUBSTRINGS.some((p) => lower.includes(p))) return false;

  const tld = lower.split(".").pop() ?? "";
  if (FILE_EXT_TLDS.has(tld)) return false;

  const [local, host] = lower.split("@");
  if (!local || !host) return false;

  // Image/CDN style locals: "about-baby-edit-288x300@2x.avif" style hosts already caught;
  // also reject locals that look like asset filenames.
  if (/\d+x\d+/.test(local)) return false;
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(local)) return false;

  // Host must have a real-looking domain (not "2x.avif")
  const hostParts = host.split(".");
  if (hostParts.length < 2) return false;
  if (hostParts.some((p) => !p || p.length > 63)) return false;

  return true;
}

export function normalizeOutreachEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  return isValidOutreachEmail(trimmed) ? trimmed : null;
}
