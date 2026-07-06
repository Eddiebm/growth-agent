# Growth Agent

Autonomous marketing & sales system — Postgres CRM, agent workers, operator dashboard.

## Architecture

```
Landing (/)          → signup → Neon CRM
Dashboard (/dashboard) → pipeline, approvals, kill switch
API worker (:3456)     → cron, job queue, Resend webhook
```

## Quick start (local)

```bash
cd ~/Projects/growth-agent
cp .env.example .env
# Set DATABASE_URL (Neon)

npm install
cd apps/dashboard && npm install && cd ../..
npm run db:migrate

# Run API + dashboard together
npm run dev
```

- **Landing:** http://localhost:3000  
- **Dashboard:** http://localhost:3000/dashboard  
- **API health:** http://localhost:3456/health  

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon Postgres |
| `MOCK_INTEGRATIONS` | No | `true` = fake Apollo/Resend/LLM |
| `RESEND_API_KEY` | Prod | Outbound email |
| `RESEND_FROM_EMAIL` | Prod | `Name <outreach@domain.com>` |
| `APOLLO_API_KEY` | Prod | Lead enrichment |
| `OPENROUTER_API_KEY` | Prod | Agent LLM |
| `TELEGRAM_BOT_TOKEN` | No | Hot lead alerts |
| `OWNER_TELEGRAM_ID` | No | Your Telegram chat ID |
| `CALCOM_BOOKING_URL` | No | Meeting booking link |
| `DASHBOARD_SECRET` | Prod | Password-protect dashboard |
| `WORKER_API_KEY` | No | Secure kill-switch API |
| `DEFAULT_CAMPAIGN_ID` | No | Campaign UUID |
| `CRON_ENABLED` | No | `false` to disable scheduler |

## Deploy

### API worker (Render)

```bash
# render.yaml included — connect repo, set DATABASE_URL + keys
```

### Dashboard (Vercel)

```bash
cd apps/dashboard
vercel --prod
# Set DATABASE_URL, DASHBOARD_SECRET in Vercel env
```

### Resend webhook

Point to: `https://your-api.onrender.com/webhooks/resend`

## Daily loop (UTC)

| Time | Job |
|------|-----|
| 06:00 | Lead gen (Apollo) |
| 06:30 | Score + enroll |
| 08:00 | Outreach batch |
| */30 8–20 | Reply triage |
| 20:30 | Daily report → Telegram |

## Operator workflow

1. Check dashboard metrics each morning  
2. Approve/reject items in approval queue  
3. Use kill switch to pause outreach instantly  
4. Click contacts for full timeline  
5. Only intervene on hot leads and custom pricing  

## Project structure

```
apps/
  api/src/          # Worker, cron, webhooks, agents
  dashboard/        # Next.js landing + control plane
packages/
  schemas/          # Agent I/O (Zod)
  policies/         # Hard governance rules
  actions/          # Signup, approval handlers
  system-state/     # Kill switch, caps
db/migrations/      # Postgres schema
docs/               # ICP, offer, playbook, voice
```

## Go-live checklist

- [ ] `npm run db:migrate` on production Neon  
- [ ] Resend domain verified (SPF/DKIM/DMARC)  
- [ ] `MOCK_INTEGRATIONS=false`  
- [ ] Resend webhook → `/webhooks/resend`  
- [ ] `DASHBOARD_SECRET` set  
- [ ] Warmup: 5 → 10 → 20 sends/day  
- [ ] Telegram alerts tested  
