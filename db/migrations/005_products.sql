-- Multi-product catalog + per-lead routing

CREATE TYPE product_status AS ENUM ('active', 'beta', 'paused', 'archived');

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  repo            TEXT,
  description     TEXT,
  status          product_status NOT NULL DEFAULT 'paused',
  landing_path    TEXT,
  price_cents     INT,
  billing         TEXT DEFAULT 'monthly'
                  CHECK (billing IN ('one_time', 'monthly', 'annual')),
  icp_rules       JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_status ON products (status) WHERE status = 'active';

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE signups ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX idx_contacts_product ON contacts (product_id);
CREATE INDEX idx_campaigns_product ON campaigns (product_id);

-- Link existing SEO campaign to bot-mvp product
INSERT INTO products (id, slug, name, repo, description, status, landing_path, price_cents, billing, icp_rules)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bot-mvp',
  'Bot MVP',
  'Eddiebm/growth-agent',
  'Custom AI bot delivered in 14 days for agencies and SMBs.',
  'active',
  '/p/bot-mvp',
  50000,
  'one_time',
  '{"industries":["seo","marketing agency","automation"],"titles":["founder","ceo","head of operations"],"minEmployees":10,"maxEmployees":200}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (slug, name, repo, description, status, landing_path, price_cents, billing, icp_rules)
VALUES
  (
    'boswell-saas',
    'Boswell Cloud',
    'Eddiebm/boswell-saas',
    'Hosted repo auditor — turns any codebase into a legible handoff doc.',
    'active',
    '/p/boswell-saas',
    2900,
    'monthly',
    '{"industries":["software","dev agency","saas","consulting"],"titles":["cto","vp engineering","head of engineering","founder"],"minEmployees":5,"maxEmployees":500,"keywords":["github","gitlab","codebase","developer"]}'::jsonb
  ),
  (
    'hvac-receptionist-agent',
    'HVAC AI Receptionist',
    'Eddiebm/hvac-receptionist-agent',
    'AI receptionist that answers calls and books HVAC jobs 24/7.',
    'active',
    '/p/hvac-receptionist-agent',
    29900,
    'monthly',
    '{"industries":["hvac","plumbing","home services","contractor"],"titles":["owner","general manager","operations"],"minEmployees":3,"maxEmployees":100,"keywords":["hvac","heating","cooling","service call"]}'::jsonb
  ),
  (
    'ai-estimator',
    'AI Estimator',
    'Eddiebm/ai-estimator',
    'AI-powered estimates for contractors and trades.',
    'paused',
    '/p/ai-estimator',
    9900,
    'monthly',
    '{"industries":["construction","contractor","trades"],"titles":["owner","estimator","project manager"],"minEmployees":2,"maxEmployees":200}'::jsonb
  ),
  (
    'build-my-first-agent',
    'Build My First Agent',
    'Eddiebm/build-my-first-agent',
    'Learn to build and deploy your first AI agent.',
    'paused',
    '/p/build-my-first-agent',
    19900,
    'one_time',
    '{"industries":["technology","startup"],"titles":["founder","developer","product manager"],"keywords":["ai","agent","automation"]}'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;

-- Campaigns per active product (skip bot-mvp — uses existing seo campaign)
INSERT INTO campaigns (name, slug, channel, playbook_id, status, daily_send_cap, product_id)
SELECT
  p.name || ' Outreach',
  p.slug || '-outreach-v1',
  'email',
  p.slug || '-outreach-v1',
  'active',
  10,
  p.id
FROM products p
WHERE p.status = 'active' AND p.slug != 'bot-mvp'
ON CONFLICT (slug) DO NOTHING;

UPDATE campaigns SET product_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
WHERE slug = 'seo-agency-outreach-v1';

-- Default 3-step sequences for new product campaigns
INSERT INTO sequences (campaign_id, step_number, delay_days, subject_template, body_template)
SELECT c.id, s.step_number, s.delay_days, s.subject_template, s.body_template
FROM campaigns c
CROSS JOIN (
  VALUES
    (0, 0, 'quick question about {{company}}', 'Hi {{first_name}}, {{personalization_hook}} I built something that might save your team real time — worth a 15-minute look this week?'),
    (1, 3, 're: {{company}}', 'Hi {{first_name}}, following up in case this slipped through. Still open to a quick chat?'),
    (2, 7, 'closing the loop', 'Hi {{first_name}}, assuming timing isn''t right. Happy to reconnect later. Reply STOP to opt out.')
) AS s(step_number, delay_days, subject_template, body_template)
WHERE c.slug LIKE '%-outreach-v1' AND c.slug != 'seo-agency-outreach-v1'
ON CONFLICT (campaign_id, step_number) DO NOTHING;
