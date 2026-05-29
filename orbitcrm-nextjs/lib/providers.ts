// lib/providers.ts — server-side send via each workspace's own credentials
// (read from the integrations table). Used by the worker and the send route.
import { SupabaseClient } from '@supabase/supabase-js';

export interface Creds {
  twilio_sid?: string; twilio_token?: string; twilio_from?: string;
  resend_key?: string; resend_from?: string;
}

export async function getCreds(admin: SupabaseClient, ws: string): Promise<Creds> {
  const { data } = await admin.from('integrations')
    .select('twilio_sid,twilio_token,twilio_from,resend_key,resend_from')
    .eq('workspace_id', ws).maybeSingle();
  return data || {};
}

export async function sendSMS(creds: Creds, to: string, body: string) {
  if (!creds.twilio_sid || !creds.twilio_token || !creds.twilio_from) return { ok: false, error: 'Twilio not configured' };
  const form = new URLSearchParams({ To: to, From: creds.twilio_from, Body: body });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.twilio_sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${creds.twilio_sid}:${creds.twilio_token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const d = await r.json();
  return d.sid ? { ok: true, id: d.sid } : { ok: false, error: d.message || 'SMS failed' };
}

export async function sendEmail(creds: Creds, to: string, subject: string, html: string) {
  if (!creds.resend_key || !creds.resend_from) return { ok: false, error: 'Resend not configured' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.resend_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: creds.resend_from, to: [to], subject: subject || '(no subject)', html: html || '' }),
  });
  const d = await r.json();
  return d.id ? { ok: true, id: d.id } : { ok: false, error: d.message || 'Email failed' };
}

export function mergeTags(text: string, c: any): string {
  return (text || '')
    .replace(/\{\{\s*first_name\s*\}\}/g, c?.fname || '')
    .replace(/\{\{\s*last_name\s*\}\}/g, c?.lname || '')
    .replace(/\{\{\s*company\s*\}\}/g, c?.company || '')
    .replace(/\{\{\s*email\s*\}\}/g, c?.email || '');
}
