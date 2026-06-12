'use client';
import { useEffect, useRef } from 'react';

// Mission HQ — renders the live office HQ (9 crew, 4 zones) and runs the REAL
// crew engine on dispatch. Fetch + srcDoc so the browser parses it as HTML.
export default function OfficePage() {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let active = true;
    fetch('https://jlbnieorltkfezixulxc.supabase.co/functions/v1/office', { cache: 'no-store' })
      .then((r) => r.text())
      .then((html) => { if (active && ref.current) ref.current.srcdoc = html; })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return (
    <iframe
      ref={ref}
      style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
      title="Mission HQ"
    />
  );
}
