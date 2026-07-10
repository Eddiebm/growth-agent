-- Default outreach to automatic (daily cron sends at 08:00 UTC). Use dashboard to switch to triggered if needed.

INSERT INTO agent_memory (namespace, key, value)
VALUES ('system', 'outreach_mode', '"automatic"'::jsonb)
ON CONFLICT (namespace, key) DO NOTHING;
