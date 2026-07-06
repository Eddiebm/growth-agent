-- Inbound email queue (populated by Resend webhook, consumed by replyTriageJob)

CREATE TABLE inbound_email_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email      CITEXT NOT NULL,
  to_email        CITEXT,
  subject         TEXT NOT NULL,
  body_text       TEXT NOT NULL,
  provider_id     TEXT NOT NULL UNIQUE,
  thread_id       TEXT,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  processed_at    TIMESTAMPTZ,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_unprocessed ON inbound_email_queue (received_at)
  WHERE processed_at IS NULL;
