import { Alert, StyleSheet, View } from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { AppText, Button, Card, Screen, Segmented } from "@/components/ui";
import { HeaderButton } from "@/components/header-button";
import { useThemePreference, type ThemePreference } from "@/lib/theme-preference";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme/use-theme";

// The website's sidebar pages that don't get a tab of their own. `href` is missing until a later phase builds them.
const SECTIONS: { label: string; description: string; icon: SFSymbol; href?: Href; phase?: number }[] = [
  { label: "Networking", description: "Recruiters, alumni and people you've met", icon: "person.2", href: "/more/networking" },
  { label: "Career log", description: "Wins, projects, feedback and skills", icon: "trophy", href: "/more/career-log" },
  { label: "Brag doc", description: "Your career log, ready to paste into a review", icon: "doc.text", href: "/more/brag-doc" },
  { label: "Career Coach", description: "Advice grounded in your own data", icon: "sparkles", href: "/more/coach" },
  { label: "Profile", description: "Your resume and job preferences", icon: "person.crop.circle", href: "/more/profile" },
];

export default function More() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useSession();
  const name = (user.user_metadata?.full_name as string | undefined)?.trim();
  const [theme, setTheme] = useThemePreference();

  const signOut = () =>
    Alert.alert("Sign out?", "You'll need your email and password to sign back in.", [
      { text: "Cancel", style: "cancel" },
      // The root layout sees the session end and goes back to the sign-in screen.
      { text: "Sign out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <HeaderButton icon="magnifyingglass" label="Search" onPress={() => router.push("/search")} /> }} />
      <Card>
        {name ? <AppText variant="heading">{name}</AppText> : null}
        <AppText variant="muted">{user.email}</AppText>
      </Card>

      <Card style={styles.list}>
        {SECTIONS.map((section, i) => (
          <PressableScale feel="soft"
            key={section.label}
            accessibilityRole="button"
            accessibilityHint={section.href ? undefined : `Coming in phase ${section.phase}`}
            disabled={!section.href}
            onPress={() => section.href && router.push(section.href)}
            style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, pressed && { backgroundColor: colors.subtle }]}
          >
            <View style={[styles.icon, { backgroundColor: colors.muted }]}>
              <SymbolView name={section.icon} size={17} tintColor={colors.fg2} />
            </View>
            <View style={styles.grow}>
              <AppText style={[styles.label, !section.href && { color: colors.fgMuted }]}>{section.label}</AppText>
              <AppText variant="small">{section.description}</AppText>
            </View>
            {section.href ? <SymbolView name="chevron.right" size={13} tintColor={colors.fgFaint} /> : <AppText variant="small">Phase {section.phase}</AppText>}
          </PressableScale>
        ))}
      </Card>

      <Card>
        <AppText variant="heading">Appearance</AppText>
        <Segmented<ThemePreference>
          value={theme}
          onChange={setTheme}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <AppText variant="small">System follows your phone&apos;s Light and Dark setting.</AppText>
      </Card>

      <Button variant="danger-ghost" onPress={signOut}>
        Sign out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8 },
  icon: { width: 32, height: 32, borderCurve: "continuous", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  label: { fontWeight: "500" },
});
