-- Growth Agent — CRM + audit + orchestration schema
-- Postgres 15+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE contact_status AS ENUM (
  'new',
  'enriched',
  'scored',
  'queued',
  'contacted',
  'replied',
  'interested',
  'not_now',
  'objection',
  'unsubscribed',
  'bounced',
  'meeting_booked',
  'qualified',
  'proposal_sent',
  'won',
  'lost',
  'disqualified'
);

CREATE TYPE activity_type AS ENUM (
  'lead_discovered',
  'enrichment',
  'score',
  'email_drafted',
  'email_sent',
  'email_opened',
  'email_clicked',
  'email_replied',
  'email_bounced',
  'unsubscribe',
  'meeting_proposed',
  'meeting_booked',
  'call_completed',
  'proposal_drafted',
  'proposal_sent',
  'note',
  'stage_change',
  'approval_requested',
  'approval_granted',
  'approval_rejected',
  'policy_blocked',
  'content_published',
  'signup',
  'page_view'
);

CREATE TYPE campaign_status AS ENUM (
  'draft',
  'active',
  'paused',
  'completed',
  'archived'
);

CREATE TYPE job_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'dead_letter'
);

CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'expired'
);

CREATE TYPE approval_action AS ENUM (
  'send_email',
  'send_sequence',
  'quote_custom_price',
  'send_proposal',
  'sign_contract',
  'publish_content',
  'increase_daily_cap',
  'contact_high_value'
);

-- ---------------------------------------------------------------------------
-- Core CRM
-- ---------------------------------------------------------------------------

CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  domain          CITEXT NOT NULL UNIQUE,
  industry        TEXT,
  employee_count  INT,
  country         TEXT,
  linkedin_url    TEXT,
  description     TEXT,
  icp_score       SMALLINT CHECK (icp_score BETWEEN 0 AND 100),
  icp_reason      TEXT,
  icp_fit         BOOLEAN GENERATED ALWAYS AS (icp_score >= 60) STORED,
  source          TEXT NOT NULL DEFAULT 'manual',
  source_ref      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  disqualified    BOOLEAN NOT NULL DEFAULT FALSE,
  disqualify_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_icp_score ON companies (icp_score DESC NULLS LAST)
  WHERE NOT disqualified;
CREATE INDEX idx_companies_industry ON companies (industry) WHERE NOT disqualified;

CREATE TABLE contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email           CITEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  title           TEXT,
  linkedin_url    TEXT,
  phone           TEXT,
  status          contact_status NOT NULL DEFAULT 'new',
  lead_score      SMALLINT CHECK (lead_score BETWEEN 0 AND 100),
  lead_score_reason TEXT,
  timezone        TEXT,
  do_not_contact  BOOLEAN NOT NULL DEFAULT FALSE,
  unsubscribed_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  last_replied_at TIMESTAMPTZ,
  next_action_at  TIMESTAMPTZ,
  owner_agent     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email)
);

CREATE INDEX idx_contacts_status ON contacts (status) WHERE NOT do_not_contact;
CREATE INDEX idx_contacts_next_action ON contacts (next_action_at)
  WHERE next_action_at IS NOT NULL AND NOT do_not_contact;
CREATE INDEX idx_contacts_company ON contacts (company_id);

CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  channel         TEXT NOT NULL DEFAULT 'email',
  icp_filter      JSONB NOT NULL DEFAULT '{}',
  playbook_id     TEXT NOT NULL,
  status          campaign_status NOT NULL DEFAULT 'draft',
  daily_send_cap  INT NOT NULL DEFAULT 10,
  total_sent      INT NOT NULL DEFAULT 0,
  total_replies   INT NOT NULL DEFAULT 0,
  total_meetings  INT NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ,
  paused_at       TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_contacts (
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  sequence_step   INT NOT NULL DEFAULT 0,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  PRIMARY KEY (campaign_id, contact_id)
);

CREATE TABLE sequences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number     INT NOT NULL,
  delay_days      INT NOT NULL DEFAULT 0,
  subject_template TEXT NOT NULL,
  body_template   TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (campaign_id, step_number)
);

-- ---------------------------------------------------------------------------
-- Activity + messaging
-- ---------------------------------------------------------------------------

CREATE TABLE activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  type            activity_type NOT NULL,
  channel         TEXT,
  subject         TEXT,
  body            TEXT,
  external_id     TEXT,
  agent_id        TEXT,
  job_id          UUID,
  metadata        JSONB NOT NULL DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_contact ON activities (contact_id, occurred_at DESC);
CREATE INDEX idx_activities_type ON activities (type, occurred_at DESC);
CREATE INDEX idx_activities_external ON activities (external_id) WHERE external_id IS NOT NULL;

