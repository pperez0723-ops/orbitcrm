# OrbitCRM — Deployment Guide

Get OrbitCRM live on Vercel in ~15 minutes. Your Supabase database and the
Claude Edge Function are already set up and tested — this connects the app to them.

---

## Step 1 — Put the code on GitHub

1. Create a new **empty** repo at github.com (no README).
2. In a terminal, from inside this `orbitcrm-nextjs` folder:
   ```bash
   git init
   git add .
   git commit -m "OrbitCRM"
   git branch -M main
   git remote add origin https://github.com/YOU/orbitcrm.git
   git push -u origin main
   ```
   (Or use GitHub Desktop / drag-upload if you prefer no terminal.)

---

## Step 2 — Import into Vercel

1. Go to vercel.com → **Add New → Project** → import your repo.
2. Framework preset auto-detects as **Next.js**. Leave build settings default.
3. **Before clicking Deploy**, open **Environment Variables** and add the ones below.

---

## Step 3 — Environment variables (Vercel → Project → Settings → Environment Variables)

**Required (app won't work without these):**

| Name | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | already known: `https://jlbnieorltkfezixulxc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | in `.env.example` (safe, public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → **service_role** key |
| `CLAUDE_API_KEY` | your Anthropic `sk-ant-...` key |
| `CRON_SECRET` | make up any random string |
| `VOICE_WEBHOOK_SECRET` | make up any random string |

**Optional (only if using billing):**
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`

> Set each for **Production, Preview, and Development** (checkboxes in Vercel).

---

## Step 4 — Deploy

Click **Deploy**. Wait ~2 min. You'll get a URL like `https://orbitcrm-xxx.vercel.app`.

---

## Step 5 — Supabase Auth setup (one-time)

In Supabase → **Authentication → Providers → Email**:
- For fast testing: turn **"Confirm email" OFF** (signups log in instantly).
- Production: leave ON.

In Supabase → **Authentication → URL Configuration**:
- Set **Site URL** to your Vercel URL.
- Add `https://YOURAPP.vercel.app/**` to **Redirect URLs**.

---

## Step 6 — First run (and the testing checklist)

Open your Vercel URL and walk this exact order. Tell me any error message and
I'll patch it.

1. **Sign up** → should land on onboarding.
2. **Create workspace** → should land on dashboard (calls create_workspace +
   seed_default_pipeline — both tested).
3. **Contacts → Add Contact** → fill in, save → refresh page → still there? ✅ persistence.
4. **Contacts → AI Score All** → scores populate with reasons.
5. **Click a contact name** → detail page → **AI Brief** → summary appears.
6. **Pipeline** → New Deal → drag it between columns → reload → stayed moved? ✅
7. **Automations** → New Automation → add a Wait + Send Email step → Save →
   toggle Active.
8. **Autopilot** → set mode to Suggest → Run Now → suggestions appear → Approve one.
9. **Forms** → New Form → Copy link → open it in a new tab → submit → check a
   new contact appeared.
10. **OrbitAI assistant** (sparkle bottom-right) → "Add a contact named Test
    Person" → confirm it creates one.
11. **Mission Briefing** (dashboard) → Generate → reads your data.

If all 11 pass, the core product is live. Anything that errors, send me the
message — most fixes are one line.

---

## Step 7 — Cron worker (automations + autopilot run unattended)

- `vercel.json` already schedules `/api/cron` every minute.
- **Hobby plan** only allows daily cron. For minute-level (real automations),
  you need **Vercel Pro** ($20/mo). For testing, you can hit the cron URL
  manually: `https://YOURAPP.vercel.app/api/cron` with header
  `Authorization: Bearer YOUR_CRON_SECRET`.

---

## Step 8 — Voice agent (ElevenLabs) — see VOICE_SETUP.md
Once deployed, your voice webhook URLs are live. Follow VOICE_SETUP.md to wire
the ElevenLabs agent + Twilio number.

---

## Step 9 — Inbound messages (makes inbox 2-way)
- **SMS:** Twilio → your number → Messaging webhook →
  `https://YOURAPP.vercel.app/api/webhooks/twilio?ws=YOUR_WORKSPACE_ID`
- **Email replies:** point your inbound-email service to
  `https://YOURAPP.vercel.app/api/webhooks/resend?ws=YOUR_WORKSPACE_ID`
(Find YOUR_WORKSPACE_ID in Supabase `workspaces` table.)

---

## Expected reality
This is a big app deployed for the first time. Expect a few runtime bugs on the
first pass — a null field, a render edge case. That's normal. Go through the
Step 6 checklist, paste me any errors, and we patch them fast. The database
layer is already verified, so most issues will be small frontend/runtime fixes.
