import { useState, type ReactNode } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SymbolView, type SFSymbol } from "expo-symbols";
import type { Application, InterviewStage, Task } from "@shared/data/types";
import { useData } from "@shared/data/DataContext";
import { STATUS } from "@shared/data/status";
import { daysUntil, formatDate, formatTime, relativeDay, todayISO } from "@shared/data/dates";
import { AppText, Avatar, Badge, Button, Card, Checkbox, CompanyLogo, DueChip, EmptyState, Input, Screen, Segmented, StatusBadge, Textarea } from "@/components/ui";
import { StageTrack } from "@/components/applications";
import { DateField } from "@/components/date-field";
import { HeaderButton } from "@/components/header-button";
import { HeaderMenu, type MenuEntry } from "@/components/native-menu";
import { chooseAction, confirm, errorMessage, useToast } from "@/components/feedback";
import { useChangeStatus } from "@/data/use-change-status";
import { useTheme } from "@/theme/use-theme";

type Tab = "overview" | "interviews" | "contacts";

// The website's ApplicationDetail page.
export default function ApplicationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { applications, deleteApplications } = useData();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { pickStatus } = useChangeStatus();
  const [tab, setTab] = useState<Tab>("overview");
  const app = applications.find((a) => a.id === id);

  if (!app) {
    return (
      <Screen>
        <Card>
          <EmptyState title="Application not found" description="It may have been deleted, or the link is out of date.">
            <Button variant="primary" onPress={() => router.back()} style={styles.topGap}>
              Back to applications
            </Button>
          </EmptyState>
        </Card>
      </Screen>
    );
  }

  const edit = () => router.push({ pathname: "/applications/form", params: { id: app.id } });

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${app.company} · ${app.position}?`,
      message: "Its interview stages are deleted too, and linked contacts are unlinked. This can't be undone.",
      confirmLabel: "Delete application",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteApplications([app.id]);
      toast(`Deleted ${app.company}`);
      router.back();
    } catch (e) {
      toast(`Couldn't delete: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  const moreActions: MenuEntry[] = [
    ...(app.jobUrl ? [{ label: "Open job posting", icon: "safari" as const, onPress: () => WebBrowser.openBrowserAsync(app.jobUrl) }] : []),
    { label: "Edit details", icon: "pencil", onPress: edit },
    "divider",
    { label: "Delete application", icon: "trash", destructive: true, onPress: remove },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: app.company,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <HeaderButton label="Edit" onPress={edit} />
              <HeaderMenu label="More actions" items={moreActions} />
            </View>
          ),
        }}
      />
      <Screen>
        <View style={styles.hero}>
          <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={48} />
          <View style={styles.grow}>
            <AppText variant="title" style={styles.position}>
              {app.position}
            </AppText>
            <AppText variant="muted">{[app.company, app.location].filter(Boolean).join(" · ")}</AppText>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Stage: ${STATUS[app.status].label}. Change stage`}
          onPress={() => pickStatus(app)}
          style={({ pressed }) => [styles.stageButton, { borderColor: colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 }]}
        >
          <AppText variant="small">Stage</AppText>
          <StatusBadge status={app.status} />
          <View style={styles.grow} />
          <AppText variant="small">Change</AppText>
          <SymbolView name="chevron.up.chevron.down" size={13} tintColor={colors.fgMuted} />
        </Pressable>

        <StageTrack app={app} />

        <Card style={styles.facts}>
          <Fact icon="paperplane" label="Applied">
            {app.appliedDate ? <AppText>{formatDate(app.appliedDate)}</AppText> : <AppText variant="muted">Not yet</AppText>}
          </Fact>
          <Fact icon="flag" label="Deadline">
            {app.deadline ? (
              <View style={styles.inline}>
                <AppText>{formatDate(app.deadline)}</AppText>
                {(app.status === "wishlist" || app.status === "applied") && daysUntil(app.deadline) >= -14 && daysUntil(app.deadline) <= 30 && <DueChip date={app.deadline} />}
              </View>
            ) : (
              <AppText variant="muted">None set</AppText>
            )}
          </Fact>
          <Fact icon="banknote" label="Compensation">
            {app.salary ? <AppText>{app.salary}</AppText> : <AppText variant="muted">Not listed</AppText>}
          </Fact>
          <Fact icon="link" label="Posting">
            {app.jobUrl ? (
              <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(app.jobUrl)} hitSlop={6}>
                <AppText numberOfLines={1} style={{ color: colors.accentFg, fontWeight: "500" }}>
                  {hostOf(app.jobUrl)}
                </AppText>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={edit} hitSlop={6}>
                <AppText variant="muted" style={styles.underline}>
                  Add link
                </AppText>
              </Pressable>
            )}
          </Fact>
        </Card>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "interviews", label: "Interviews", count: app.interviewStages.length },
            { value: "contacts", label: "Contacts", count: app.contacts.length },
          ]}
        />

        {tab === "overview" && <Overview app={app} />}
        {tab === "interviews" && <Interviews app={app} />}
        {tab === "contacts" && <Contacts app={app} />}
      </Screen>
    </>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Fact({ icon, label, children }: { icon: SFSymbol; label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fact}>
      <View style={styles.factLabel}>
        <SymbolView name={icon} size={12} tintColor={colors.fgMuted} />
        <AppText variant="small">{label}</AppText>
      </View>
      {children}
    </View>
  );
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.grow}>
        <AppText variant="heading">{title}</AppText>
        {description && <AppText variant="small">{description}</AppText>}
      </View>
      {action}
    </View>
  );
}

// ---------- Overview ----------

function Overview({ app }: { app: Application }) {
  const { tasks, events, updateApplication, addTask, setTaskDone } = useData();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const [notes, setNotes] = useState(app.notes);
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved">("idle");
  const [taskDraft, setTaskDraft] = useState<{ text: string; due: string } | null>(null);
  const [addingTask, setAddingTask] = useState(false);

  const saveNotes = async () => {
    if (notes === app.notes) return;
    setNotesState("saving");
    try {
      await updateApplication(app.id, { notes });
      setNotesState("saved");
      setTimeout(() => setNotesState("idle"), 2000);
    } catch (e) {
      setNotesState("idle");
      toast(`Couldn't save notes: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  const submitTask = async () => {
    if (!taskDraft?.text.trim()) return;
    setAddingTask(true);
    try {
      await addTask({ text: taskDraft.text, due: taskDraft.due, applicationId: app.id });
      setTaskDraft(null);
      toast("Task added");
    } catch (e) {
      toast(`Couldn't add task: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setAddingTask(false);
    }
  };

  const related: { key: string; kind: "task" | "event"; date: string; title: string; time: string; task?: Task; eventId?: string }[] = [
    ...tasks.filter((t) => t.applicationId === app.id).map((t) => ({ key: `t-${t.id}`, kind: "task" as const, date: t.due, title: t.text, task: t, time: "" })),
    ...events.filter((e) => e.applicationId === app.id).map((e) => ({ key: `e-${e.id}`, kind: "event" as const, date: e.date, title: e.title, time: e.startTime, eventId: e.id })),
  ];
  related.sort((a, b) => Number(!!a.task?.done) - Number(!!b.task?.done) || (a.date || "9999").localeCompare(b.date || "9999"));

  return (
    <>
      <Card>
        <SectionHeader
          title="Notes"
          action={
            <AppText variant="small" accessibilityLiveRegion="polite">
              {notesState === "saving" ? "Saving…" : notesState === "saved" ? "Saved" : "Saves when you tap away"}
            </AppText>
          }
        />
        <Textarea
          accessibilityLabel="Notes"
          value={notes}
          onChangeText={setNotes}
          onBlur={saveNotes}
          placeholder="Referral, recruiter, what they're looking for, how it's going…"
          style={[styles.notes, { backgroundColor: colors.subtle, borderColor: colors.subtle }]}
        />
      </Card>

      <Card>
        <SectionHeader
          title="Tasks & events"
          description="Follow-ups and meetings linked to this application"
          action={!taskDraft && <HeaderButton icon="plus.circle" label="Add task" onPress={() => setTaskDraft({ text: "", due: "" })} />}
        />
        {taskDraft && (
          <View style={[styles.draft, { borderColor: colors.line, backgroundColor: colors.subtle }]}>
            <Input
              autoFocus
              accessibilityLabel="Task"
              placeholder={`e.g. Follow up with ${app.company} recruiter`}
              value={taskDraft.text}
              onChangeText={(text) => setTaskDraft({ ...taskDraft, text })}
              returnKeyType="done"
              onSubmitEditing={submitTask}
            />
            <DateField label="Due date" value={taskDraft.due} onChange={(due) => setTaskDraft({ ...taskDraft, due })} />
            <View style={styles.draftActions}>
              <Button variant="ghost" onPress={() => setTaskDraft(null)} disabled={addingTask}>
                Cancel
              </Button>
              <Button variant="primary" onPress={submitTask} loading={addingTask} disabled={!taskDraft.text.trim()}>
                Add
              </Button>
            </View>
          </View>
        )}
        {related.length === 0
          ? !taskDraft && <EmptyState title="Nothing linked yet" description="Add a follow-up task, or link a calendar event to this application." />
          : related.map((item) => (
              <View key={item.key} style={styles.relatedRow}>
                {item.kind === "task" ? (
                  <Checkbox
                    checked={item.task!.done}
                    label={`Mark "${item.title}" ${item.task!.done ? "not done" : "done"}`}
                    onPress={() => setTaskDone(item.task!.id, !item.task!.done).catch((e) => toast(errorMessage(e), { tone: "error" }))}
                  />
                ) : (
                  <View style={styles.eventDot}>
                    <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  </View>
                )}
                {item.eventId ? (
                  <Pressable accessibilityRole="button" accessibilityHint="Opens the event" onPress={() => router.push({ pathname: "/calendar/event", params: { id: item.eventId! } })} style={styles.grow}>
                    <AppText numberOfLines={1}>{item.title}</AppText>
                  </Pressable>
                ) : (
                  <AppText numberOfLines={1} style={[styles.grow, item.task?.done && { color: colors.fgMuted, textDecorationLine: "line-through" }]}>
                    {item.title}
                  </AppText>
                )}
                {item.kind === "event" ? (
                  <AppText variant="small">
                    {formatDate(item.date)}
                    {item.time ? ` · ${formatTime(item.time)}` : ""}
                  </AppText>
                ) : item.date ? (
                  item.task!.done ? <AppText variant="small">{formatDate(item.date)}</AppText> : <DueChip date={item.date} />
                ) : null}
              </View>
            ))}
      </Card>
    </>
  );
}

// ---------- Interviews ----------

function Interviews({ app }: { app: Application }) {
  const { addInterviewStage, setStageCompleted, deleteInterviewStage } = useData();
  const toast = useToast();
  const { colors, status: palette } = useTheme();
  const [draft, setDraft] = useState<{ name: string; date: string; notes: string } | null>(app.interviewStages.length === 0 ? { name: "", date: "", notes: "" } : null);
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  const add = async () => {
    if (!draft?.name.trim()) return;
    setSaving(true);
    try {
      await addInterviewStage(app.id, draft);
      setDraft(null);
      toast("Interview round added");
    } catch (e) {
      toast(`Couldn't add round: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (stage: InterviewStage) => setStageCompleted(stage.id, !stage.completed).catch((e) => toast(`Couldn't update: ${errorMessage(e)}`, { tone: "error" }));

  const remove = async (stage: InterviewStage) => {
    if (!(await confirm({ title: `Delete “${stage.name}”?`, message: "This removes the round and its notes.", confirmLabel: "Delete", destructive: true }))) return;
    deleteInterviewStage(stage.id).catch((e) => toast(`Couldn't delete: ${errorMessage(e)}`, { tone: "error" }));
  };

  return (
    <Card>
      <SectionHeader
        title="Interview rounds"
        description="Log each round as it's scheduled; check it off once it's done."
        action={!draft && <HeaderButton icon="plus.circle" label="Add round" onPress={() => setDraft({ name: "", date: "", notes: "" })} />}
      />

      {draft && (
        <View style={[styles.draft, { borderColor: colors.line, backgroundColor: colors.subtle }]}>
          <Input autoFocus accessibilityLabel="Round name" placeholder="Round name, e.g. Technical screen" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
          <DateField label="Date" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
          <Input accessibilityLabel="Notes" placeholder="Notes: who, format, what to prepare (optional)" value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} />
          <View style={styles.draftActions}>
            <Button variant="ghost" onPress={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onPress={add} loading={saving} disabled={!draft.name.trim()}>
              Add round
            </Button>
          </View>
        </View>
      )}

      {app.interviewStages.length === 0
        ? !draft && <EmptyState icon="clock" title="No rounds yet" description="Recruiter screens, technical interviews, onsites: log each one to track your progress." />
        : app.interviewStages.map((stage, i) => {
            const upcoming = !stage.completed && !!stage.date && stage.date >= today;
            const overdue = !stage.completed && !!stage.date && stage.date < today;
            return (
              <View key={stage.id} style={styles.round}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: stage.completed }}
                  accessibilityLabel={stage.completed ? `Mark ${stage.name} as not done` : `Mark ${stage.name} as done`}
                  onPress={() => toggle(stage)}
                  hitSlop={6}
                  style={[
                    styles.roundMarker,
                    stage.completed ? { backgroundColor: palette.interviewing.mark } : { borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.surface },
                  ]}
                >
                  {stage.completed ? <SymbolView name="checkmark" size={13} weight="bold" tintColor="#FFFFFF" /> : <AppText variant="small">{i + 1}</AppText>}
                </Pressable>
                <View style={[styles.roundBody, { borderColor: colors.line }]}>
                  <View style={styles.roundTop}>
                    <AppText style={[styles.bold, styles.shrink]}>{stage.name}</AppText>
                    {stage.completed ? <Badge tone="success">Done</Badge> : upcoming ? <Badge tone="accent">{relativeDay(stage.date)}</Badge> : overdue ? <Badge tone="warning">Needs update</Badge> : null}
                    <View style={styles.grow} />
                    <HeaderButton icon="trash" muted label={`Delete ${stage.name}`} onPress={() => remove(stage)} />
                  </View>
                  {stage.date ? <AppText variant="small">{formatDate(stage.date, { weekday: true })}</AppText> : null}
                  {stage.notes ? <AppText variant="muted">{stage.notes}</AppText> : null}
                </View>
              </View>
            );
          })}
    </Card>
  );
}

