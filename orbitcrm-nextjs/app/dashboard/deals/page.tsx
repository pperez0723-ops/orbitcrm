'use client';
import { useEffect, useRef } from 'react';

// Orbit Pipeline — v5 clickable hex orbital view. We fetch the pipeline
// function HTML and load it via srcDoc so the browser parses it as HTML
// (Supabase serves functions as text/plain) and the embedded JS can call
// list-leads / add-lead. Click a hex → lead detail card with a Call button.
export default function DealsPage() {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let active = true;
    fetch('https://jlbnieorltkfezixulxc.supabase.co/functions/v1/pipeline', { cache: 'no-store' })
      .then((r) => r.text())
      .then((html) => { if (active && ref.current) ref.current.srcdoc = html; })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return (
    <iframe
      ref={ref}
      style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
      title="Orbit Pipeline"
    />
  );
}
