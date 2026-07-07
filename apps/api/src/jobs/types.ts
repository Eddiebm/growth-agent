export type ContactStatus =
  | "new"
  | "enriched"
  | "scored"
  | "queued"
  | "contacted"
  | "replied"
  | "interested"
  | "not_now"
  | "objection"
  | "unsubscribed"
  | "bounced"
  | "meeting_booked"
  | "qualified"
  | "proposal_sent"
  | "won"
  | "lost"
  | "disqualified";

export type ActivityType =
  | "lead_discovered"
  | "enrichment"
  | "score"
  | "email_drafted"
  | "email_sent"
  | "email_opened"
  | "email_clicked"
  | "email_replied"
  | "email_bounced"
  | "unsubscribe"
  | "meeting_proposed"
  | "meeting_booked"
  | "call_completed"
  | "proposal_drafted"
  | "proposal_sent"
  | "note"
  | "stage_change"
  | "approval_requested"
  | "approval_granted"
  | "approval_rejected"
  | "policy_blocked"
  | "content_published"
  | "signup"
  | "page_view";

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string | null;
  employeeCount: number | null;
  country: string | null;
  linkedinUrl: string | null;
  description: string | null;
  icpScore: number | null;
  icpReason: string | null;
  disqualified: boolean;
  disqualifyReason: string | null;
  source: string;
  sourceRef: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contact {
  id: string;
  companyId: string;
  productId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  phone: string | null;
  status: ContactStatus;
  leadScore: number | null;
  leadScoreReason: string | null;
  doNotContact: boolean;
  unsubscribedAt: Date | null;
  lastContactedAt: Date | null;
  lastRepliedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  channel: string;
  playbookId: string;
  productId: string | null;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  dailySendCap: number;
  totalSent: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  repo: string | null;
  description: string | null;
  laymanPitch: string | null;
  status: "active" | "beta" | "paused" | "archived";
  landingPath: string | null;
  priceCents: number | null;
  billing: string | null;
  icpRules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceStep {
  id: string;
  campaignId: string;
  stepNumber: number;
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface CampaignEnrollment {
  campaignId: string;
  contactId: string;
  sequenceStep: number;
}

export interface EmailMessage {
  id: string;
  contactId: string;
  campaignId: string | null;
  sequenceStep: number | null;
  direction: "outbound" | "inbound";
  subject: string;
  bodyText: string;
  providerId: string | null;
  threadId: string | null;
}

export interface InboundReply {
  fromEmail: string;
  subject: string;
  bodyText: string;
  providerId: string;
  threadId: string | null;
  campaignId: string | null;
}

export interface JobEnqueueInput {
  jobType: string;
  payload: unknown;
  idempotencyKey?: string;
  scheduledFor?: Date;
}

export interface PendingJob {
  id: string;
  jobType: string;
  payload: unknown;
  idempotencyKey: string | null;
}
