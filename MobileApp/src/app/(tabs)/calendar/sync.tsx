import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { AppText, Banner, Button, Card, Field, Input, Screen } from "@/components/ui";
import { HeaderButton } from "@/components/header-button";
import { confirm, errorMessage, useToast } from "@/components/feedback";

/**
 * The website's "Sync to Google" dialog. Same private feed (the calendar-feed Edge Function, keyed by the token in
 * calendar_feeds), so one link works everywhere. On an iPhone the webcal:// link subscribes in the Calendar app directly.
 */
export default function SyncScreen() {
  const router = useRouter();
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    // Event times are stored without a zone, so the feed uses the phone's. Saved on every open in case it changed.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    supabase
      .from("calendar_feeds")
      .upsert({ timezone }, { onConflict: "user_id" })
      .select("token")
      .single()
      .then(({ data, error }) => (error ? setError(error.message) : setToken(data.token)));
  }, []);

  const feedUrl = token ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calendar-feed?token=${token}` : "";
  const webcalUrl = feedUrl.replace(/^https?:/, "webcal:");
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(feedUrl);
      toast("Link copied");
    } catch (e) {
      toast(`Couldn't copy the link: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  const openInCalendar = () => Linking.openURL(webcalUrl).catch((e) => toast(`Couldn't open Calendar: ${errorMessage(e)}`, { tone: "error" }));

  const reset = async () => {
    if (!token) return;
    const ok = await confirm({
      title: "Reset the calendar link?",
      message: "The current link stops working right away, so subscribed calendars stop updating until you add the new one.",
      confirmLabel: "Reset link",
      destructive: true,
    });
    if (!ok) return;
    setResetting(true);
    const { data, error } = await supabase.from("calendar_feeds").update({ token: Crypto.randomUUID() }).eq("token", token).select("token").single();
    setResetting(false);
    if (error) {
      toast(`Couldn't reset the link: ${error.message}`, { tone: "error" });
      return;
    }
    setToken(data.token);
    toast("New link created. Add it to your calendar again.");
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <HeaderButton label="Done" bold onPress={() => router.back()} disabled={resetting} />, gestureEnabled: !resetting }} />
      <Screen>
        <AppText variant="muted">Your deadlines, interviews, tasks and events, in a calendar that keeps itself up to date.</AppText>
        {error ? (
          <Banner>{`Couldn't set up the calendar link: ${error}`}</Banner>
        ) : !token ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <Card>
              <AppText variant="heading">iPhone Calendar</AppText>
              <AppText variant="small">Adds a Pipeline calendar to the Calendar app on this phone.</AppText>
              <Button variant="primary" onPress={openInCalendar}>
                Add to Calendar
              </Button>
            </Card>
            <Card>
              <AppText variant="heading">Google Calendar</AppText>
              <AppText variant="small">Then tap Add when Google asks whether to add the calendar.</AppText>
              <Button onPress={() => WebBrowser.openBrowserAsync(googleUrl)}>Open Google Calendar</Button>
            </Card>
            <Field label="Calendar link" hint="Or paste this into any calendar app that subscribes by URL, like Outlook.">
              <View style={styles.linkRow}>
                <Input value={feedUrl} editable={false} selectTextOnFocus style={styles.link} numberOfLines={1} />
                <Button onPress={copy}>Copy</Button>
              </View>
            </Field>
            <Banner tone="info">
              {"Calendars check for changes every few hours, so edits can take a while to show up there. Make changes here, not in the other calendar. Anyone with this link can see your calendar; if it gets out, reset it."}
            </Banner>
            <Button variant="danger-ghost" onPress={reset} loading={resetting}>
              Reset link
            </Button>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 32, alignItems: "center" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: { flex: 1, fontSize: 13 },
});
