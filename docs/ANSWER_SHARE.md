# AnswerShare by Makola — Architecture Decision Record

## Context

Makola is an outbound growth OS (Postgres CRM, job queue, Next.js dashboard). AnswerShare is a separate sellable surface: free AI-visibility audits that generate HVAC leads, plus $199/mo monitoring.

## Decisions

### 1. Provider adapters
All search/AI engines implement one `ProviderAdapter` interface and return a normalized `ProviderObservation`. Engines can be swapped without changing scoring, UI, or reports. Missing credentials disable an adapter; they never crash the audit.

### 2. Repeated runs
AI answers are nondeterministic. Each (question × provider × runIndex) is stored as its own row. Free audits default to 1 run/provider (cost control); monitoring defaults to 3. Confidence combines run count, cross-run agreement, and provider coverage.

### 3. Visibility score
Transparent component rates plus a 0–100 composite:
- Mention 35%, Recommendation 25%, Citation 20%, Position 10%, Share of voice 10%
Missing providers are excluded and the remaining weights are renormalized; UI discloses partial coverage.

### 4. Evidence-backed recommendations
Every action stores `evidence_ids` pointing at provider-run rows. UI never shows an action without an evidence link.

### 5. Demo vs live separation
`is_demo` on organizations/businesses/audits. Demo seed uses fixed UUIDs under namespace `demo`. Live audits never read demo rows for metrics. UI banners label Demo Data.

### 6. Auth
AnswerShare uses organization `access_token` cookies (`answer_share_session`), separate from Makola operator `DASHBOARD_SECRET`. Public report links use hashed share tokens without exposing raw provider payloads.

### 7. Jobs
Audits enqueue `answer_share_audit` on the existing Postgres `jobs` table. Demo/free audits may also run inline when `ANSWER_SHARE_SYNC_DEMO=true` or no worker is available.