CREATE TABLE email_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  sequence_step   INT,
  direction       TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  subject         TEXT NOT NULL,
  body_text       TEXT NOT NULL,
  body_html       TEXT,
  provider        TEXT NOT NULL DEFAULT 'resend',
  provider_id     TEXT,
  thread_id       TEXT,
  in_reply_to     TEXT,
  variant_id      UUID,
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_email_provider_id ON email_messages (provider, provider_id)
  WHERE provider_id IS NOT NULL;
CREATE INDEX idx_email_thread ON email_messages (thread_id) WHERE thread_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Experiments
-- ---------------------------------------------------------------------------

CREATE TABLE experiments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  hypothesis      TEXT,
  metric          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('draft', 'running', 'completed', 'archived')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  winner_variant_id UUID,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE experiment_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  impressions     INT NOT NULL DEFAULT 0,
  conversions     INT NOT NULL DEFAULT 0,
  UNIQUE (experiment_id, label)
);

-- ---------------------------------------------------------------------------
-- Orchestration
-- ---------------------------------------------------------------------------

CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  status          job_status NOT NULL DEFAULT 'pending',
  payload         JSONB NOT NULL DEFAULT '{}',
  result          JSONB,
  error           TEXT,
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 3,
  scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_pending ON jobs (scheduled_for)
  WHERE status = 'pending';
CREATE INDEX idx_jobs_type_status ON jobs (job_type, status);

CREATE TABLE daily_counters (
  counter_date    DATE NOT NULL,
  counter_key     TEXT NOT NULL,
  count           INT NOT NULL DEFAULT 0,
  PRIMARY KEY (counter_date, counter_key)
);

-- ---------------------------------------------------------------------------
-- Approvals + governance
-- ---------------------------------------------------------------------------

CREATE TABLE approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          approval_action NOT NULL,
  status          approval_status NOT NULL DEFAULT 'pending',
  agent_id        TEXT NOT NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL,
  reason          TEXT,
  resolved_by     TEXT,
  resolved_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approvals_pending ON approvals (created_at)
  WHERE status = 'pending';

CREATE TABLE suppression_list (
  email           CITEXT PRIMARY KEY,
  reason          TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rate_card (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  price_cents     INT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  billing         TEXT NOT NULL DEFAULT 'one_time'
                  CHECK (billing IN ('one_time', 'monthly', 'annual')),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Audit + agent runs
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT NOT NULL,
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  input_hash      TEXT,
  input           JSONB,
  output          JSONB,
  policy_decision TEXT CHECK (policy_decision IN ('allow', 'deny', 'escalate')),
  policy_reason   TEXT,
  model           TEXT,
  prompt_tokens   INT,
  completion_tokens INT,
  cost_usd        NUMERIC(10, 6),
  latency_ms      INT,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_agent ON audit_log (agent_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);

CREATE TABLE agent_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace       TEXT NOT NULL,
  key             TEXT NOT NULL,
  value           JSONB NOT NULL,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (namespace, key)
);

-- ---------------------------------------------------------------------------
-- Meetings + proposals
-- ---------------------------------------------------------------------------

CREATE TABLE meetings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'calcom',
  provider_event_id TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_min    INT NOT NULL DEFAULT 30,
  meeting_url     TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled')),
  qualifier_summary JSONB,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  rate_card_id    TEXT NOT NULL REFERENCES rate_card(id),
  custom_price_cents INT,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'pending_approval', 'sent', 'accepted', 'rejected')),
  sent_at         TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agent_memory_updated BEFORE UPDATE ON agent_memory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed rate card (example — replace with your offers)
-- ---------------------------------------------------------------------------

INSERT INTO rate_card (id, name, description, price_cents, billing) VALUES
  ('bot-mvp', 'Bot MVP', 'Custom AI bot delivered in 14 days', 50000, 'one_time'),
  ('lead-gen-retainer', 'Lead Gen Retainer', '100 qualified leads per month', 30000, 'monthly'),
  ('outreach-campaign', 'Outreach Campaign', '500-contact personalized email campaign', 15000, 'one_time');

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

CREATE VIEW pipeline_summary AS
SELECT
  status,
  COUNT(*) AS contact_count
FROM contacts
WHERE NOT do_not_contact
GROUP BY status
ORDER BY contact_count DESC;

CREATE VIEW daily_metrics AS
SELECT
  DATE(occurred_at) AS day,
  COUNT(*) FILTER (WHERE type = 'email_sent') AS emails_sent,
  COUNT(*) FILTER (WHERE type = 'email_replied') AS replies,
  COUNT(*) FILTER (WHERE type = 'meeting_booked') AS meetings_booked,
  COUNT(*) FILTER (WHERE type = 'policy_blocked') AS policy_blocks
FROM activities
GROUP BY DATE(occurred_at)
ORDER BY day DESC;
