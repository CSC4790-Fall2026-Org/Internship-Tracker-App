import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Banner, Button, Checkbox, Field, Input } from "../components/ui";
import { BrandMark } from "../components/NavBar";
import { IconAlertCircle, IconBoard, IconBriefcase, IconCalendar, IconCheckCircle, IconEye, IconEyeOff, IconInbox } from "../components/icons";

const FEATURES = [
  { icon: IconBoard, title: "A board for every stage", text: "Drag applications from wishlist to offer and see where things stand." },
  { icon: IconInbox, title: "Nothing slips", text: "Deadlines, overdue follow-ups and quiet applications surface on their own." },
  { icon: IconCalendar, title: "One calendar", text: "Interviews, deadlines, tasks and coffee chats in a single view." },
  { icon: IconBriefcase, title: "Matched openings", text: "Search live listings, or get picks ranked against your resume." },
];

// On success, App picks up the new session via supabase.auth.onAuthStateChange.
export default function Login() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${tab === "signup" ? "Create account" : "Sign in"} · Pipeline`;
  }, [tab]);

  // Show Google only once it's switched on in Supabase, so the button never leads to a "provider not enabled" page.
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => setGoogleEnabled(!!settings?.external?.google))
      .catch(() => setGoogleEnabled(false));
  }, []);

  // A failed or cancelled Google sign-in comes back with the reason in the URL; show it, then tidy the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, "") || window.location.search);
    const reason = params.get("error_description");
    if (!reason) return;
    setError(reason.replace(/\+/g, " "));
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const handleGoogle = async () => {
    setError(null);
    setNotice(null);
    setRedirecting(true);
    // Leaves the page for Google; App picks up the session when Supabase sends the person back here.
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) {
      setError(error.message);
      setRedirecting(false);
    }
  };

  const switchTab = (t: "signin" | "signup") => {
    setTab(t);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    if (tab === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
      });
      if (error) setError(error.message);
      else if (!data.session) setNotice("Check your email for a confirmation link, then sign in.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email) {
      setError("Enter your email address first, then choose Forgot password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setError(error.message);
    else setNotice("If an account exists for that email, a password reset link is on its way.");
  };

  const signup = tab === "signup";

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(480px,560px)]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#111218] px-12 py-12 text-white lg:flex xl:px-16">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" aria-hidden="true" />
        <div className="relative flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="text-base font-semibold tracking-[-0.015em]">Pipeline</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.03em]">
            Your whole job search,
            <br />
            <span className="text-white/55">organized.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">Deadlines, interviews and follow-ups in one place, instead of a spreadsheet and three browser tabs.</p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-white/80">
                  <f.icon size={16} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{f.title}</span>
                  <span className="block text-ui text-white/50">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative max-w-md border-t border-white/10 pt-6 text-xs leading-relaxed text-white/45">
          <span className="font-medium text-white/70">Built by students, for students.</span> Pipeline is a student project in active development. Expect new features and the occasional rough edge.
        </p>
      </aside>

      {/* Form */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark size={28} />
            <span className="text-base font-semibold tracking-[-0.015em]">Pipeline</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg">{signup ? "Create your account" : "Welcome back"}</h2>
          <p className="mt-1.5 text-sm text-fg-muted">
            {signup ? "Already have an account? " : "New to Pipeline? "}
            <button type="button" onClick={() => switchTab(signup ? "signin" : "signup")} className="font-medium text-accent-fg hover:underline hover:underline-offset-2">
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>

          {googleEnabled && (
            <div className="mt-8">
              <Button size="lg" onClick={handleGoogle} loading={redirecting} disabled={loading} className="w-full">
                {!redirecting && <GoogleLogo />}
                Continue with Google
              </Button>
              {signup && <p className="mt-2 text-center text-xs text-fg-muted">By continuing with Google, you agree to the Terms of Service and Privacy Policy.</p>}
              <div className="mt-6 flex items-center gap-3 text-xs text-fg-muted" role="separator" aria-label="or">
                <span className="h-px flex-1 bg-line" />
                or with email
                <span className="h-px flex-1 bg-line" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className={googleEnabled ? "mt-6 space-y-4" : "mt-8 space-y-4"}>
            {signup && (
              <Field label="Full name">
                <Input className="h-10 text-sm" type="text" placeholder="Jordan Davis" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
            )}

            <Field label="Email">
              <Input className="h-10 text-sm" type="email" placeholder="you@university.edu" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-ui font-medium text-fg-2">
                  Password
                </label>
                {!signup && (
                  <button type="button" onClick={handleForgotPassword} className="text-ui text-fg-muted transition-colors hover:text-fg">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  className="h-10 pr-10 text-sm"
                  type={showPassword ? "text" : "password"}
                  placeholder={signup ? "At least 8 characters" : "••••••••"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={signup ? 8 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-muted hover:text-fg"
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {signup && (
              <label className="flex cursor-pointer items-start gap-2.5 text-ui leading-relaxed text-fg-muted">
                <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required className="mt-[3px]" />
                <span>I agree to the Terms of Service and Privacy Policy.</span>
              </label>
            )}

            {error && <Banner icon={IconAlertCircle}>{error}</Banner>}
            {notice && (
              <Banner tone="success" icon={IconCheckCircle}>
                {notice}
              </Banner>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={redirecting} className="w-full">
              {loading ? (signup ? "Creating account…" : "Signing in…") : signup ? "Create account" : "Sign in"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

/** Google's "G" mark, in its official colours (required by Google's sign-in branding guidelines). */
function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
