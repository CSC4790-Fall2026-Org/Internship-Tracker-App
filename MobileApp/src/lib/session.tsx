import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

/** The signed-in session, provided by the root layout to every screen behind sign-in. */
export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used on a signed-in screen");
  return session;
}

/** Same as the website: the full name from sign-up, else the start of the email. */
export function displayName(session: Session) {
  const fullName = session.user.user_metadata?.full_name as string | undefined;
  return fullName?.trim() || session.user.email?.split("@")[0] || "there";
}
