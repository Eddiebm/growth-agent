export type BillingPeriod = "one_time" | "monthly" | "annual";

/** Shared tool + labor defaults (dashboard saves to agent_memory) */
export type GlobalCacDefaults = {
  monthlyFixedTools: number;
  costPerLeadEnrichment: number;
  emailsPerLead: number;
  costPerEmail: number;
  llmCostPerLead: number;
  hourlyRate: number;
  targetChurnMonths: number;
};

/** Per-product funnel + volume (saved on product.metadata.cac) */
export type ProductCacAssumptions = {
  leadsPerMonth: number;
  salesHoursPerMonth: number;
  replyRatePct: number;
  meetingRatePct: number;
  closeRatePct: number;
};

export type CacInputs = GlobalCacDefaults &
  ProductCacAssumptions & {
    priceCents: number;
    billing: BillingPeriod;
  };

export interface CacResults {
  monthlyToolSpend: number;
  variableCostPerLead: number;
  repliesPerMonth: number;
  meetingsPerMonth: number;
  customersPerMonth: number;
  toolOnlyCac: number | null;
  fullyLoadedCac: number | null;
  monthlyRevenuePerCustomer: number;
  paybackMonths: number | null;
  ltvEstimate: number | null;
  grossMarginFirstMonthPct: number | null;
  healthy: boolean;
  healthNote: string;
}

const MAX_PAYBACK_MONTHS = 6;

export function monthlyRevenueFromPrice(priceCents: number, billing: BillingPeriod): number {
  const dollars = priceCents / 100;
  switch (billing) {
    case "monthly":
      return dollars;
    case "annual":
      return dollars / 12;
    case "one_time":
      return dollars;
    default: {
      const _exhaustive: never = billing;
      return _exhaustive;
    }
  }
}

export function computeCac(inputs: CacInputs): CacResults {
  const {
    priceCents,
    billing,
    monthlyFixedTools,
    leadsPerMonth,
    costPerLeadEnrichment,
    emailsPerLead,
    costPerEmail,
    llmCostPerLead,
    salesHoursPerMonth,
    hourlyRate,
    replyRatePct,
    meetingRatePct,
    closeRatePct,
    targetChurnMonths,
  } = inputs;

  const variableCostPerLead =
    costPerLeadEnrichment + emailsPerLead * costPerEmail + llmCostPerLead;
  const monthlyToolSpend = monthlyFixedTools + leadsPerMonth * variableCostPerLead;
  const monthlyLabor = salesHoursPerMonth * hourlyRate;

  const replyRate = replyRatePct / 100;
  const meetingRate = meetingRatePct / 100;
  const closeRate = closeRatePct / 100;

  const repliesPerMonth = leadsPerMonth * replyRate;
  const meetingsPerMonth = repliesPerMonth * meetingRate;
  const customersPerMonth = meetingsPerMonth * closeRate;

  const toolOnlyCac =
    customersPerMonth > 0 ? monthlyToolSpend / customersPerMonth : null;
  const fullyLoadedCac =
    customersPerMonth > 0 ? (monthlyToolSpend + monthlyLabor) / customersPerMonth : null;

  const monthlyRevenuePerCustomer = monthlyRevenueFromPrice(priceCents, billing);

  let paybackMonths: number | null = null;
  let ltvEstimate: number | null = null;
  let grossMarginFirstMonthPct: number | null = null;

  if (billing === "one_time") {
    grossMarginFirstMonthPct =
      fullyLoadedCac != null && priceCents > 0
        ? ((priceCents / 100 - fullyLoadedCac) / (priceCents / 100)) * 100
        : null;
    paybackMonths = fullyLoadedCac != null && monthlyRevenuePerCustomer > 0 ? 1 : null;
    ltvEstimate = priceCents / 100;
  } else {
    const months = targetChurnMonths ?? 12;
    ltvEstimate = monthlyRevenuePerCustomer * months;
    if (fullyLoadedCac != null && monthlyRevenuePerCustomer > 0) {
      paybackMonths = fullyLoadedCac / monthlyRevenuePerCustomer;
      grossMarginFirstMonthPct =
        ((monthlyRevenuePerCustomer - fullyLoadedCac) / monthlyRevenuePerCustomer) * 100;
    }
  }

  const cac = fullyLoadedCac ?? toolOnlyCac;
  let healthy = false;
  let healthNote = "Add funnel rates to see if economics work.";

  if (cac != null && customersPerMonth > 0) {
    if (billing === "one_time") {
      healthy = cac < priceCents / 100 * 0.6;
      healthNote = healthy
        ? "CAC is under 60% of sale price — room for margin."
        : "CAC eats most of the one-time price — raise price or improve funnel.";
    } else if (paybackMonths != null) {
      healthy = paybackMonths <= MAX_PAYBACK_MONTHS;
      healthNote = healthy
        ? `Payback within ${MAX_PAYBACK_MONTHS} months — reasonable for subscription.`
        : `Payback over ${MAX_PAYBACK_MONTHS} months — tighten funnel or raise price.`;
    }
  } else if (customersPerMonth === 0) {
    healthNote = "At these rates you close 0 customers/mo — adjust funnel or volume.";
  }

  return {
    monthlyToolSpend,
    variableCostPerLead,
    repliesPerMonth,
    meetingsPerMonth,
    customersPerMonth,
    toolOnlyCac,
    fullyLoadedCac,
    monthlyRevenuePerCustomer,
    paybackMonths,
    ltvEstimate,
    grossMarginFirstMonthPct,
    healthy,
    healthNote,
  };
}

