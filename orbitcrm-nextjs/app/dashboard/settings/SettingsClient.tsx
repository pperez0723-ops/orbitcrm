'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function SettingsClient({ workspaceId, initial }:
  { workspaceId: string; initial: any }) {
  const supabase = createClient();
  const [v, setV] = useState({
    twilio_sid: initial.twilio_sid || '', twilio_token: initial.twilio_token || '', twilio_from: initial.twilio_from || '',
    resend_key: initial.resend_key || '', resend_from: initial.resend_from || '',
  });
  const [saved, setSaved] = useState(false);

  async function save() {
    await supabase.from('integrations').upsert({ workspace_id: workspaceId, ...v, updated_at: new Date().toISOString() });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  const set = (k: string) => (e: any) => setV({ ...v, [k]: e.target.value });

  return (
    <>
      <div className="top"><div className="top-title">Settings</div></div>
      <div className="content">
        <div className="panel" style={{ maxWidth: 560, marginBottom: 16 }}>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>📱 SMS — Twilio</div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>Your own Twilio account powers SMS sending + the voice agent.</p>
          <div className="fg" style={{ marginBottom: 10 }}><label>Account SID</label><input value={v.twilio_sid} onChange={set('twilio_sid')} /></div>
          <div className="fg" style={{ marginBottom: 10 }}><label>Auth Token</label><input type="password" value={v.twilio_token} onChange={set('twilio_token')} /></div>
          <div className="fg"><label>From Number</label><input value={v.twilio_from} onChange={set('twilio_from')} placeholder="+1..." /></div>
        </div>
        <div className="panel" style={{ maxWidth: 560, marginBottom: 16 }}>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>✉️ Email — Resend</div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>Your Resend API key powers email sending from automations &amp; Autopilot.</p>
          <div className="fg" style={{ marginBottom: 10 }}><label>API Key</label><input type="password" value={v.resend_key} onChange={set('resend_key')} /></div>
          <div className="fg"><label>From Email</label><input value={v.resend_from} onChange={set('resend_from')} placeholder="you@yourdomain.com" /></div>
        </div>
        <button className="btn-save" onClick={save}>Save Integrations</button>
        {saved && <span style={{ fontSize: 12, color: 'var(--teal)', marginLeft: 10 }}>✓ saved</span>}
      </div>
    </>
  );
}
