# OrbitCRM — The Real Product (Next.js SaaS)

This is the resellable version: a real multi-tenant SaaS, not an HTML file.
Source code is protected (not in View Source), real accounts, deploy once
and every client gets updates, and it runs the automation engine you built.

It connects to the **same live Supabase database** that's already set up and
tested (project `jlbnieorltkfezixulxc`).

---

## What's inside

```
app/
  login/            real Supabase Auth (sign up + sign in)
  onboarding/       creates the workspace + seeds the pipeline (RPCs, already live)
  dashboard/        the app shell (sidebar) + live stats from the DB
  dashboard/contacts/  add / list / delete contacts — writes to the REAL database
  api/ai/           server-side Claude proxy (key stays on server)
  api/cron/         THE WORKER — drains the automation queue every minute
lib/                Supabase clients (browser / server / admin) + workspace resolver
components/Sidebar  nav + sign out
middleware.ts       session refresh + protects /dashboard
vercel.json         cron schedule (runs /api/cron every minute)
```

---

## Deploy in ~10 minutes

### 1. Put the code on GitHub
- Create a new empty repo on GitHub.
- Upload this whole folder (or `git init && git add . && git commit && git push`).

### 2. Import to Vercel
- vercel.com → Add New → Project → import your repo.
- Framework preset: **Next.js** (auto-detected). Don't deploy yet — set env first.

### 3. Set environment variables in Vercel
Project → Settings → Environment Variables. Add these:

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jlbnieorltkfezixulxc.supabase.co` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(your anon key)* | public, safe |
| `SUPABASE_SERVICE_ROLE_KEY` | *(from Supabase → Settings → API → service_role)* | **SECRET** |
| `CLAUDE_API_KEY` | *(your sk-ant- key)* | **SECRET** |
| `CRON_SECRET` | *(any random string)* | protects the worker endpoint |

> The anon key is already in `.env.example`. The service-role and Claude
> keys are secret — never commit them; only paste into Vercel.

### 4. Deploy
Hit Deploy. Vercel builds and hosts it. The cron job auto-registers from
`vercel.json` and starts hitting `/api/cron` every minute (needs a Pro plan
for 1-min cron; Hobby allows daily — fine for testing).

### 5. First run
- Open your Vercel URL → you'll hit `/login`.
- Sign up → it creates your auth account.
- Onboarding → name your workspace → it calls `create_workspace` +
  `seed_default_pipeline` (both already live and tested in your DB).
- Land on the dashboard → add a contact → **refresh** → it's still there.
  That's real persistence. Open it on your phone, log in — same data.

---

## Supabase Auth settings (one-time)
In Supabase → Authentication → Providers → Email:
- For fastest testing, turn **"Confirm email" OFF** so signups log in instantly.
- For production, leave it ON (users confirm via email) and optionally set up
  the Google provider for the "Google SSO" button.

---

## What works right now
- ✅ Real auth + multi-tenant workspaces (each client isolated by RLS)
- ✅ Onboarding that bootstraps a workspace + pipeline
- ✅ Contacts: create / list / delete against the live DB
- ✅ Live dashboard stats
- ✅ AI proxy (`/api/ai`)
- ✅ Automation worker scaffold (`/api/cron`) that claims + steps the queue

## What's next (the remaining verticals — same pattern as contacts)
- Deals / Kanban board
- Inbox + the webhook routes (inbound SMS/email) → makes comms 2-way
- Automation builder UI (the engine + worker are ready; needs the visual editor)
- Email/SMS sending wired into the worker's `send_email`/`send_sms` cases
- Stripe billing (subscriptions per workspace) — required before charging clients

Each new vertical is the contacts pattern repeated: a server page that loads
from the DB + a client component that writes back. The hard parts (schema,
engine, auth, worker) are done.
