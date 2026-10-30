// The app's Supabase client. Shared files from the website import "../lib/supabase" and get this one
// instead (see metro.config.js), so it must export `supabase` under the same name.
import "expo-sqlite/localStorage/install";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import type { Database } from "@shared/lib/database.types";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill them in.");
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Phones have no URL for a session to arrive in.
    detectSessionInUrl: false,
  },
});

// Only refresh the session while the app is on screen.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
