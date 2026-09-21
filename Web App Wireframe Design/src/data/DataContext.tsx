import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { Tables, TablesUpdate } from "../lib/database.types";
import type { Application, AppStatus, Task } from "./types";
import { timeAgo, todayISO } from "./dates";

type ApplicationRow = Tables<"applications"> & {
  interview_stages: Tables<"interview_stages">[];
  contacts: Tables<"contacts">[];
};

type TaskRow = Tables<"tasks"> & { applications: { company: string } | null };

export interface NewApplication {
  company: string;
  position: string;
  jobUrl: string;
  deadline: string;
  status: AppStatus;
  location: string;
  salary: string;
  notes: string;
}

export interface ActivityItem {
  id: string;
  text: string;
  time: string;
  icon: "offer" | "rejected" | "interview" | "added" | "status";
}

interface DataContextValue {
  applications: Application[];
  tasks: Task[];
  recentActivity: ActivityItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addApplication: (input: NewApplication) => Promise<string>;
  updateApplication: (id: string, patch: Partial<Pick<Application, "status" | "notes">>) => Promise<void>;
  deleteApplications: (ids: string[]) => Promise<void>;
  addInterviewStage: (applicationId: string, stage: { name: string; date: string; notes: string }) => Promise<void>;
  setStageCompleted: (stageId: string, completed: boolean) => Promise<void>;
  addContact: (applicationId: string, contact: { name: string; role: string; email: string }) => Promise<void>;
  addTask: (task: { text: string; due: string; applicationId: string | null }) => Promise<void>;
  setTaskDone: (taskId: string, done: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const LOGO_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#6366F1", "#EC4899"];

function logoFor(company: string) {
  const words = company.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : company.trim().slice(0, 2)).toUpperCase();
  const hash = [...company].reduce((h, c) => h + c.charCodeAt(0), 0);
  return { logo_initials: initials, logo_color: LOGO_COLORS[hash % LOGO_COLORS.length] };
}

function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    company: row.company,
    position: row.position,
    status: row.status,
    appliedDate: row.applied_date ?? "",
    deadline: row.deadline ?? "",
    jobUrl: row.job_url,
    location: row.location,
    salary: row.salary,
    notes: row.notes,
    logoColor: row.logo_color,
    logoInitials: row.logo_initials,
    interviewStages: [...row.interview_stages]
      .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.created_at.localeCompare(b.created_at))
      .map((s) => ({ id: s.id, name: s.name, date: s.date ?? "", notes: s.notes, completed: s.completed })),
    contacts: row.contacts.map((c) => ({ id: c.id, name: c.name, role: c.role, company: c.company, email: c.email })),
  };
}

const STATUS_LABEL: Record<AppStatus, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Closed",
};

function toActivity(rows: ApplicationRow[]): ActivityItem[] {
  return [...rows]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5)
    .map((row) => {
      const wasEdited = new Date(row.updated_at).getTime() - new Date(row.created_at).getTime() > 1000;
      if (!wasEdited) {
        return { id: row.id, text: `Added ${row.company} – ${row.position}`, time: timeAgo(row.created_at), icon: "added" };
      }
      const icon = row.status === "offer" ? "offer" : row.status === "rejected" ? "rejected" : row.status === "interviewing" ? "interview" : "status";
      return { id: row.id, text: `${row.company} is now ${STATUS_LABEL[row.status]}`, time: timeAgo(row.updated_at), icon };
    });
}

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [appRows, setAppRows] = useState<ApplicationRow[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [apps, tasks] = await Promise.all([
        supabase.from("applications").select("*, interview_stages(*), contacts(*)").order("created_at"),
        supabase.from("tasks").select("*, applications(company)").order("done").order("due", { nullsFirst: false }),
      ]);
      setAppRows(check(apps).data ?? []);
      setTaskRows(check(tasks).data ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Run a mutation, then reload so every screen sees the saved state.
  const mutate = useCallback(
    async (op: () => PromiseLike<{ error: { message: string } | null }>) => {
      check(await op());
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<DataContextValue>(() => {
    const applications = appRows.map(toApplication);
    const companyById = new Map(applications.map((a) => [a.id, a.company]));

    return {
      applications,
      tasks: taskRows.map((t) => ({
        id: t.id,
        text: t.text,
        done: t.done,
        due: t.due ?? "",
        applicationId: t.application_id,
        company: t.applications?.company ?? (t.application_id ? companyById.get(t.application_id) ?? "" : ""),
      })),
      recentActivity: toActivity(appRows),
      loading,
      error,
      refresh,

      addApplication: async (input) => {
        const { data } = check(
          await supabase
            .from("applications")
            .insert({
              company: input.company.trim(),
              position: input.position.trim(),
              status: input.status,
              job_url: input.jobUrl.trim(),
              deadline: input.deadline || null,
              applied_date: input.status === "wishlist" ? null : todayISO(),
              location: input.location.trim(),
              salary: input.salary.trim(),
              notes: input.notes,
              ...logoFor(input.company),
            })
            .select("id")
            .single(),
        );
        await refresh();
        return data!.id;
      },

      updateApplication: (id, patch) => {
        const update: TablesUpdate<"applications"> = { ...patch };
        const current = appRows.find((r) => r.id === id);
        if (patch.status && patch.status !== "wishlist" && current && !current.applied_date) {
          update.applied_date = todayISO();
        }
        return mutate(() => supabase.from("applications").update(update).eq("id", id));
      },

      deleteApplications: (ids) => mutate(() => supabase.from("applications").delete().in("id", ids)),

      addInterviewStage: (applicationId, stage) =>
        mutate(() =>
          supabase.from("interview_stages").insert({ application_id: applicationId, name: stage.name.trim(), date: stage.date || null, notes: stage.notes }),
        ),

      setStageCompleted: (stageId, completed) => mutate(() => supabase.from("interview_stages").update({ completed }).eq("id", stageId)),

      addContact: (applicationId, contact) =>
        mutate(() =>
          supabase.from("contacts").insert({
            application_id: applicationId,
            name: contact.name.trim(),
            role: contact.role.trim(),
            email: contact.email.trim(),
            company: companyById.get(applicationId) ?? "",
          }),
        ),

      addTask: (task) =>
        mutate(() => supabase.from("tasks").insert({ text: task.text.trim(), due: task.due || null, application_id: task.applicationId })),

      setTaskDone: async (taskId, done) => {
        // Optimistic so the checkbox responds instantly
        setTaskRows((rows) => rows.map((t) => (t.id === taskId ? { ...t, done } : t)));
        await mutate(() => supabase.from("tasks").update({ done }).eq("id", taskId));
      },
    };
  }, [appRows, taskRows, loading, error, refresh, mutate]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
