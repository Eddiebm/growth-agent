import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  agreementRate,
  calculateRunConfidence,
  calculateVisibilityScore,
  positionToScore,
} from "./metrics.js";
import {
  customerCited,
  namesMatch,
  normalizeDomain,
  normalizeName,
} from "./matching.js";
import {
  assertSafePublicUrl,
  isPrivateIpv4,
  normalizeWebsiteUrl,
} from "./url-safety.js";
import { generateActions, recommendationHasEvidence } from "./recommendations.js";
import { generatePurchaseIntentQuestions } from "./questions.js";
import { verifyStripeWebhook } from "./stripe.js";

describe("matching", () => {
  it("normalizes business names", () => {
    expect(normalizeName("Gateway Heating & Cooling, LLC")).toContain("gateway");
  });

  it("matches aliases", () => {
    expect(namesMatch("Laclede Comfort", "Laclede Comfort HVAC", ["Laclede Comfort"])).toBe(true);
  });

  it("normalizes citation domains", () => {
    expect(normalizeDomain("https://www.Example.com/path")).toBe("example.com");
  });

  it("detects customer citations", () => {
    expect(customerCited(["lacledecomfort.com", "yelp.com"], "www.lacledecomfort.com")).toBe(true);
  });
});

describe("url safety", () => {
  it("normalizes website URLs", () => {
    expect(normalizeWebsiteUrl("example.com")).toBe("https://example.com");
  });

  it("blocks private IPs", () => {
    expect(isPrivateIpv4("10.0.0.5")).toBe(true);
    expect(() => assertSafePublicUrl("http://127.0.0.1/")).toThrow();
  });
});

describe("metrics", () => {
  it("calculates visibility score with documented weights", () => {
    const m = calculateVisibilityScore({
      mentionRate: 1,
      recommendationRate: 1,
      citationRate: 1,
      positionScore: 1,
      competitiveShareOfVoice: 1,
      providersCompleted: 2,
      providersExpected: 2,
    });
    expect(m.visibilityScore).toBe(100);
    expect(m.partialCoverage).toBe(false);
  });

  it("reweights disclosed partial coverage", () => {
    const m = calculateVisibilityScore({
      mentionRate: 1,
      recommendationRate: 0,
      citationRate: 0,
      positionScore: 0,
      competitiveShareOfVoice: 0,
      providersCompleted: 1,
      providersExpected: 4,
    });
    expect(m.partialCoverage).toBe(true);
    expect(m.visibilityScore).toBe(35);
  });

  it("maps positions and confidence", () => {
    expect(positionToScore(1)).toBe(1);
    expect(agreementRate([true, true, false])).toBeCloseTo(2 / 3);
    const c = calculateRunConfidence({
      completedRuns: 9,
      expectedRuns: 9,
      agreementRate: 1,
      providersCompleted: 3,
      providersExpected: 3,
    });
    expect(c).toBeGreaterThan(0.9);
  });
});

describe("questions & recommendations", () => {
  it("generates ten purchase-intent questions", () => {
    const qs = generatePurchaseIntentQuestions({
      businessName: "Test",
      serviceCategory: "hvac",
      city: "St. Louis",
      state: "MO",
    });
    expect(qs).toHaveLength(10);
    expect(qs[0]!.questionText.toLowerCase()).toContain("st. louis");
  });

  it("caps actions at three", () => {
    const actions = generateActions({
      businessName: "Test",
      visibilityScore: 20,
      mentionRate: 0.1,
      recommendationRate: 0.1,
      citationRate: 0.05,
      lostQuestions: [
        {
          id: "q1",
          text: "Best emergency HVAC in St. Louis?",
          topCompetitor: "Gateway",
          evidenceIds: ["e1"],
        },
      ],
      crawlOk: false,
      hasGbp: false,
      topCompetitorDomain: "example.com",
    });
    expect(actions.length).toBeLessThanOrEqual(3);
    expect(recommendationHasEvidence(actions[0]!)).toBe(true);
  });
});

describe("stripe webhook", () => {
  it("verifies valid signatures", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const v1 = createHmac("sha256", "whsec_test").update(`${timestamp}.${payload}`).digest("hex");
    const result = verifyStripeWebhook(payload, `t=${timestamp},v1=${v1}`);
    expect(result.ok).toBe(true);
  });

  it("rejects bad signatures", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const result = verifyStripeWebhook("{}", "t=1,v1=deadbeef");
    expect(result.ok).toBe(false);
  });
});
