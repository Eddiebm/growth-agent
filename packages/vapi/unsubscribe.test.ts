import { afterEach, describe, expect, it } from "vitest";
import { buildUnsubscribeToken, buildUnsubscribeUrl, verifyUnsubscribeToken } from "./unsubscribe";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("unsubscribe token", () => {
  it("verifies a token it issued for the same contact/email", () => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
    const token = buildUnsubscribeToken("contact-1", "a@example.com");
    expect(verifyUnsubscribeToken("contact-1", "a@example.com", token)).toBe(true);
  });

  it("rejects a token replayed against a different contact", () => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
    const token = buildUnsubscribeToken("contact-1", "a@example.com");
    expect(verifyUnsubscribeToken("contact-2", "a@example.com", token)).toBe(false);
  });

  it("rejects a tampered token", () => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
    const token = buildUnsubscribeToken("contact-1", "a@example.com");
    const tampered = token.slice(0, -1) + (token.at(-1) === "0" ? "1" : "0");
    expect(verifyUnsubscribeToken("contact-1", "a@example.com", tampered)).toBe(false);
  });

  it("rejects an empty token", () => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
    expect(verifyUnsubscribeToken("contact-1", "a@example.com", "")).toBe(false);
  });

  it("builds a URL carrying the contact id, email and token", () => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
    const url = buildUnsubscribeUrl({
      contactId: "contact-1",
      email: "a@example.com",
      baseUrl: "https://api.example.com",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://api.example.com/api/unsubscribe");
    expect(parsed.searchParams.get("c")).toBe("contact-1");
    expect(parsed.searchParams.get("e")).toBe("a@example.com");
    expect(parsed.searchParams.get("t")).toBe(buildUnsubscribeToken("contact-1", "a@example.com"));
  });
});
