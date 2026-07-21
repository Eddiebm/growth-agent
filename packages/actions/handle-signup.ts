import type { JSONValue } from "postgres";
import type { Db } from "../../apps/api/src/jobs/db.js";
import { isValidOutreachEmail } from "../email-validation/index.js";

export interface SignupInput {
  email: string;
  name?: string;
  company?: string;
  productSlug?: string;
  utm?: Record<string, string>;
}

export interface SignupResult {
  signupId: string;
  contactId: string;
  companyId: string;
  isNew: boolean;
}

function domainFromEmail(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "unknown.local";
}

export async function handleSignup(db: Db, input: SignupInput): Promise<SignupResult> {
  const email = input.email.toLowerCase().trim();
  if (!isValidOutreachEmail(email)) {
    throw new Error("Invalid email address");
  }
  const domain = domainFromEmail(email);
  const companyName = input.company?.trim() || domain.split(".")[0] || "Unknown";

  const company = await db.companies.upsertByDomain({
    name: companyName,
    domain,
    source: "landing",
    sourceRef: input.utm?.utm_source ?? "direct",
  });

  const existing = await db.contacts.findByEmail(email);

  let productId: string | null = null;
  if (input.productSlug) {
    const product = await db.products.getBySlug(input.productSlug);
    productId = product?.id ?? null;
  }

  const contact = await db.contacts.upsertByEmail({
    companyId: company.id,
    email,
    firstName: input.name?.split(" ")[0] ?? null,
    lastName: input.name?.split(" ").slice(1).join(" ") || null,
    status: "new",
  });

  if (productId) {
    await db.contacts.update(contact.id, { productId });
  }

  const [signup] = await db.sql<{ id: string }[]>`
    INSERT INTO signups (email, name, company, source, utm, contact_id, product_id)
    VALUES (
      ${email},
      ${input.name ?? null},
      ${input.company ?? null},
      'landing',
      ${db.sql.json((input.utm ?? {}) as JSONValue)},
      ${contact.id},
      ${productId}
    )
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, signups.name),
      company = COALESCE(EXCLUDED.company, signups.company),
      utm = signups.utm || EXCLUDED.utm
    RETURNING id
  `;

  await db.activities.create({
    contactId: contact.id,
    companyId: company.id,
    productId: productId ?? undefined,
    type: "signup",
    channel: "landing",
    agentId: "orchestrator",
    metadata: { utm: input.utm ?? {}, source: "landing", productSlug: input.productSlug },
  });

  const campaignId =
    process.env.DEFAULT_CAMPAIGN_ID ?? "11111111-1111-1111-1111-111111111111";

  await db.jobs.enqueue({
    jobType: "score_leads",
    payload: { campaignId, companyIds: [company.id], minScore: 50 },
    scheduledFor: new Date(Date.now() + 60_000),
  });

  return {
    signupId: signup.id,
    contactId: contact.id,
    companyId: company.id,
    isNew: !existing,
  };
}
