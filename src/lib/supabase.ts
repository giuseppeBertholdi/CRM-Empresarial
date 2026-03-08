import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function isSupabaseConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

export function getSupabaseAnonClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY."
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAdminClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase Admin não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
