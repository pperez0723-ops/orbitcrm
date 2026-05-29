# OrbitCRM Voice Agent — ElevenLabs Setup

Your sellable voice product: an AI agent that answers calls, checks your
real availability, and books appointments straight into OrbitCRM — then
fires a follow-up automation. ElevenLabs handles the voice; OrbitCRM is
the brain.

## Architecture
```
Caller → Twilio number → ElevenLabs Agent (voice)
   → mid-call "server tools" call YOUR OrbitCRM:
       POST /api/voice/check-availability   (find open slots)
       POST /api/voice/book                 (book + create contact + enroll)
   → after call: POST /api/voice/post-call  (log transcript to timeline)
```

## One-time setup (per client / agent)

### 1. Deploy OrbitCRM to Vercel
Your endpoints will be:
- `https://YOURAPP.vercel.app/api/voice/check-availability`
- `https://YOURAPP.vercel.app/api/voice/book`
- `https://YOURAPP.vercel.app/api/voice/post-call`

Set env var `VOICE_WEBHOOK_SECRET` to a random string (the agent sends it
as header `x-voice-secret` so randoms can't hit your booking endpoint).

### 2. Get the client's workspace_id
Each client = one workspace. Find it in Supabase (`workspaces` table) or
have the app show it in Settings. The agent passes this in every tool call
so bookings land in the right client's CRM.

### 3. In ElevenLabs → Agents → (your agent) → Tools, add 2 Webhook (server) tools:

**Tool A: check_availability**
- Type: Webhook · Method: POST
- URL: `https://YOURAPP.vercel.app/api/voice/check-availability`
- Header: `x-voice-secret` = your secret
- Body parameters:
  - `workspace_id` (string) — set to the client's workspace id (fixed value)
  - `days` (number, LLM-filled, optional)
- Description for the LLM: "Get available appointment times before offering slots to the caller."

**Tool B: book_appointment**
- Type: Webhook · Method: POST
- URL: `https://YOURAPP.vercel.app/api/voice/book`
- Header: `x-voice-secret` = your secret
- Body parameters:
  - `workspace_id` (string, fixed)
  - `starts_at` (string, LLM) — ISO datetime of the chosen slot
  - `name` (string, LLM)
  - `phone` (string, LLM)
  - `email` (string, LLM, optional)
  - `title` (string, LLM, optional)
  - `enroll_automation_id` (string, fixed, optional) — auto-enroll caller in a follow-up
- Description: "Book the appointment once the caller confirms a time. Always call check_availability first."

### 4. Post-call webhook
ElevenLabs → Agent → Analysis/Webhooks → Post-call webhook URL:
`https://YOURAPP.vercel.app/api/voice/post-call`
Add `workspace_id` to the agent's metadata so the transcript logs to the
right workspace.

### 5. Connect the phone number
ElevenLabs → Phone Numbers → import your Twilio number (SID + auth token).
Assign this agent. ElevenLabs auto-configures the Twilio voice webhooks.

### 6. Agent prompt (starter)
> You are the booking assistant for [Client Business]. Be warm and brief.
> Goal: book an appointment. First ask what they need, then call
> check_availability, offer 2–3 times, and when they pick one, collect
> their name and phone, then call book_appointment. Confirm the booking
> out loud. If no times work, offer to take a message.

## Test
Call the number. The agent should offer real slots from your DB and, on
confirmation, create the appointment + contact in OrbitCRM. Check the
contact's timeline for the call log after you hang up.

## Reselling this
- Each client gets their own ElevenLabs agent (their voice, their script,
  their workspace_id) but they all hit the SAME OrbitCRM deployment.
- You can charge setup + monthly per agent. ElevenLabs bills you per minute;
  price your monthly to cover expected minutes + margin.
