import { useEffect, useState } from "react";

const seen = new Set<string>();

/**
 * True the first time a screen is shown this session, like the website's useFirstVisit: entrances play once,
 * and coming back to the screen is instant.
 */
export function useFirstVisit(key: string) {
  const [first] = useState(() => !seen.has(key));
  useEffect(() => {
    seen.add(key);
  }, [key]);
  return first;
}
