import { useState } from "react";
import { supabase } from "../lib/supabase";

// On success, App picks up the new session via supabase.auth.onAuthStateChange.
export default function Login() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      setError("Enter your email address first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setError(error.message);
    else setNotice("If an account exists for that email, a password reset link is on its way.");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 13px",
    fontFamily: "var(--font-body)", fontSize: "0.875rem",
    color: "var(--foreground)", background: "var(--muted)",
    border: "1px solid var(--border)", borderRadius: "7px",
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--primary)";
    e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--border)";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 480px", background: "var(--background)" }}>

      {/* Left panel */}
      <div
        style={{
          background: "#1E3A8A",
          display: "flex", flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 56px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 15 15" fill="none">
              <circle cx="2.5" cy="7.5" r="2" fill="white" />
              <circle cx="7.5" cy="7.5" r="2" fill="white" fillOpacity="0.7" />
              <circle cx="12.5" cy="7.5" r="2" fill="white" fillOpacity="0.4" />
              <path d="M4.5 7.5h1.5M9.5 7.5h1.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.125rem", color: "white", letterSpacing: "-0.02em" }}>
            Pipeline
          </span>
        </div>

        {/* Main copy */}
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2.5rem", fontWeight: 700, color: "white", lineHeight: 1.12, letterSpacing: "-0.03em", marginBottom: "16px" }}>
            Track every application.<br />Miss nothing.
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.65, maxWidth: "380px", marginBottom: "48px" }}>
            Deadlines, interviews, and follow-ups in one place — so your job search doesn't live in a spreadsheet and three different browser tabs.
          </p>

          {/* Features */}
          <div style={{ display: "flex", gap: "40px" }}>
            {[
              { value: "Pipeline", label: "drag applications between stages" },
              { value: "Calendar", label: "deadlines and interviews at a glance" },
              { value: "Jobs", label: "search live internship listings" },
            ].map((s) => (
              <div key={s.label}>
                <p style={{ fontFamily: "var(--font-heading)", fontSize: "1.625rem", fontWeight: 700, color: "white", letterSpacing: "-0.02em", marginBottom: "2px" }}>
                  {s.value}
                </p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Project note */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "28px" }}>
          <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", color: "white", marginBottom: "4px" }}>
            Built by students, for students
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: "380px" }}>
            Pipeline is a student project that's still in active development. Expect new features and the occasional rough edge.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "52px 48px", background: "var(--card)", borderLeft: "1px solid var(--border)" }}>

        {/* Tab switcher */}
        <div style={{ display: "flex", background: "var(--muted)", borderRadius: "8px", padding: "3px", marginBottom: "32px" }}>
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                flex: 1, padding: "8px", borderRadius: "6px", border: "none",
                background: tab === t ? "var(--card)" : "transparent",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                fontFamily: "var(--font-body)", fontSize: "0.875rem",
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "var(--foreground)" : "var(--muted-foreground)",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {t === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.375rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em", marginBottom: "4px" }}>
            {tab === "signin" ? "Welcome back" : "Get started for free"}
          </h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
            {tab === "signin" ? "Sign in to your Pipeline account" : "No credit card required"}
          </p>
        </div>

        {/* Google SSO */}
        <button
          style={{ width: "100%", padding: "10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--muted)", fontFamily: "var(--font-body)", fontSize: "0.875rem", fontWeight: 500, color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "20px", transition: "background 0.12s" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--border)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--muted)")}
          onClick={() => { setNotice(null); setError("Google sign-in isn't set up yet. Use email and password for now."); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.3a3.68 3.68 0 0 1-1.6 2.42v2h2.58c1.51-1.39 2.4-3.44 2.4-5.88z" fill="#4285F4"/>
            <path d="M8 16c2.16 0 3.97-.71 5.3-1.94l-2.58-2a4.8 4.8 0 0 1-7.15-2.52H.96v2.07A8 8 0 0 0 8 16z" fill="#34A853"/>
            <path d="M3.57 9.54A4.8 4.8 0 0 1 3.32 8c0-.54.09-1.06.25-1.54V4.39H.96A8 8 0 0 0 0 8c0 1.29.31 2.51.96 3.61l2.61-2.07z" fill="#FBBC05"/>
            <path d="M8 3.18c1.22 0 2.31.42 3.17 1.24l2.37-2.37A8 8 0 0 0 .96 4.39l2.61 2.07A4.77 4.77 0 0 1 8 3.18z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {tab === "signup" && (
            <div>
              <label style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)", display: "block", marginBottom: "5px" }}>
                Full name
              </label>
              <input type="text" placeholder="Jordan Davis" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} required />
            </div>
          )}

          <div>
            <label style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)", display: "block", marginBottom: "5px" }}>
              Email address
            </label>
            <input type="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} required />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
              <label style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)" }}>Password</label>
              {tab === "signin" && (
                <button type="button" onClick={handleForgotPassword} style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Forgot password?
                </button>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder={tab === "signup" ? "Minimum 8 characters" : "••••••••"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: "40px" }}
                onFocus={onFocus} onBlur={onBlur} required minLength={tab === "signup" ? 8 : undefined}
              />
              <button
                type="button" onClick={() => setShowPassword((v) => !v)}
                style={{ position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", alignItems: "center", padding: 0 }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M1 8s2.5-4.5 6.5-4.5S14 8 14 8s-2.5 4.5-6.5 4.5S1 8 1 8z" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="7.5" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
                  {showPassword && <path d="M2 2l11 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />}
                </svg>
              </button>
            </div>
          </div>

          {tab === "signup" && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "2px" }}>
              <input type="checkbox" id="terms" required style={{ accentColor: "var(--primary)", marginTop: "2px", cursor: "pointer", flexShrink: 0 }} />
              <label htmlFor="terms" style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", cursor: "pointer", lineHeight: 1.5 }}>
                I agree to the{" "}
                <span style={{ color: "var(--primary)", textDecoration: "underline" }}>Terms of Service</span>
                {" "}and{" "}
                <span style={{ color: "var(--primary)", textDecoration: "underline" }}>Privacy Policy</span>
              </label>
            </div>
          )}

          {error && (
            <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "#B91C1C", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "7px", padding: "8px 12px" }}>
              {error}
            </p>
          )}
          {notice && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "#166534", background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: "7px", padding: "8px 12px" }}>
              {notice}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: "6px", width: "100%", padding: "11px",
              borderRadius: "7px", border: "none",
              background: loading ? "var(--muted)" : "var(--primary)",
              color: loading ? "var(--muted-foreground)" : "white",
              fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.9375rem",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 0.15s, background 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            {loading ? (
              <>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                  <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="26" strokeDashoffset="8" strokeLinecap="round" />
                </svg>
                {tab === "signin" ? "Signing in…" : "Creating account…"}
              </>
            ) : (
              tab === "signin" ? "Sign in" : "Create account"
            )}
          </button>
        </form>

        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", textAlign: "center", marginTop: "20px" }}>
          {tab === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => switchTab(tab === "signin" ? "signup" : "signin")}
            style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 600, padding: 0 }}
          >
            {tab === "signin" ? "Sign up free" : "Sign in"}
          </button>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
