import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { isGoogleEnabled, signInWithGoogle } from "@/lib/google-sign-in";
import { AppText, Banner, Button, Field, Input, Screen } from "@/components/ui";
import { useTheme } from "@/theme/use-theme";

// Same flow and wording as the website's Login page. On success, the root layout picks up the new
// session through onAuthStateChange and switches to the tabs.
export default function SignIn() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    isGoogleEnabled().then(setGoogleEnabled);
  }, []);

  const signup = tab === "signup";

  const continueWithGoogle = async () => {
    setError(null);
    setNotice(null);
    setRedirecting(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError((e as Error).message);
    }
    setRedirecting(false);
  };

  const switchTab = () => {
    setTab(signup ? "signin" : "signup");
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (signup && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);
    if (signup) {
      // The confirmation link opens the website for now; the app's own link comes with Phase 1.
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
      if (error) setError(error.message);
      else if (!data.session) setNotice("Check your email for a confirmation link, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  const forgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email address first, then choose Forgot password.");
      return;
    }
    // The reset link opens the website, which updates the same account.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) setError(error.message);
    else setNotice("If an account exists for that email, a password reset link is on its way.");
  };

  return (
    <Screen>
        <View style={styles.brand}>
          <View style={[styles.mark, { backgroundColor: colors.accent }]} />
          <AppText variant="heading">Pipeline</AppText>
        </View>

        <View style={styles.intro}>
          <AppText variant="title">{signup ? "Create your account" : "Welcome back"}</AppText>
          <View style={styles.switchRow}>
            <AppText variant="muted">{signup ? "Already have an account? " : "New to Pipeline? "}</AppText>
            <Pressable onPress={switchTab} accessibilityRole="button" hitSlop={8}>
              <AppText style={{ color: colors.accentFg, fontWeight: "600" }}>{signup ? "Sign in" : "Create an account"}</AppText>
            </Pressable>
          </View>
        </View>

        {googleEnabled && (
          <View style={styles.google}>
            <Button onPress={continueWithGoogle} loading={redirecting} disabled={loading}>
              Continue with Google
            </Button>
            <View style={styles.divider} accessibilityRole="text" accessibilityLabel="or">
              <View style={[styles.rule, { backgroundColor: colors.line }]} />
              <AppText variant="small">or with email</AppText>
              <View style={[styles.rule, { backgroundColor: colors.line }]} />
            </View>
          </View>
        )}

        {signup && (
          <Field label="Full name">
            <Input value={name} onChangeText={setName} placeholder="Jordan Davis" autoComplete="name" textContentType="name" returnKeyType="next" />
          </Field>
        )}

        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@university.edu"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </Field>

        <Field
          label="Password"
          accessory={
            !signup && (
              <Pressable onPress={forgotPassword} accessibilityRole="button" hitSlop={8}>
                <AppText variant="small">Forgot password?</AppText>
              </Pressable>
            )
          }
        >
          <View>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder={signup ? "At least 8 characters" : "••••••••"}
              secureTextEntry={!showPassword}
              autoComplete={signup ? "new-password" : "current-password"}
              textContentType={signup ? "newPassword" : "password"}
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={submit}
              style={styles.passwordInput}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              style={styles.passwordToggle}
              hitSlop={8}
            >
              <AppText variant="small" style={{ fontWeight: "600" }}>
                {showPassword ? "Hide" : "Show"}
              </AppText>
            </Pressable>
          </View>
        </Field>

        {error && <Banner>{error}</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}

        <Button variant="primary" onPress={submit} loading={loading} disabled={redirecting}>
          {loading ? (signup ? "Creating account…" : "Signing in…") : signup ? "Create account" : "Sign in"}
        </Button>

        {signup && (
          <AppText variant="small" style={styles.terms}>
            By creating an account, you agree to the Terms of Service and Privacy Policy.
          </AppText>
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24 },
  mark: { width: 28, height: 28, borderCurve: "continuous", borderRadius: 8 },
  intro: { gap: 6, marginTop: 16, marginBottom: 8 },
  switchRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  passwordInput: { paddingRight: 64 },
  passwordToggle: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" },
  terms: { textAlign: "center" },
  google: { gap: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
