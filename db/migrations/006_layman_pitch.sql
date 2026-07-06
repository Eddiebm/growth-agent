-- Plain-language "what is this in 10 seconds" pitch per product

ALTER TABLE products ADD COLUMN IF NOT EXISTS layman_pitch TEXT;

COMMENT ON COLUMN products.layman_pitch IS 'One or two sentences a non-technical person understands in ~10 seconds.';

-- Seed pitches for active products
UPDATE products SET layman_pitch = 'We build a custom AI bot for your business in two weeks — it handles one repetitive job (like finding leads or answering emails) so you stop doing it by hand.'
WHERE slug = 'bot-mvp' AND layman_pitch IS NULL;

UPDATE products SET layman_pitch = 'Connect your GitHub repo and get a plain-English guide to how the code works — built for teams onboarding developers or handing projects to clients.'
WHERE slug = 'boswell-saas' AND layman_pitch IS NULL;

UPDATE products SET layman_pitch = 'An AI phone agent that answers your business line 24/7, books service calls, and catches jobs you would have missed after hours.'
WHERE slug = 'hvac-receptionist-agent' AND layman_pitch IS NULL;

-- Use existing GitHub descriptions as a starting point where we have them
UPDATE products
SET layman_pitch = description
WHERE layman_pitch IS NULL
  AND description IS NOT NULL
  AND length(trim(description)) >= 20;
