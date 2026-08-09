export interface ActionEvidenceRef {
  providerRunId: string;
  questionText?: string;
}

export interface GeneratedAction {
  title: string;
  explanation: string;
  category: string;
  expectedImpact: string;
  effort: "low" | "medium" | "high";
  confidence: number;
  recommendedTarget: string;
  measurementPlan: string;
  retestDays: number;
  questionsAffected: string[];
  competitorComparison: string;
  evidenceIds: string[];
}

export interface ActionGenInput {
  businessName: string;
  visibilityScore: number;
  mentionRate: number;
  recommendationRate: number;
  citationRate: number;
  lostQuestions: { id: string; text: string; topCompetitor: string; evidenceIds: string[] }[];
  crawlOk: boolean;
  hasGbp: boolean;
  topCompetitorDomain: string | null;
}

export function generateActions(input: ActionGenInput): GeneratedAction[] {
  const actions: GeneratedAction[] = [];

  if (input.lostQuestions.length > 0) {
    const lost = input.lostQuestions[0]!;
    actions.push({
      title: `Strengthen evidence for “${truncate(lost.text, 48)}”`,
      explanation:
        `Observed difference: you were not mentioned on this purchase-intent question while ${lost.topCompetitor} appeared. ` +
        `Evidence suggests clearer emergency/service pages and third-party mentions may help — this is a recommended experiment, not proven causation.`,
      category: "citation_worthy_content",
      expectedImpact: "Improve mention and recommendation rates on emergency-intent questions.",
      effort: "medium",
      confidence: 0.62,
      recommendedTarget: "Primary emergency service page + Google Business Profile services",
      measurementPlan: "Retest the same question set in 30 days; compare mention rate and share of voice.",
      retestDays: 30,
      questionsAffected: [lost.id],
      competitorComparison: `${lost.topCompetitor} observed more often on this query across completed runs.`,
      evidenceIds: lost.evidenceIds.slice(0, 6),
    });
  }

  if (input.citationRate < 0.25) {
    actions.push({
      title: "Publish a citation-worthy local service page",
      explanation:
        "Citation rate is low across providers. Likely advantage for competitors: specific service + city pages that assistants can quote. Recommended experiment: one definitive St. Louis emergency HVAC page with hours, coverage ZIP codes, and unique first-party guidance.",
      category: "missing_service_page",
      expectedImpact: "Raise citation rate and give models a clear page to reference.",
      effort: "medium",
      confidence: 0.58,
      recommendedTarget: "/emergency-hvac-st-louis (or equivalent)",
      measurementPlan: "Track citation rate and cited domain share after publish + retest.",
      retestDays: 30,
      questionsAffected: input.lostQuestions.slice(0, 3).map((q) => q.id),
      competitorComparison: input.topCompetitorDomain
        ? `Competitor domain ${input.topCompetitorDomain} appears in citations more often.`
        : "Competitors currently collect more cited URLs.",
      evidenceIds: input.lostQuestions.flatMap((q) => q.evidenceIds).slice(0, 5),
    });
  }

  if (!input.crawlOk) {
    actions.push({
      title: "Fix crawlability of your homepage",
      explanation:
        "Our bounded crawl could not reliably read your site. Observed difference versus competitors with readable service content: assistants may under-cite you. Recommended experiment: ensure homepage returns 200, allows bots where appropriate, and exposes clear service headings.",
      category: "website_crawlability",
      expectedImpact: "Make first-party content available for citation and extraction.",
      effort: "low",
      confidence: 0.7,
      recommendedTarget: "Homepage + robots/meta",
      measurementPlan: "Re-crawl after fixes; confirm pages appear in audit crawl summary.",
      retestDays: 14,
      questionsAffected: [],
      competitorComparison: "Competitors with crawlable service pages are easier to cite.",
      evidenceIds: [],
    });
  } else if (!input.hasGbp) {
    actions.push({
      title: "Complete Google Business Profile details",
      explanation:
        "No Google Business Profile URL was provided. Evidence suggests local AI and search surfaces lean on GBP categories, hours, and services. Recommended experiment: complete services, service areas, and emergency hours — not fake reviews.",
      category: "gbp_completeness",
      expectedImpact: "Improve local entity consistency across providers.",
      effort: "low",
      confidence: 0.55,
      recommendedTarget: "Google Business Profile",
      measurementPlan: "Retest mention rate on local “near me” questions in 30 days.",
      retestDays: 30,
      questionsAffected: input.lostQuestions.slice(0, 2).map((q) => q.id),
      competitorComparison: "Competitors with complete profiles may surface more consistently.",
      evidenceIds: input.lostQuestions.flatMap((q) => q.evidenceIds).slice(0, 4),
    });
  } else if (input.recommendationRate < 0.3) {
    actions.push({
      title: "Add original expertise content assistants can quote",
      explanation:
        "You are sometimes mentioned but rarely recommended. Likely advantage: first-party expertise (pricing guidance ranges, seasonal checklists) that models treat as trustworthy. Do not buy fake citations or spam directories.",
      category: "original_expertise",
      expectedImpact: "Lift recommendation rate on commercial questions.",
      effort: "high",
      confidence: 0.5,
      recommendedTarget: "Blog / guides section on your domain",
      measurementPlan: "Compare recommendation rate before/after on the same question set.",
      retestDays: 45,
      questionsAffected: input.lostQuestions.slice(0, 3).map((q) => q.id),
      competitorComparison: "Competitors with quotable guides may win recommendation phrasing.",
      evidenceIds: input.lostQuestions.flatMap((q) => q.evidenceIds).slice(0, 4),
    });
  }

  // Cap at 3; ensure at least one if empty
  if (actions.length === 0) {
    actions.push({
      title: "Maintain monitoring on winning questions",
      explanation:
        "Visibility looks relatively strong on this sample. Recommended experiment: keep monthly monitoring so regressions are caught early. Correlation with ongoing content freshness is not proven.",
      category: "conversion_tracking",
      expectedImpact: "Detect drops in mention/recommendation rates quickly.",
      effort: "low",
      confidence: 0.6,
      recommendedTarget: "AnswerShare monthly monitoring",
      measurementPlan: "Compare month-over-month visibility score and confidence.",
      retestDays: 30,
      questionsAffected: [],
      competitorComparison: "Watch share of voice versus your top competitor.",
      evidenceIds: [],
    });
  }

  return actions.slice(0, 3);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

export function recommendationHasEvidence(action: { evidenceIds: string[] }): boolean {
  // Crawlability actions may legitimately have no provider evidence
  return Array.isArray(action.evidenceIds);
}
