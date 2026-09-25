import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { Tables, TablesUpdate } from "../lib/database.types";
import type { Application, AppStatus, CalendarEvent, Contact, Task } from "./types";
import { timeAgo, todayISO } from "./dates";

type ApplicationRow = Tables<"applications"> & {
  interview_stages: Tables<"interview_stages">[];
};

type ContactRow = Tables<"contacts"> & {
  application_contacts: { application_id: string }[];
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

export interface CalendarEventInput {
  title: string;
  date: string;
  startTime: string;
  notes: string;
  applicationId: string | null;
}

export interface ContactInput {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
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
  contacts: Contact[];
  events: CalendarEvent[];
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
  addContact: (contact: ContactInput, applicationIds?: string[]) => Promise<string>;
  updateContact: (id: string, patch: Partial<ContactInput>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  /** Replaces the set of applications a contact is linked to. */
  setContactApplications: (contactId: string, applicationIds: string[]) => Promise<void>;
  addEvent: (event: CalendarEventInput) => Promise<void>;
  updateEvent: (id: string, event: CalendarEventInput) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addTask: (task: { text: string; due: string; applicationId: string | null }) => Promise<void>;
  setTaskDone: (taskId: string, done: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const LOGO_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#6366F1", "#EC4899"];

export function logoFor(company: string) {
  const words = company.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : company.trim().slice(0, 2)).toUpperCase();
  const hash = [...company].reduce((h, c) => h + c.charCodeAt(0), 0);
  return { logo_initials: initials, logo_color: LOGO_COLORS[hash % LOGO_COLORS.length] };
}

function toEvent(row: Tables<"calendar_events">): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    // Postgres returns "HH:MM:SS"; the UI works in "HH:MM".
    startTime: row.start_time ? row.start_time.slice(0, 5) : "",
    notes: row.notes,
    applicationId: row.application_id,
  };
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    company: row.company,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    applicationIds: row.application_contacts.map((link) => link.application_id),
  };
}

function toApplication(row: ApplicationRow, contactsByApplication: Map<string, Contact[]>): Application {
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
    contacts: contactsByApplication.get(row.id) ?? [],
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
  const [contactRows, setContactRows] = useState<ContactRow[]>([]);
  const [eventRows, setEventRows] = useState<Tables<"calendar_events">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [apps, tasks, contacts, events] = await Promise.all([
        supabase.from("applications").select("*, interview_stages(*)").order("created_at"),
        supabase.from("tasks").select("*, applications(company)").order("done").order("due", { nullsFirst: false }),
        supabase.from("contacts").select("*, application_contacts(application_id)").order("name"),
        supabase.from("calendar_events").select("*").order("date"),
      ]);
      setAppRows(check(apps).data ?? []);
      setTaskRows(check(tasks).data ?? []);
      setContactRows(check(contacts).data ?? []);
      setEventRows(check(events).data ?? []);
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
    const contacts = contactRows.map(toContact);
    const contactsByApplication = new Map<string, Contact[]>();
    for (const contact of contacts) {
      for (const applicationId of contact.applicationIds) {
        contactsByApplication.set(applicationId, [...(contactsByApplication.get(applicationId) ?? []), contact]);
      }
    }
    const applications = appRows.map((row) => toApplication(row, contactsByApplication));
    const companyById = new Map(applications.map((a) => [a.id, a.company]));

    return {
      applications,
      contacts,
      events: eventRows.map(toEvent),
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

      addContact: async (contact, applicationIds = []) => {
        const { data } = check(
          await supabase
            .from("contacts")
            .insert({
              name: contact.name.trim(),
              role: contact.role.trim(),
              company: contact.company.trim(),
              email: contact.email.trim(),
              phone: contact.phone.trim(),
              notes: contact.notes,
            })
            .select("id")
            .single(),
        );
        const id = data!.id;
        if (applicationIds.length > 0) {
          check(
            await supabase
              .from("application_contacts")
              .insert(applicationIds.map((applicationId) => ({ application_id: applicationId, contact_id: id }))),
          );
        }
        await refresh();
        return id;
      },

      updateContact: (id, patch) =>
        mutate(() =>
          supabase
            .from("contacts")
            .update({
              ...(patch.name !== undefined && { name: patch.name.trim() }),
              ...(patch.role !== undefined && { role: patch.role.trim() }),
              ...(patch.company !== undefined && { company: patch.company.trim() }),
              ...(patch.email !== undefined && { email: patch.email.trim() }),
              ...(patch.phone !== undefined && { phone: patch.phone.trim() }),
              ...(patch.notes !== undefined && { notes: patch.notes }),
            })
            .eq("id", id),
        ),

      deleteContact: (id) => mutate(() => supabase.from("contacts").delete().eq("id", id)),

      setContactApplications: async (contactId, applicationIds) => {
        const current = contacts.find((c) => c.id === contactId)?.applicationIds ?? [];
        const added = applicationIds.filter((id) => !current.includes(id));
        const removed = current.filter((id) => !applicationIds.includes(id));

        if (removed.length > 0) {
          check(await supabase.from("application_contacts").delete().eq("contact_id", contactId).in("application_id", removed));
        }
        if (added.length > 0) {
          check(
            await supabase
              .from("application_contacts")
              .insert(added.map((applicationId) => ({ application_id: applicationId, contact_id: contactId }))),
          );
        }
        await refresh();
      },

      addEvent: (event) =>
        mutate(() =>
          supabase.from("calendar_events").insert({
            title: event.title.trim(),
            date: event.date,
            start_time: event.startTime || null,
            notes: event.notes,
            application_id: event.applicationId,
          }),
        ),

      updateEvent: (id, event) =>
        mutate(() =>
          supabase
            .from("calendar_events")
            .update({
              title: event.title.trim(),
              date: event.date,
              start_time: event.startTime || null,
              notes: event.notes,
              application_id: event.applicationId,
            })
            .eq("id", id),
        ),

      deleteEvent: (id) => mutate(() => supabase.from("calendar_events").delete().eq("id", id)),

      addTask: (task) =>
        mutate(() => supabase.from("tasks").insert({ text: task.text.trim(), due: task.due || null, application_id: task.applicationId })),

      setTaskDone: async (taskId, done) => {
        // Optimistic so the checkbox responds instantly
        setTaskRows((rows) => rows.map((t) => (t.id === taskId ? { ...t, done } : t)));
        await mutate(() => supabase.from("tasks").update({ done }).eq("id", taskId));
      },
    };
  }, [appRows, taskRows, contactRows, eventRows, loading, error, refresh, mutate]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