/** Default tool assumptions for the growth-agent stack */
export const GROWTH_AGENT_PRESETS: CacInputs = {
  monthlyFixedTools: 100,
  costPerLeadEnrichment: 0.15,
  emailsPerLead: 3,
  costPerEmail: 0.001,
  llmCostPerLead: 0.05,
  leadsPerMonth: 400,
  replyRatePct: 3,
  meetingRatePct: 30,
  closeRatePct: 20,
  salesHoursPerMonth: 8,
  hourlyRate: 75,
  targetChurnMonths: 12,
  priceCents: 0,
  billing: "monthly",
};

export const DEFAULT_GLOBAL_CAC: GlobalCacDefaults = {
  monthlyFixedTools: GROWTH_AGENT_PRESETS.monthlyFixedTools,
  costPerLeadEnrichment: GROWTH_AGENT_PRESETS.costPerLeadEnrichment,
  emailsPerLead: GROWTH_AGENT_PRESETS.emailsPerLead,
  costPerEmail: GROWTH_AGENT_PRESETS.costPerEmail,
  llmCostPerLead: GROWTH_AGENT_PRESETS.llmCostPerLead,
  hourlyRate: GROWTH_AGENT_PRESETS.hourlyRate,
  targetChurnMonths: GROWTH_AGENT_PRESETS.targetChurnMonths,
};

export const DEFAULT_PRODUCT_CAC: ProductCacAssumptions = {
  leadsPerMonth: 100,
  salesHoursPerMonth: 2,
  replyRatePct: GROWTH_AGENT_PRESETS.replyRatePct,
  meetingRatePct: GROWTH_AGENT_PRESETS.meetingRatePct,
  closeRatePct: GROWTH_AGENT_PRESETS.closeRatePct,
};

export function parseProductCacAssumptions(raw: unknown): ProductCacAssumptions {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PRODUCT_CAC };
  const o = raw as Record<string, unknown>;
  return {
    leadsPerMonth: num(o.leadsPerMonth, DEFAULT_PRODUCT_CAC.leadsPerMonth),
    salesHoursPerMonth: num(o.salesHoursPerMonth, DEFAULT_PRODUCT_CAC.salesHoursPerMonth),
    replyRatePct: num(o.replyRatePct, DEFAULT_PRODUCT_CAC.replyRatePct),
    meetingRatePct: num(o.meetingRatePct, DEFAULT_PRODUCT_CAC.meetingRatePct),
    closeRatePct: num(o.closeRatePct, DEFAULT_PRODUCT_CAC.closeRatePct),
  };
}

export function parseGlobalCacDefaults(raw: unknown): GlobalCacDefaults {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_GLOBAL_CAC };
  const o = raw as Record<string, unknown>;
  return {
    monthlyFixedTools: num(o.monthlyFixedTools, DEFAULT_GLOBAL_CAC.monthlyFixedTools),
    costPerLeadEnrichment: num(
      o.costPerLeadEnrichment,
      DEFAULT_GLOBAL_CAC.costPerLeadEnrichment,
    ),
    emailsPerLead: num(o.emailsPerLead, DEFAULT_GLOBAL_CAC.emailsPerLead),
    costPerEmail: num(o.costPerEmail, DEFAULT_GLOBAL_CAC.costPerEmail),
    llmCostPerLead: num(o.llmCostPerLead, DEFAULT_GLOBAL_CAC.llmCostPerLead),
    hourlyRate: num(o.hourlyRate, DEFAULT_GLOBAL_CAC.hourlyRate),
    targetChurnMonths: num(o.targetChurnMonths, DEFAULT_GLOBAL_CAC.targetChurnMonths),
  };
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function buildCacInputs(
  priceCents: number,
  billing: BillingPeriod,
  global: GlobalCacDefaults,
  product: ProductCacAssumptions,
  activeProductCount: number,
): CacInputs {
  const share = Math.max(activeProductCount, 1);
  return {
    ...global,
    ...product,
    priceCents,
    billing,
    monthlyFixedTools: global.monthlyFixedTools / share,
  };
}

export function computeProductCac(
  priceCents: number,
  billing: BillingPeriod,
  global: GlobalCacDefaults,
  product: ProductCacAssumptions,
  activeProductCount: number,
): CacResults {
  return computeCac(buildCacInputs(priceCents, billing, global, product, activeProductCount));
}

export function formatUsd(amount: number, decimals = 0): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
