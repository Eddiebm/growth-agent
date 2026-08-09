/**
 * AnswerShare by Makola — AI visibility audits for local service businesses.
 *
 * Product surface lives at /answer-share on the dashboard app.
 * Domain logic: packages/answer-share
 * Schema: db/migrations/011_answer_share.sql
 * Architecture: docs/ANSWER_SHARE.md
 */

## What it does

AnswerShare shows whether Google and leading AI assistants mention, recommend, or cite a business on purchase-intent questions. Free audits generate Makola leads; monitoring is $199/month via Stripe.

## Local setup

```bash
cp .env.example .env
# Set DATABASE_URL
npm install
cd apps/dashboard && npm install && cd ../..
npm run db:migrate
npm run test
npm run build:dashboard
npm run dev:dashboard
```

Open http://localhost:3000/answer-share

### Demo mode (no paid APIs)

Defaults: `ANSWER_SHARE_FORCE_DEMO=true` and `ANSWER_SHARE_SYNC=true`.

1. Visit `/answer-share/free-audit` and keep Demo mode checked, **or**
2. `POST /api/answer-share/load-demo` to seed “Laclede Comfort HVAC” and open `/answer-share/dashboard`

Demo Data banners appear on product screens. Demo rows are never mixed into live customer metrics (`is_demo` flags).

### Run an audit with the worker

```bash
# In another terminal
npm run jobs:run
# Set ANSWER_SHARE_SYNC=false to require the worker
```

Job type: `answer_share_audit`.

## Environment variables

See `.env.example` for AnswerShare keys:

| Variable | Purpose |
|----------|---------|
| `ANSWER_SHARE_FORCE_DEMO` | Use demo provider only |
| `ANSWER_SHARE_SYNC` | Run audits inline |
| `ANSWER_SHARE_FREE_RUNS` | Runs per provider on free audits (1–3) |
| `ANSWER_SHARE_USE_LIVE` | Prefer live adapters when configured |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `PERPLEXITY_API_KEY` | Live answer providers |
| `SERPAPI_API_KEY` or `SERPER_API_KEY` | Google organic snapshot |
| `STRIPE_SECRET_KEY` | Checkout |
| `STRIPE_PRICE_ANSWER_SHARE_MONITORING` | Price ID for $199/mo |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification |

## Billing

Plan: **AnswerShare Monitoring — $199/month** (one business, 20 questions, 5 competitors, monthly audit).

Checkout: `POST /api/answer-share/checkout`  
Webhook: `POST /api/answer-share/stripe-webhook`  

Without Stripe env vars, checkout returns `configured: false` and the UI shows an unconfigured state (no crash).

## Tests

```bash
npm run test          # unit tests (vitest)
npm run build:dashboard
```

## Methodology (short)

Providers return normalized observations. Free audits default to 1 run/provider; monitoring uses up to 3. Scores: 35% mention, 25% recommendation, 20% citation, 10% position, 10% share of voice. Missing providers are excluded and weights renormalized with disclosure. Recommendations always link to evidence run IDs.

## Known limitations

- Live provider quality depends on API quotas and model grounding — not identical to consumer ChatGPT/Google UI.
- Crawler is bounded (few pages) and respects basic SSRF guards; JS-rendered sites may extract poorly.
- PDF download uses browser print; dedicated PDF binary generation is not included.
- Multi-user org invites are not built — session is an org access-token cookie.
- Accessibility automated axe suite is not wired; screens follow WCAG-oriented patterns (skip link, labels, tables, focus, reduced motion).

## Deploy

Same as Makola: dashboard on Vercel, API worker on Render, run `npm run db:migrate` on Neon, set AnswerShare env vars on both.
