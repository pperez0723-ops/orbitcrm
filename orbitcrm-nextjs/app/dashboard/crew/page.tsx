'use client';
import { useEffect, useRef } from 'react';

// Mission HQ — the walking-astronaut office deck (9 crew, 4 zones) with REAL
// dispatch: "Find businesses that need a website" runs the leadgen scraper and
// drafts an SMS per lead; other orders run the crew engine on the live CRM.
// We fetch the office function HTML and load it via srcDoc so the browser
// parses it as HTML (Supabase serves functions as text/plain) and the embedded
// JS can call the leadgen / crew / list-leads functions.
export default function CrewPage() {
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
      title="Orbit Mission HQ"
    />
  );
}
