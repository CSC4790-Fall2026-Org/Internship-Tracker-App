import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { DataProvider, useData } from "./data/DataContext";
import type { AppStatus } from "./data/types";
import AppShell from "./components/NavBar";
import { FeedbackProvider } from "./components/feedback";
import { Banner, Button, Card, EmptyState, Page, Skeleton, Spinner } from "./components/ui";
import { IconAlertCircle, IconRefresh } from "./components/icons";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import ApplicationsTable from "./pages/ApplicationsTable";
import ApplicationDetail from "./pages/ApplicationDetail";
import ApplicationFormModal from "./pages/AddApplication";
import AiCoach from "./pages/AiCoach";
import SearchPalette from "./components/SearchPalette";
import Calendar from "./pages/Calendar";
import Networking from "./pages/Networking";
import Jobs from "./pages/Jobs";
import Onboarding from "./pages/Onboarding";
import { fetchResumeProfile } from "./data/resume";

type Screen = "dashboard" | "pipeline" | "applications" | "detail" | "calendar" | "networking" | "jobs" | "ai-coach";

interface Route {
  screen: Screen;
  /** The application for "detail"; the status filter for "applications". */
  id: string;
}

const TITLES: Record<Screen, string> = {
  dashboard: "Dashboard",
  pipeline: "Board",
  applications: "Applications",
  detail: "Application",
  calendar: "Calendar",
  networking: "Networking",
  jobs: "Jobs",
  "ai-coach": "Profile",
};

const SEGMENT: Partial<Record<Screen, string>> = { pipeline: "board", calendar: "calendar", networking: "networking", jobs: "jobs", "ai-coach": "profile" };

// Screens live in the URL hash so the back button, refresh and shared links keep your place.
// The hash is only read and written once signed in, after Supabase has consumed any auth tokens in the URL.
function parseRoute(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [head, rest] = path.split("/");
  if (head === "applications") {
    return rest ? { screen: "detail", id: decodeURIComponent(rest) } : { screen: "applications", id: new URLSearchParams(query).get("status") ?? "" };
  }
  const screen = (Object.keys(SEGMENT) as Screen[]).find((s) => SEGMENT[s] === head);
  return { screen: screen ?? "dashboard", id: "" };
}

function routeHash({ screen, id }: Route): string {
  if (screen === "detail") return `#/applications/${encodeURIComponent(id)}`;
  if (screen === "applications") return id ? `#/applications?status=${id}` : "#/applications";
  return SEGMENT[screen] ? `#/${SEGMENT[screen]}` : "#/";
}

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

  if (checkingSession) return <FullScreenSpinner />;
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

  if (needsOnboarding === null) return <FullScreenSpinner />;

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
    <FeedbackProvider>
      <DataProvider>
        <AuthedApp session={session} />
      </DataProvider>
    </FeedbackProvider>
  );
}

// Stored on the user, so the step doesn't reappear on the next sign-in.
async function markOnboarded() {
  const { error } = await supabase.auth.updateUser({ data: { onboarded: true } });
  if (error) console.error("Couldn't record onboarding:", error.message);
}

function AuthedApp({ session }: { session: Session }) {
  const { loading, error, refresh, applications, tasks, contacts, events } = useData();
  // Nothing ever loaded: show the failure itself rather than an empty workspace that looks like a new account.
  const loadFailed = !!error && applications.length + tasks.length + contacts.length + events.length === 0;
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  // Row to open once a screen mounts, e.g. jumping to one contact from search.
  const [focusId, setFocusId] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  // The add form opens over whatever screen you're on; `status` pre-fills it, e.g. from a Board column.
  const [adding, setAdding] = useState<{ status?: AppStatus } | null>(null);

  const navigate = useCallback((screen: string, id?: string) => {
    if (screen === "add") {
      setAdding({ status: id as AppStatus | undefined });
      return;
    }
    const next: Route = { screen: screen as Screen, id: screen === "detail" || screen === "applications" ? id ?? "" : "" };
    setFocusId(screen === "networking" || screen === "calendar" ? id ?? "" : "");
    setRoute(next);
    const hash = routeHash(next);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setRoute(parseRoute(window.location.hash));
      setFocusId("");
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, []);

  useEffect(() => {
    document.title = `${TITLES[route.screen]} · Pipeline`;
  }, [route.screen]);

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

  const { screen, id } = route;

  return (
    <AppShell
      activeScreen={screen}
      onNavigate={navigate}
      onLogout={() => supabase.auth.signOut()}
      userName={displayName(session)}
      userEmail={session.user.email ?? ""}
      onOpenSearch={() => setSearchOpen(true)}
    >
      {loadFailed ? (
        <Page>
          <Card>
            <EmptyState
              icon={IconAlertCircle}
              title="Couldn't load your workspace"
              description={`${error.replace(/\.?$/, ".")} Check your connection and try again; nothing has been lost.`}
              actions={
                <Button variant="primary" icon={IconRefresh} onClick={() => refresh()}>
                  Try again
                </Button>
              }
            />
          </Card>
        </Page>
      ) : error && (
        <div className="mx-auto max-w-[1280px] px-4 pt-5 sm:px-6 lg:px-8">
          <Banner
            icon={IconAlertCircle}
            action={
              <Button size="sm" onClick={() => refresh()}>
                Retry
              </Button>
            }
          >
            Couldn't load your data: {error}
          </Banner>
        </div>
      )}
      {loading ? (
        <LoadingSkeleton />
      ) : loadFailed ? null : (
        <>
          {screen === "dashboard" && <Dashboard onNavigate={navigate} userName={displayName(session)} />}
          {screen === "pipeline" && <Pipeline onNavigate={navigate} />}
          {screen === "applications" && <ApplicationsTable key={id} onNavigate={navigate} initialStatus={id} />}
          {screen === "detail" && <ApplicationDetail key={id} appId={id} onNavigate={navigate} />}
          {screen === "jobs" && <Jobs onNavigate={navigate} />}
          {screen === "ai-coach" && <AiCoach userId={session.user.id} />}
          {screen === "networking" && <Networking onNavigate={navigate} focusContactId={focusId} onFocusHandled={() => setFocusId("")} />}
          {screen === "calendar" && <Calendar onNavigate={navigate} focusEventId={focusId} onFocusHandled={() => setFocusId("")} />}
        </>
      )}
      {adding && <ApplicationFormModal initialStatus={adding.status} onClose={() => setAdding(null)} onSaved={(newId) => navigate("detail", newId)} />}
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} onNavigate={navigate} />}
    </AppShell>
  );
}

function displayName(session: Session) {
  const fullName = session.user.user_metadata?.full_name as string | undefined;
  return fullName?.trim() || session.user.email?.split("@")[0] || "there";
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-fg-faint" role="status" aria-label="Loading">
      <Spinner size={20} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <Page>
      <div role="status" aria-label="Loading your applications">
        <Skeleton className="mb-2 h-6 w-48" />
        <Skeleton className="mb-8 h-4 w-72" />
        <Skeleton className="mb-6 h-24 w-full rounded-card" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-card lg:col-span-2" />
          <Skeleton className="h-72 rounded-card" />
        </div>
      </div>
    </Page>
  );
}
