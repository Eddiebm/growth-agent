import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ORIGINAL_ENV = { ...process.env };

async function loadMiddleware(env: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  // middleware.ts reads DASHBOARD_SECRET / WORKER_API_KEY at module load
  // time, so each scenario needs a fresh module instance.
  vi.resetModules();
  const mod = await import("./middleware");
  return mod.middleware as (req: NextRequest) => Response;
}

function isPassThrough(res: Response): boolean {
  return res.headers.get("x-middleware-next") === "1";
}

const SECRET = "test-dashboard-secret";

describe("dashboard middleware auth", () => {
  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) delete process.env[key];
    }
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("rejects an unauthenticated POST to /api/approvals/:id", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: SECRET, WORKER_API_KEY: undefined });
    const req = new NextRequest("https://dashboard.example.com/api/approvals/abc-123", {
      method: "POST",
    });
    const res = middleware(req);
    expect(res.status).toBe(401);
    expect(isPassThrough(res)).toBe(false);
  });

  it("rejects an unauthenticated POST to /api/system/kill-switch", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: SECRET, WORKER_API_KEY: undefined });
    const req = new NextRequest("https://dashboard.example.com/api/system/kill-switch", {
      method: "POST",
    });
    const res = middleware(req);
    expect(res.status).toBe(401);
    expect(isPassThrough(res)).toBe(false);
  });

  it("rejects an unauthenticated POST to other /api/system/* routes", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: SECRET, WORKER_API_KEY: undefined });
    for (const path of ["/api/system/force-run", "/api/system/trigger-outreach", "/api/system/outreach-mode"]) {
      const req = new NextRequest(`https://dashboard.example.com${path}`, { method: "POST" });
      const res = middleware(req);
      expect(res.status, `${path} should be 401`).toBe(401);
    }
  });

  it("allows a request carrying the correct growth_session cookie", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: SECRET, WORKER_API_KEY: undefined });
    const req = new NextRequest("https://dashboard.example.com/api/system/kill-switch", {
      method: "POST",
      headers: { cookie: `growth_session=${SECRET}` },
    });
    const res = middleware(req);
    expect(isPassThrough(res)).toBe(true);
  });

  it("rejects a request carrying the wrong session cookie value", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: SECRET, WORKER_API_KEY: undefined });
    const req = new NextRequest("https://dashboard.example.com/api/approvals/abc-123", {
      method: "POST",
      headers: { cookie: "growth_session=not-the-secret" },
    });
    const res = middleware(req);
    expect(res.status).toBe(401);
  });

  it("allows a request carrying the WORKER_API_KEY header, without a cookie", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: SECRET, WORKER_API_KEY: "worker-key" });
    const req = new NextRequest("https://dashboard.example.com/api/system/kill-switch", {
      method: "POST",
      headers: { "x-api-key": "worker-key" },
    });
    const res = middleware(req);
    expect(isPassThrough(res)).toBe(true);
  });

  it("still lets /api/auth/login through without a session (it issues the session)", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: SECRET, WORKER_API_KEY: undefined });
    const req = new NextRequest("https://dashboard.example.com/api/auth/login", { method: "POST" });
    const res = middleware(req);
    expect(isPassThrough(res)).toBe(true);
  });

  it("still lets the public AnswerShare API through without a dashboard session", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: SECRET, WORKER_API_KEY: undefined });
    const req = new NextRequest("https://dashboard.example.com/api/answer-share/onboard", {
      method: "POST",
    });
    const res = middleware(req);
    expect(isPassThrough(res)).toBe(true);
  });

  it("redirects an unauthenticated dashboard UI request to the login page", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: SECRET, WORKER_API_KEY: undefined });
    const req = new NextRequest("https://dashboard.example.com/dashboard/approvals", { method: "GET" });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard/login");
  });

  it("does nothing when DASHBOARD_SECRET is unset (matches prior behavior)", async () => {
    const middleware = await loadMiddleware({ DASHBOARD_SECRET: undefined });
    const req = new NextRequest("https://dashboard.example.com/api/system/kill-switch", {
      method: "POST",
    });
    const res = middleware(req);
    expect(isPassThrough(res)).toBe(true);
  });
});
