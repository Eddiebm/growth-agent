-- AnswerShare by Makola — schema
-- Tenant isolation via as_organizations; demo rows flagged is_demo

CREATE TABLE IF NOT EXISTS as_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  access_token    TEXT NOT NULL UNIQUE,
  is_demo         BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  stripe_subscription_id TEXT,
  plan_key        TEXT NOT NULL DEFAULT 'free_audit',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS as_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES as_organizations(id) ON DELETE CASCADE,
  email           TEXT,
  name            TEXT,
  role            TEXT NOT NULL DEFAULT 'owner',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_users_org ON as_users (organization_id);

CREATE TABLE IF NOT EXISTS as_businesses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES as_organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  website_url     TEXT NOT NULL,
  website_normalized TEXT,
  service_category TEXT NOT NULL DEFAULT 'hvac',
  phone           TEXT,
  conversion_url  TEXT,
  gbp_url         TEXT,
  is_demo         BOOLEAN NOT NULL DEFAULT false,
  crawl_summary   JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_businesses_org ON as_businesses (organization_id);

CREATE TABLE IF NOT EXISTS as_business_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  service_areas   TEXT[] NOT NULL DEFAULT '{}',
  is_primary      BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_locations_business ON as_business_locations (business_id);

CREATE TABLE IF NOT EXISTS as_business_aliases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  alias           TEXT NOT NULL,
  UNIQUE (business_id, alias)
);

CREATE TABLE IF NOT EXISTS as_competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  website_url     TEXT,
  domain          TEXT,
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  approved        BOOLEAN NOT NULL DEFAULT false,
  suggested       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_competitors_business ON as_competitors (business_id);

CREATE TABLE IF NOT EXISTS as_buyer_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  intent_category TEXT NOT NULL DEFAULT 'purchase',
  location_label  TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'paused', 'archived')),
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_questions_business ON as_buyer_questions (business_id, status);

CREATE TABLE IF NOT EXISTS as_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES as_organizations(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'free'
    CHECK (kind IN ('free', 'monitoring', 'retest', 'demo')),
  status          TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed')),
  is_demo         BOOLEAN NOT NULL DEFAULT false,
  runs_per_provider INT NOT NULL DEFAULT 1,
  providers       TEXT[] NOT NULL DEFAULT '{}',
  progress        JSONB NOT NULL DEFAULT '{}',
  metrics         JSONB NOT NULL DEFAULT '{}',
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_audits_business ON as_audits (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_as_audits_org ON as_audits (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS as_provider_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        UUID NOT NULL REFERENCES as_audits(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES as_buyer_questions(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  engine          TEXT,
  model_version   TEXT,
  run_index       INT NOT NULL DEFAULT 1,
  prompt          TEXT NOT NULL,
  requested_location TEXT,
  response_text   TEXT,
  customer_mentioned BOOLEAN NOT NULL DEFAULT false,
  customer_recommended BOOLEAN NOT NULL DEFAULT false,
  customer_position INT,
  mentioned_businesses JSONB NOT NULL DEFAULT '[]',
  competitors_mentioned JSONB NOT NULL DEFAULT '[]',
  citations       JSONB NOT NULL DEFAULT '[]',
  cited_urls      TEXT[] NOT NULL DEFAULT '{}',
  cited_domains   TEXT[] NOT NULL DEFAULT '{}',
  sentiment       TEXT,
  provider_request_id TEXT,
  raw_response_redacted JSONB,
  error_status    TEXT,
  retry_count     INT NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(10, 6),
  ran_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audit_id, question_id, provider, run_index)
);

CREATE INDEX IF NOT EXISTS idx_as_provider_runs_audit ON as_provider_runs (audit_id);
CREATE INDEX IF NOT EXISTS idx_as_provider_runs_question ON as_provider_runs (question_id);

CREATE TABLE IF NOT EXISTS as_recommendations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        UUID NOT NULL REFERENCES as_audits(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  explanation     TEXT NOT NULL,
  category        TEXT NOT NULL,
  expected_impact TEXT,
  effort          TEXT NOT NULL DEFAULT 'medium'
    CHECK (effort IN ('low', 'medium', 'high')),
  confidence      NUMERIC(4, 3) NOT NULL DEFAULT 0.5,
  recommended_target TEXT,
  measurement_plan TEXT,
  retest_at       DATE,
  status          TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'in_progress', 'completed', 'rejected')),
  questions_affected UUID[] NOT NULL DEFAULT '{}',
  competitor_comparison TEXT,
  evidence_ids    UUID[] NOT NULL DEFAULT '{}',
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_recs_business ON as_recommendations (business_id, status);

CREATE TABLE IF NOT EXISTS as_experiments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES as_recommendations(id) ON DELETE SET NULL,
  hypothesis      TEXT NOT NULL,
  baseline_period_start TIMESTAMPTZ,
  baseline_period_end TIMESTAMPTZ,
  baseline_metrics JSONB NOT NULL DEFAULT '{}',
  change_implemented TEXT,
  implemented_at  TIMESTAMPTZ,
  questions_affected UUID[] NOT NULL DEFAULT '{}',
  retest_at       TIMESTAMPTZ,
  retest_audit_id UUID REFERENCES as_audits(id) ON DELETE SET NULL,
  retest_metrics  JSONB NOT NULL DEFAULT '{}',
  difference      JSONB NOT NULL DEFAULT '{}',
  confidence      NUMERIC(4, 3),
  outcome         TEXT NOT NULL DEFAULT 'awaiting_data'
    CHECK (outcome IN ('positive', 'negative', 'inconclusive', 'awaiting_data')),
  causation_note  TEXT NOT NULL DEFAULT 'Correlation only — not proven causation.',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS as_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        UUID NOT NULL REFERENCES as_audits(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES as_organizations(id) ON DELETE CASCADE,
  share_token_hash TEXT UNIQUE,
  share_token_hint TEXT,
  title           TEXT NOT NULL,
  summary_json    JSONB NOT NULL DEFAULT '{}',
  is_public       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_reports_audit ON as_reports (audit_id);

CREATE TABLE IF NOT EXISTS as_integration_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES as_organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'disconnected',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE TABLE IF NOT EXISTS as_usage_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES as_organizations(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  units           INT NOT NULL DEFAULT 1,
  cost_usd        NUMERIC(10, 6),
  audit_id        UUID REFERENCES as_audits(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_usage_org ON as_usage_records (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS as_audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES as_organizations(id) ON DELETE SET NULL,
  business_id     UUID REFERENCES as_businesses(id) ON DELETE SET NULL,
  event_name      TEXT NOT NULL,
  properties      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_events_name ON as_audit_events (event_name, created_at DESC);

CREATE TABLE IF NOT EXISTS as_crawl_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES as_businesses(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  status_code     INT,
  title           TEXT,
  meta_description TEXT,
  headings        JSONB NOT NULL DEFAULT '[]',
  canonical_url   TEXT,
  robots          TEXT,
  structured_data JSONB NOT NULL DEFAULT '[]',
  internal_links  TEXT[] NOT NULL DEFAULT '{}',
  excerpt         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, url)
);