// ---------- Contacts ----------

function Contacts({ app }: { app: Application }) {
  const { contacts, addContact, setContactApplications } = useData();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<{ name: string; role: string; email: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // People not already on this application, with colleagues at the same company first.
  const linkable = contacts
    .filter((c) => !c.applicationIds.includes(app.id))
    .sort((a, b) => Number(b.company === app.company) - Number(a.company === app.company) || a.name.localeCompare(b.name));

  const run = async (op: () => Promise<unknown>, done: string) => {
    setSaving(true);
    try {
      await op();
      toast(done);
      return true;
    } catch (e) {
      toast(`Couldn't save: ${errorMessage(e)}`, { tone: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const linkExisting = () =>
    chooseAction(
      "Link someone you already know",
      linkable.map((c) => ({
        label: c.company ? `${c.name} · ${c.company}` : c.name,
        onPress: () => run(() => setContactApplications(c.id, [...c.applicationIds, app.id]), `Linked ${c.name}`),
      })),
    );

  const submit = async () => {
    if (!draft?.name.trim()) return;
    const ok = await run(() => addContact({ ...draft, company: app.company, phone: "", notes: "" }, [app.id]), `Added ${draft.name.trim()}`);
    if (ok) setDraft(null);
  };

  return (
    <Card>
      <SectionHeader title="People" description="Recruiters, interviewers and referrals for this role" action={!draft && <HeaderButton icon="person.badge.plus" label="New contact" onPress={() => setDraft({ name: "", role: "", email: "" })} />} />

      {linkable.length > 0 && (
        <Button onPress={linkExisting} disabled={saving}>
          Link someone you already know…
        </Button>
      )}

      {draft && (
        <View style={[styles.draft, { borderColor: colors.line, backgroundColor: colors.subtle }]}>
          <Input autoFocus accessibilityLabel="Name" placeholder="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} textContentType="name" />
          <Input accessibilityLabel="Role" placeholder="Role, e.g. Recruiter" value={draft.role} onChangeText={(role) => setDraft({ ...draft, role })} />
          <Input
            accessibilityLabel="Email"
            placeholder="Email"
            value={draft.email}
            onChangeText={(email) => setDraft({ ...draft, email })}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.draftActions}>
            <Button variant="ghost" onPress={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onPress={submit} loading={saving} disabled={!draft.name.trim()}>
              Add contact
            </Button>
          </View>
        </View>
      )}

      {app.contacts.length === 0
        ? !draft && <EmptyState icon="person.2" title="No one linked yet" description="Linking people here keeps track of who you've talked to for this role." />
        : app.contacts.map((contact) => (
            <View key={contact.id} style={[styles.contact, { borderColor: colors.line }]}>
              <Avatar name={contact.name} size={36} />
              <View style={styles.grow}>
                <Pressable accessibilityRole="button" accessibilityHint="Opens their contact details" onPress={() => router.push({ pathname: "/more/contact", params: { id: contact.id } })} hitSlop={6}>
                  <AppText style={[styles.bold, { color: colors.accentFg }]} numberOfLines={1}>
                    {contact.name}
                  </AppText>
                </Pressable>
                <AppText variant="small" numberOfLines={1}>
                  {[contact.role, contact.company].filter(Boolean).join(" · ") || "No role recorded"}
                </AppText>
                {contact.email ? (
                  <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${contact.email}`)} hitSlop={6}>
                    <AppText variant="small" numberOfLines={1} style={{ color: colors.accentFg }}>
                      {contact.email}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
              <HeaderButton
                icon="xmark.circle"
                muted
                label={`Unlink ${contact.name}`}
                disabled={saving}
                onPress={() => run(() => setContactApplications(contact.id, contact.applicationIds.filter((aid) => aid !== app.id)), `Unlinked ${contact.name}`)}
              />
            </View>
          ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 14 },
  hero: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  position: { fontSize: 22, lineHeight: 28 },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  bold: { fontWeight: "600" },
  topGap: { marginTop: 8 },
  underline: { textDecorationLine: "underline" },
  stageButton: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, paddingHorizontal: 12 },
  facts: { flexDirection: "row", flexWrap: "wrap", padding: 0, gap: 0 },
  fact: { width: "50%", paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  factLabel: { flexDirection: "row", alignItems: "center", gap: 5 },
  inline: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  notes: { minHeight: 140 },
  draft: { gap: 10, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, padding: 10 },
  draftActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  relatedRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 },
  eventDot: { width: 24, alignItems: "center" },
  dot: { width: 8, height: 8, borderCurve: "continuous", borderRadius: 4 },
  round: { flexDirection: "row", gap: 12 },
  roundMarker: { width: 28, height: 28, borderCurve: "continuous", borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 6 },
  roundBody: { flex: 1, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  roundTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  contact: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, padding: 12 },
});
