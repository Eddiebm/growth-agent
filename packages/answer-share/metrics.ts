/** AnswerShare visibility math — weights documented in docs/ANSWER_SHARE.md */

export const SCORE_WEIGHTS = {
  mentionRate: 0.35,
  recommendationRate: 0.25,
  citationRate: 0.2,
  recommendationPosition: 0.1,
  competitiveShareOfVoice: 0.1,
} as const;

export interface VisibilityInputs {
  mentionRate: number;
  recommendationRate: number;
  citationRate: number;
  /** 1.0 = always first when recommended; 0 = never / last */
  positionScore: number;
  competitiveShareOfVoice: number;
  /** Providers that completed at least one run */
  providersCompleted: number;
  providersExpected: number;
}

export interface VisibilityMetrics {
  mentionRate: number;
  recommendationRate: number;
  citationRate: number;
  averageRecommendationPosition: number | null;
  competitiveShareOfVoice: number;
  providerCoverage: number;
  runConfidence: number;
  visibilityScore: number;
  partialCoverage: boolean;
  formulaNote: string;
}

export function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Position score: lower average position is better.
 * position 1 → 1.0, position 2 → 0.7, 3 → 0.45, 4+ → 0.2, null → 0
 */
export function positionToScore(avgPosition: number | null): number {
  if (avgPosition == null || avgPosition <= 0) return 0;
  if (avgPosition <= 1) return 1;
  if (avgPosition <= 2) return 0.7;
  if (avgPosition <= 3) return 0.45;
  return 0.2;
}

export function calculateVisibilityScore(input: VisibilityInputs): VisibilityMetrics {
  const partialCoverage =
    input.providersExpected > 0 && input.providersCompleted < input.providersExpected;

  const components: { key: keyof typeof SCORE_WEIGHTS; value: number; weight: number }[] = [
    { key: "mentionRate", value: clamp01(input.mentionRate), weight: SCORE_WEIGHTS.mentionRate },
    {
      key: "recommendationRate",
      value: clamp01(input.recommendationRate),
      weight: SCORE_WEIGHTS.recommendationRate,
    },
    { key: "citationRate", value: clamp01(input.citationRate), weight: SCORE_WEIGHTS.citationRate },
    {
      key: "recommendationPosition",
      value: clamp01(input.positionScore),
      weight: SCORE_WEIGHTS.recommendationPosition,
    },
    {
      key: "competitiveShareOfVoice",
      value: clamp01(input.competitiveShareOfVoice),
      weight: SCORE_WEIGHTS.competitiveShareOfVoice,
    },
  ];

  const weightSum = components.reduce((s, c) => s + c.weight, 0);
  const score01 =
    weightSum === 0
      ? 0
      : components.reduce((s, c) => s + c.value * (c.weight / weightSum), 0);

  const providerCoverage =
    input.providersExpected <= 0 ? 0 : input.providersCompleted / input.providersExpected;

  return {
    mentionRate: clamp01(input.mentionRate),
    recommendationRate: clamp01(input.recommendationRate),
    citationRate: clamp01(input.citationRate),
    averageRecommendationPosition: null,
    competitiveShareOfVoice: clamp01(input.competitiveShareOfVoice),
    providerCoverage: clamp01(providerCoverage),
    runConfidence: 0,
    visibilityScore: Math.round(score01 * 100),
    partialCoverage,
    formulaNote:
      "Score = 35% mention + 25% recommendation + 20% citation + 10% position + 10% share of voice. Missing providers are excluded and weights renormalized.",
  };
}

/**
 * Confidence from completed runs, agreement rate, and provider coverage.
 * Returns 0–1.
 */
export function calculateRunConfidence(input: {
  completedRuns: number;
  expectedRuns: number;
  agreementRate: number;
  providersCompleted: number;
  providersExpected: number;
}): number {
  const runFill =
    input.expectedRuns <= 0 ? 0 : clamp01(input.completedRuns / input.expectedRuns);
  const coverage =
    input.providersExpected <= 0
      ? 0
      : clamp01(input.providersCompleted / input.providersExpected);
  const agreement = clamp01(input.agreementRate);
  return clamp01(0.4 * runFill + 0.35 * agreement + 0.25 * coverage);
}

export function agreementRate(booleans: boolean[]): number {
  if (booleans.length === 0) return 0;
  if (booleans.length === 1) return 0.5;
  const trues = booleans.filter(Boolean).length;
  const rate = Math.max(trues, booleans.length - trues) / booleans.length;
  return rate;
}
