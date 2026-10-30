import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { Session } from "@supabase/supabase-js";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, useFonts } from "@expo-google-fonts/geist";
import { StatusBar } from "expo-status-bar";
import { DataProvider, useData } from "@shared/data/DataContext";
import { supabase } from "@/lib/supabase";
import { SessionContext } from "@/lib/session";
import { useNeedsOnboarding } from "@/lib/onboarding";
import { applySavedTheme } from "@/lib/theme-preference";
import { ToastProvider } from "@/components/feedback";
import { useTheme } from "@/theme/use-theme";
import { GEIST } from "@/components/text";

// Hold the splash screen until the font is loaded and we know who's signed in and whether they've onboarded,
// so no screen flashes.
SplashScreen.preventAutoHideAsync();
applySavedTheme();

// Coming back to the app after this long reloads everything, so edits made on the website show up.
const STALE_AFTER_MS = 30_000;

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const needsOnboarding = useNeedsOnboarding(session);
  const { scheme, colors } = useTheme();
  // Geist, the website's typeface. If it can't load, the app carries on in the system font rather than stalling.
  const [fontsLoaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const ready = (fontsLoaded || !!fontError) && !checkingSession && (!session || needsOnboarding !== null);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: colors.canvas, card: colors.surface, text: colors.fg, border: colors.line, primary: colors.accent } };
  const inApp = !!session && !needsOnboarding;

  const stack = (
    // Signing in or out, or finishing onboarding, flips these guards and Expo Router moves to whichever side is now allowed.
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="search"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Search",
            // Same header as the tab stacks: an opaque bar, so the search field sits below it rather than behind it.
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors.accent,
            headerTitleStyle: { color: colors.fg, fontFamily: GEIST.semibold },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );

  return (
    // Swipeable rows need gestures handled from the root.
    <GestureHandlerRootView style={styles.root}>
    <ThemeProvider value={theme}>
      <SessionContext value={session}>
        <StatusBar style="auto" />
        <ToastProvider>
          {inApp ? (
            // The website's DataProvider, unchanged: it loads and saves everything through Supabase. Keyed by user, so
            // signing in as someone else starts from a clean slate.
            <DataProvider key={session.user.id}>
              <RefreshOnForeground />
              {stack}
            </DataProvider>
          ) : (
            stack
          )}
        </ToastProvider>
      </SessionContext>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

/** Reloads the shared data when the app comes back after a while, since the website may have changed it. */
function RefreshOnForeground(): ReactNode {
  const { refresh } = useData();
  const leftAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") leftAt.current = Date.now();
      else if (state === "active" && leftAt.current !== null && Date.now() - leftAt.current > STALE_AFTER_MS) {
        leftAt.current = null;
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);
  return null;
}
