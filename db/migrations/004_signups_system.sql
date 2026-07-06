-- Signups from landing page + nurture tracking

CREATE TABLE signups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT NOT NULL UNIQUE,
  name            TEXT,
  company         TEXT,
  source          TEXT NOT NULL DEFAULT 'landing',
  utm             JSONB NOT NULL DEFAULT '{}',
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  nurtured_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signups_created ON signups (created_at DESC);

-- Seed system defaults
INSERT INTO agent_memory (namespace, key, value)
VALUES
  ('system', 'outreach_paused', 'false'::jsonb),
  ('system', 'daily_send_cap', '10'::jsonb)
ON CONFLICT (namespace, key) DO NOTHING;
