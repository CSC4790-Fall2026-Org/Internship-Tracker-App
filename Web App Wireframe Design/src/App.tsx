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
import SearchPalette from "./components/SearchPalette";
import Calendar from "./pages/Calendar";
import Networking from "./pages/Networking";
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
  // Row to open once a screen mounts, e.g. jumping to one contact from search.
  const [focusId, setFocusId] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);

  const navigate = (newScreen: string, id?: string) => {
    if (newScreen === "detail" && id) setDetailId(id);
    setFocusId(newScreen === "networking" || newScreen === "calendar" ? id ?? "" : "");
    setScreen(newScreen as Screen);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isAddOpen = screen === "add";

  return (
    <div style={{ minHeight: "100%", background: "var(--background)" }}>
      <NavBar activeScreen={screen} onNavigate={navigate} onLogout={() => supabase.auth.signOut()} userName={displayName(session)} onOpenSearch={() => setSearchOpen(true)} />
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
            {screen === "networking" && <Networking onNavigate={navigate} focusContactId={focusId} onFocusHandled={() => setFocusId("")} />}
            {screen === "calendar" && <Calendar onNavigate={navigate} focusEventId={focusId} onFocusHandled={() => setFocusId("")} />}
          </>
        )}
      </main>
      {isAddOpen && <AddApplication onNavigate={navigate} />}
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} onNavigate={navigate} />}
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

