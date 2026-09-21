import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { DataProvider, useData } from "./data/DataContext";
import NavBar from "./components/NavBar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import ApplicationsTable from "./pages/ApplicationsTable";
import ApplicationDetail from "./pages/ApplicationDetail";
import AddApplication from "./pages/AddApplication";
import AiCoach from "./pages/AiCoach";
import Onboarding from "./pages/Onboarding";
import { fetchResumeProfile } from "./data/resume";

type Screen = "dashboard" | "pipeline" | "applications" | "detail" | "add" | "calendar" | "networking" | "ai-coach";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => data.subscription.unsubscribe();
  }, []);

  if (checkingSession) return <CenteredMessage text="Loading…" />;
  if (!session) return <Login />;

  // Keyed by user so switching accounts resets onboarding state and all loaded data
  return <SignedIn key={session.user.id} session={session} />;
}

/** New accounts get the resume step once, before the app proper. */
function SignedIn({ session }: { session: Session }) {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (session.user.user_metadata?.onboarded) {
      setNeedsOnboarding(false);
      return;
    }
    // Accounts created before this flow existed may already have a resume on file.
    fetchResumeProfile()
      .then(async (profile) => {
        if (!profile) return setNeedsOnboarding(true);
        await markOnboarded();
        setNeedsOnboarding(false);
      })
      .catch(() => setNeedsOnboarding(true));
  }, [session.user.id, session.user.user_metadata?.onboarded]);

  if (needsOnboarding === null) return <CenteredMessage text="Loading…" />;

  if (needsOnboarding) {
    return (
      <Onboarding
        userId={session.user.id}
        userName={displayName(session)}
        onFinish={async () => {
          await markOnboarded();
          setNeedsOnboarding(false);
        }}
      />
    );
  }

  return (
    <DataProvider>
      <AuthedApp session={session} />
    </DataProvider>
  );
}

// Stored on the user, so the step doesn't reappear on the next sign-in.
async function markOnboarded() {
  const { error } = await supabase.auth.updateUser({ data: { onboarded: true } });
  if (error) console.error("Couldn't record onboarding:", error.message);
}

function AuthedApp({ session }: { session: Session }) {
  const { loading, error, refresh } = useData();
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [detailId, setDetailId] = useState<string>("");

  const navigate = (newScreen: string, id?: string) => {
    if (newScreen === "detail" && id) setDetailId(id);
    setScreen(newScreen as Screen);
  };

  const isAddOpen = screen === "add";

  return (
    <div style={{ minHeight: "100%", background: "var(--background)" }}>
      <NavBar activeScreen={screen} onNavigate={navigate} onLogout={() => supabase.auth.signOut()} userName={displayName(session)} />
      <main style={{ minHeight: "calc(100vh - 56px)" }}>
        {error && (
          <div style={{ maxWidth: "1400px", margin: "16px auto 0", padding: "0 24px" }}>
            <div style={{ background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "10px 14px", fontFamily: "var(--font-body)", fontSize: "0.8125rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Couldn't load your data: {error}</span>
              <button onClick={() => refresh()} style={{ background: "none", border: "none", color: "#B91C1C", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Retry</button>
            </div>
          </div>
        )}
        {loading ? (
          <CenteredMessage text="Loading your applications…" />
        ) : (
          <>
            {screen === "dashboard" && <Dashboard onNavigate={navigate} userName={displayName(session)} />}
            {(screen === "pipeline" || isAddOpen) && <Pipeline onNavigate={navigate} />}
            {screen === "applications" && <ApplicationsTable onNavigate={navigate} />}
            {screen === "detail" && <ApplicationDetail appId={detailId} onNavigate={navigate} />}
            {screen === "ai-coach" && <AiCoach userId={session.user.id} />}
            {(screen === "calendar" || screen === "networking") && (
              <PlaceholderScreen
                label={screen.charAt(0).toUpperCase() + screen.slice(1)}
                onNavigate={navigate}
              />
            )}
          </>
        )}
      </main>
      {isAddOpen && <AddApplication onNavigate={navigate} />}
    </div>
  );
}

function displayName(session: Session) {
  const fullName = session.user.user_metadata?.full_name as string | undefined;
  return fullName?.trim() || session.user.email?.split("@")[0] || "there";
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
      {text}
    </div>
  );
}

function PlaceholderScreen({ label, onNavigate }: { label: string; onNavigate: (s: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", gap: "12px" }}>
      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="2" stroke="var(--primary)" strokeWidth="1.5" />
          <rect x="12" y="3" width="7" height="7" rx="2" stroke="var(--primary)" strokeWidth="1.5" />
          <rect x="3" y="12" width="7" height="7" rx="2" stroke="var(--primary)" strokeWidth="1.5" />
          <rect x="12" y="12" width="7" height="7" rx="2" stroke="var(--primary)" strokeWidth="1.5" />
        </svg>
      </div>
      <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{label}</h2>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>This section is coming soon.</p>
      <button onClick={() => onNavigate("dashboard")} style={{ marginTop: "8px", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
        ← Back to Dashboard
      </button>
    </div>
  );
}
