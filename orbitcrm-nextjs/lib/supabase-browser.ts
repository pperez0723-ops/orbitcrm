// lib/supabase-browser.ts — client used in browser components.
// Carries the logged-in user's session; RLS applies.
'use client';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // During static prerender (build) env may be absent; use harmless
  // placeholders so construction doesn't throw. Real values are inlined
  // into the browser bundle at build on Vercel and used at runtime.
  return createBrowserClient(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder-anon-key'
  );
}
