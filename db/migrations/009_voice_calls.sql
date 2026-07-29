-- Voice calls for warm Vapi follow-ups (Makola)
CREATE TABLE IF NOT EXISTS voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'vapi',
  provider_call_id TEXT UNIQUE,
  direction TEXT NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound', 'inbound')),
  intent TEXT NOT NULL DEFAULT 'warm_sales_follow_up',
  from_number TEXT,
  to_number TEXT,
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN (
      'initiated', 'ringing', 'in_progress', 'completed',
      'failed', 'no_answer', 'busy', 'canceled'
    )),
  disposition TEXT,
  summary TEXT,
  recording_url TEXT,
  transcript_excerpt TEXT,
  duration_seconds INT,
  cost_cents INT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_contact
  ON voice_calls (contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_calls_status
  ON voice_calls (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_calls_created
  ON voice_calls (created_at DESC);
