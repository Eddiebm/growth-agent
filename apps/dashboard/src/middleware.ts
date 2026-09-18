import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECRET = process.env.DASHBOARD_SECRET;
// Optional shared secret for trusted service-to-service calls (e.g. an
// internal worker or cron job) that can't hold a browser session cookie.
// Nothing in this repo currently calls the dashboard's own /api routes this
// way (the worker service in apps/api has its own WORKER_API_KEY-gated
// endpoints), but this gives future internal callers a documented path that
// doesn't require them to fake a browser cookie.
const WORKER_API_KEY = process.env.WORKER_API_KEY;

// Paths that must stay reachable without a dashboard session:
//  - /dashboard/login: the login page itself (would otherwise redirect to itself)
//  - /api/auth/login: issues the growth_session cookie in the first place
//  - /api/signup: public lead-capture endpoint used by marketing pages
//  - /api/answer-share/*: the separate, public-facing AnswerShare product.
//    It has its own per-organization session cookie (AS_COOKIE) that each
//    route already checks — it is not part of the internal admin dashboard
//    and must not require DASHBOARD_SECRET. This includes the Stripe
//    webhook, which authenticates via the Stripe signature header instead.
const PUBLIC_PATHS = new Set(["/dashboard/login", "/api/auth/login", "/api/signup"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/answer-share/")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  if (!SECRET) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const isGated = pathname.startsWith("/dashboard") || pathname.startsWith("/api");
  if (!isGated) return NextResponse.next();
  if (isPublicPath(pathname)) return NextResponse.next();

  const apiKey = request.headers.get("x-api-key");
  if (WORKER_API_KEY && apiKey === WORKER_API_KEY) return NextResponse.next();

  // NOTE: the session cookie currently stores the raw DASHBOARD_SECRET value
  // rather than a signed/derived token. That means the cookie value itself
  // is equivalent to the shared secret (e.g. it would appear as-is in
  // request logs or browser storage). Tracked as a follow-up — a proper fix
  // is to issue a signed, expiring session token from /api/auth/login
  // instead of echoing the secret back as the cookie value.
  const session = request.cookies.get("growth_session")?.value;
  if (session === SECRET) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/dashboard/login", request.url);
  login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
