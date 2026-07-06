-- Seed default campaign + 3-step sequence for SEO agency outreach

INSERT INTO campaigns (id, name, slug, channel, playbook_id, status, daily_send_cap)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'SEO Agency Outreach',
  'seo-agency-outreach-v1',
  'email',
  'seo-agency-outreach-v1',
  'active',
  10
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sequences (campaign_id, step_number, delay_days, subject_template, body_template)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    0,
    0,
    'quick question about {{company}}''s lead gen',
    'Hi {{first_name}}, {{personalization_hook}} Most SEO agencies your size spend 5–10 hours/week on manual prospecting. We build AI bots that automate lead gen for about $500. Worth a 15-minute call this week?'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    1,
    3,
    're: {{company}} lead gen',
    'Hi {{first_name}}, following up — we recently helped a similar agency cut prospecting time by 80%. Still worth a quick chat?'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    2,
    7,
    'closing the loop',
    'Hi {{first_name}}, haven''t heard back — assuming timing isn''t right. Happy to reconnect later. Reply STOP to opt out.'
  )
ON CONFLICT (campaign_id, step_number) DO NOTHING;
