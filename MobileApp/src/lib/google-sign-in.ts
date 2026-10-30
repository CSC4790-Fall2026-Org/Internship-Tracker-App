// "Continue with Google" through Supabase's web OAuth flow, shown in an in-app browser sheet. It uses the
// same Google client as the website, so it works in Expo Go with no iOS-specific Google setup.
//
// Supabase only sends people back to URLs on its allow list (Authentication -> URL Configuration ->
// Redirect URLs). Add `pipeline://**` for builds of the app and `exp://**` for Expo Go, or Supabase falls
// back to the website and the sheet never returns to the app.
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

/** Where Supabase sends the person after Google: pipeline://auth/callback, or an exp:// URL in Expo Go. */
const redirectUrl = () => Linking.createURL("auth/callback");

/** Same check as the website: only offer Google once it's switched on in Supabase. */
export async function isGoogleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
    });
    const settings = res.ok ? await res.json() : null;
    return !!settings?.external?.google;
  } catch {
    return false;
  }
}

/**
 * Resolves true once signed in (the root layout then picks up the session), false if the person closes the sheet.
 * Throws with Supabase's or Google's reason when sign-in fails.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = redirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw new Error(error.message);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false;

  // The tokens (or the reason it failed) come back after the # in the redirect URL.
  const url = new URL(result.url);
  const params = new URLSearchParams(url.hash.replace(/^#/, "") || url.search);
  const reason = params.get("error_description");
  if (reason) throw new Error(reason.replace(/\+/g, " "));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) throw new Error("Google sign-in didn't finish. Try again.");

  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) throw new Error(sessionError.message);
  return true;
}
