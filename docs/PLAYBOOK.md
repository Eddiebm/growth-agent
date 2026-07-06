# Playbook — SEO Agency Cold Email

## Campaign

- **Slug:** seo-agency-outreach-v1
- **Channel:** email
- **Daily cap:** 10 sends
- **Sequence length:** 3 steps

## Sequence

### Step 0 (Day 0) — Problem-aware opener

**Subject variants:**
- A: `quick question about {{company}}'s lead gen`
- B: `{{first_name}} — automating outreach at {{company}}`

**Body template:**
```
Hi {{first_name}},

{{personalization_hook}}

Most SEO agencies your size spend 5–10 hours/week on manual prospecting. We build AI bots that automate lead gen and outreach for about $500.

Worth a 15-minute call this week?

{{sender_first_name}}
```

### Step 1 (Day 3) — Social proof bump

**Subject:** `re: {{company}} lead gen`

**Body:** One case study line + same CTA. Max 4 sentences.

### Step 2 (Day 7) — Breakup

**Subject:** `closing the loop`

**Body:** "Haven't heard back — assuming timing isn't right. Happy to reconnect later." + unsubscribe note.

## Personalization hooks

Priority order:
1. Recent job posting (hiring = growth signal)
2. Tech stack match (HubSpot, Zapier)
3. Client count / case study on their site
4. Generic industry pain fallback

## Reply routing

| Classification | Action |
|----------------|--------|
| interested | Notify owner + send Cal.com link |
| question | Auto-reply if FAQ; else escalate |
| objection | Escalate with suggested reply draft |
| not_now | Move to nurture, re-contact in 90 days |
| unsubscribe | Suppress immediately |

## Escalation triggers

- Contact at company with >$10K potential (100+ employees)
- Custom pricing request
- Legal/compliance question
- Angry or threatening reply
