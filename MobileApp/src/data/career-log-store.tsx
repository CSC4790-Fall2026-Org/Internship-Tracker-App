// The website loads the career log separately on each page (Career log, Brag doc). On the phone the list,
// the entry form and the brag doc are separate screens, so they share one copy here. Reads and writes go
// through the website's own careerLog.ts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { addCareerLogEntry, deleteCareerLogEntry, fetchCareerLog, sortEntries, updateCareerLogEntry, type CareerLogEntry, type CareerLogInput } from "@shared/data/careerLog";

interface CareerLogValue {
  entries: CareerLogEntry[];
  loading: boolean;
  error: string | null;
  /** After a load error: shows the spinner while it tries again. */
  reload: () => Promise<void>;
  /** Pull to refresh: keeps the current entries on screen until the new ones arrive. */
  refresh: () => Promise<void>;
  add: (input: CareerLogInput) => Promise<CareerLogEntry>;
  update: (id: string, input: CareerLogInput) => Promise<CareerLogEntry>;
  remove: (id: string) => Promise<void>;
}

const CareerLogContext = createContext<CareerLogValue | null>(null);

export function CareerLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<CareerLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(
    () =>
      fetchCareerLog()
        .then((rows) => {
          setEntries(rows);
          setError(null);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Pick up entries added on the website while the app was in the background.
  const leftAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") leftAt.current = Date.now();
      else if (state === "active" && leftAt.current !== null && Date.now() - leftAt.current > 30_000) {
        leftAt.current = null;
        fetchAll();
      }
    });
    return () => sub.remove();
  }, [fetchAll]);

  const value = useMemo<CareerLogValue>(
    () => ({
      entries,
      loading,
      error,
      reload: () => {
        setLoading(true);
        return fetchAll();
      },
      refresh: fetchAll,
      add: async (input) => {
        const saved = await addCareerLogEntry(input);
        setEntries((list) => sortEntries([...list, saved]));
        return saved;
      },
      update: async (id, input) => {
        const saved = await updateCareerLogEntry(id, input);
        setEntries((list) => sortEntries([...list.filter((e) => e.id !== id), saved]));
        return saved;
      },
      remove: async (id) => {
        await deleteCareerLogEntry(id);
        setEntries((list) => list.filter((e) => e.id !== id));
      },
    }),
    [entries, loading, error, fetchAll],
  );

  return <CareerLogContext value={value}>{children}</CareerLogContext>;
}

export function useCareerLog() {
  const ctx = useContext(CareerLogContext);
  if (!ctx) throw new Error("useCareerLog must be used inside <CareerLogProvider>");
  return ctx;
}
