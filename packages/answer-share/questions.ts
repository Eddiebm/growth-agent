/** Purchase-intent question generation for local services */

export interface QuestionSeedInput {
  businessName: string;
  serviceCategory: string;
  city: string;
  state: string;
  services?: string[];
}

export interface GeneratedQuestion {
  questionText: string;
  intentCategory: string;
  locationLabel: string;
}

const HVAC_TEMPLATES = [
  (c: string) => `Who is the best emergency HVAC company in ${c}?`,
  (c: string) => `Which ${c} HVAC companies offer weekend repairs?`,
  (c: string) => `Who provides same-day furnace repair near me in ${c}?`,
  (c: string) => `What company should I call for AC repair in ${c}?`,
  (c: string) => `Which HVAC company has the best customer reviews in ${c}?`,
  (c: string) => `How much does furnace replacement cost in ${c}?`,
  (c: string) => `Who offers 24-hour air conditioning repair in ${c}?`,
  (c: string) => `Best HVAC maintenance plan for homes in ${c}?`,
  (c: string) => `Which ${c} HVAC company can install a new heat pump this week?`,
  (c: string) => `Who should I hire for emergency AC repair in ${c} tonight?`,
];

export function generatePurchaseIntentQuestions(
  input: QuestionSeedInput,
): GeneratedQuestion[] {
  const city = input.city.trim() || "St. Louis";
  const locationLabel = `${city}, ${input.state}`.replace(/,\s*$/, "");
  const category = input.serviceCategory.toLowerCase();

  const templates =
    category.includes("hvac") || category.includes("heating") || category.includes("cooling")
      ? HVAC_TEMPLATES
      : [
          (c: string) => `Who is the best ${input.serviceCategory} company in ${c}?`,
          (c: string) => `Which ${c} ${input.serviceCategory} companies offer same-day service?`,
          (c: string) => `Who should I call for emergency ${input.serviceCategory} in ${c}?`,
          (c: string) => `Best reviewed ${input.serviceCategory} near ${c}?`,
          (c: string) => `How much does ${input.serviceCategory} cost in ${c}?`,
          (c: string) => `Which ${input.serviceCategory} company in ${c} is open on weekends?`,
          (c: string) => `Top-rated ${input.serviceCategory} for homeowners in ${c}?`,
          (c: string) => `Who provides fast ${input.serviceCategory} service near me in ${c}?`,
          (c: string) => `Best ${input.serviceCategory} company for emergencies in ${c}?`,
          (c: string) => `What ${input.serviceCategory} company should I hire in ${c}?`,
        ];

  return templates.slice(0, 10).map((t, i) => ({
    questionText: t(city),
    intentCategory: i === 5 ? "commercial_pricing" : "purchase",
    locationLabel,
  }));
}

export function suggestStLouisHvacCompetitors(): { name: string; websiteUrl: string; domain: string }[] {
  return [
    { name: "Gateway Heating & Cooling", websiteUrl: "https://example.com/gateway-hvac", domain: "example.com" },
    { name: "River City Air Pros", websiteUrl: "https://example.com/river-city-air", domain: "example.com" },
    { name: "Midwest Comfort Experts", websiteUrl: "https://example.com/midwest-comfort", domain: "example.com" },
    { name: "Arch City HVAC", websiteUrl: "https://example.com/arch-city-hvac", domain: "example.com" },
    { name: "Forest Park Heating", websiteUrl: "https://example.com/forest-park-heating", domain: "example.com" },
  ];
}
