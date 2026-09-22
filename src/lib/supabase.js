import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const configuredPublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabasePublishableKey = configuredPublishableKey?.startsWith(
  "sb_publishable_",
)
  ? configuredPublishableKey
  : configuredAnonKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
