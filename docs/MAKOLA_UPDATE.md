# Makola update checklist

Brand domain: **https://makola.org**  
Codebase: `growth-agent` (this repo)  
Dashboard project: Vercel `growth-agent-dashboard`  
API worker: Render (`growth-agent-yrll` / `growth-agent-crm`)

## Public site

1. Domain must not be on `clientHold` (ICANN email verified in Vercel Domains).
2. Vercel → Project → **Settings → Deployment Protection** → disable SSO for **Production** (or Standard Protection off for Production).
3. Confirm: `curl -sI https://makola.org` returns `200`.

## Live email

On Render Environment:

```
MOCK_INTEGRATIONS=false
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Alex <outreach@makola.org>
RESEND_REPLY_TO=alex@makola.org
RESEND_WEBHOOK_SECRET=whsec_...
```

Webhook URL: `https://<render-host>/webhooks/resend`

Warmup: start at 5 sends/day, then 10 → 20.

## Warm voice (post-reply only)

```
VAPI_API_KEY=...
VAPI_SALES_ASSISTANT_ID=...   # npm run vapi:setup-sales
VAPI_PHONE_NUMBER_ID=...      # or provisioned demo lines
VAPI_WEBHOOK_SECRET=...       # optional shared secret
VAPI_COST_PER_MIN_CENTS=15
CALCOM_BOOKING_URL=https://cal.com/you/15min
```

Webhook URL: `https://<render-host>/webhooks/vapi`

Flow: inbound email reply classified `book_meeting` → Telegram hot-lead → warm Vapi call → `voice_calls` row → end-of-call webhook writes disposition/note. Meetings stay **pending_confirmation** until `POST /api/meetings/:id/confirm`.

## Migrations

```bash
npm run db:migrate
```

Includes `009_voice_calls` and `010_meeting_confirmation` when present.

## Operator checks

```bash
npm run go-live:check
curl https://<render-host>/health   # expect "mock": false
```

## Dashboard

- Pipeline: `/dashboard`
- Calls: `/dashboard/calls`
- CAC: `/dashboard/cac`
