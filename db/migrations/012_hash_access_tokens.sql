-- Stop storing AnswerShare org access tokens in plaintext.
-- Mirrors the existing share_token_hash pattern (see as_reports.share_token_hash).

ALTER TABLE as_organizations ADD COLUMN IF NOT EXISTS access_token_hash TEXT;

UPDATE as_organizations
SET access_token_hash = encode(digest(access_token, 'sha256'), 'hex')
WHERE access_token_hash IS NULL;

ALTER TABLE as_organizations ALTER COLUMN access_token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS as_organizations_access_token_hash_key
  ON as_organizations (access_token_hash);

ALTER TABLE as_organizations DROP COLUMN access_token;
