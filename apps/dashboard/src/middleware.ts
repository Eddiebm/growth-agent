import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECRET = process.env.DASHBOARD_SECRET;

export function middleware(request: NextRequest) {
  if (!SECRET) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();
  if (pathname === "/dashboard/login") return NextResponse.next();

  const session = request.cookies.get("growth_session")?.value;
  if (session === SECRET) return NextResponse.next();

  const login = new URL("/dashboard/login", request.url);
  login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
