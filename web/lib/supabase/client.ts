"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/** Anon, browser-safe client for reads + Realtime. Never holds the service-role key. */
export function browserSupabase(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    browserClient = createClient(url, anon, {
      auth: { persistSession: false },
    });
  }
  return browserClient;
}
