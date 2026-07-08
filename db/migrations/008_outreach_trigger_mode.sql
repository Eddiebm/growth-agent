-- Default outreach to trigger-gated mode (cron prepares leads; sends require explicit trigger)

INSERT INTO agent_memory (namespace, key, value)
VALUES ('system', 'outreach_mode', '"triggered"'::jsonb)
ON CONFLICT (namespace, key) DO NOTHING;
