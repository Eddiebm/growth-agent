import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { hashAccessToken } from "../../../../packages/answer-share/index";

export const AS_COOKIE = "answer_share_session";
export { hashAccessToken };

export async function getAnswerShareSession(): Promise<{
  organizationId: string;
  accessToken: string;
  isDemo: boolean;
  subscriptionStatus: string;
} | null> {
  const jar = await cookies();
  const token = jar.get(AS_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  try {
    const [org] = await db.sql<
      { id: string; is_demo: boolean; subscription_status: string }[]
    >`
      SELECT id, is_demo, subscription_status
      FROM as_organizations WHERE access_token_hash = ${hashAccessToken(token)}
    `;
    if (!org) return null;
    return {
      organizationId: org.id,
      accessToken: token,
      isDemo: org.is_demo,
      subscriptionStatus: org.subscription_status,
    };
  } finally {
    await db.sql.end();
  }
}

export async function getPrimaryBusiness(organizationId: string) {
  const db = getDb();
  try {
    const [biz] = await db.sql<
      {
        id: string;
        name: string;
        website_url: string;
        is_demo: boolean;
        crawl_summary: Record<string, unknown>;
        gbp_url: string | null;
        service_category: string;
      }[]
    >`
      SELECT id, name, website_url, is_demo, crawl_summary, gbp_url, service_category
      FROM as_businesses
      WHERE organization_id = ${organizationId}
      ORDER BY created_at ASC
      LIMIT 1
    `;
    return biz ?? null;
  } finally {
    await db.sql.end();
  }
}
