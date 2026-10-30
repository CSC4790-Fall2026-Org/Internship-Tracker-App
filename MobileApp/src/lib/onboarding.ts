import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { fetchResumeProfile } from "@shared/data/resume";
import { supabase } from "@/lib/supabase";

// Same rule as the website's SignedIn component in App.tsx, so finishing onboarding on either app counts for both.

/** Stored on the user, so the step doesn't reappear on the next sign-in, on either app. */
export async function markOnboarded() {
  const { error } = await supabase.auth.updateUser({ data: { onboarded: true } });
  if (error) console.error("Couldn't record onboarding:", error.message);
}

/** null while checking. Accounts created before onboarding existed may already have a parsed resume. */
export function useNeedsOnboarding(session: Session | null): boolean | null {
  // The answer from the resume check, tagged with whose it is so switching accounts can't reuse it.
  const [checked, setChecked] = useState<{ userId: string; needs: boolean } | null>(null);
  const userId = session?.user.id;
  const onboarded = !!session?.user.user_metadata?.onboarded;

  useEffect(() => {
    if (!userId || onboarded) return;
    fetchResumeProfile()
      .then(async (profile) => {
        if (!profile?.parsed_at) return setChecked({ userId, needs: true });
        await markOnboarded();
        setChecked({ userId, needs: false });
      })
      .catch(() => setChecked({ userId, needs: true }));
  }, [userId, onboarded]);

  if (!userId) return null;
  if (onboarded) return false;
  return checked?.userId === userId ? checked.needs : null;
}
