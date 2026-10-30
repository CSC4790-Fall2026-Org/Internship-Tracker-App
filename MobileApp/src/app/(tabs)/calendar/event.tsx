import { useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useData, type CalendarEventInput } from "@shared/data/DataContext";
import { todayISO } from "@shared/data/dates";
import { AppText, Banner, Button, EmptyState, Field, Input, Screen, Textarea } from "@/components/ui";
import { ApplicationPicker } from "@/components/application-picker";
import { DateField, TimeField } from "@/components/date-field";
import { HeaderButton } from "@/components/header-button";
import { haptic } from "@/lib/haptics";
import { confirm, errorMessage, useToast } from "@/components/feedback";

// The website's EventModal as a sheet: `id` edits that event, otherwise it adds one on `date`.
export default function EventForm() {
  const { events, addEvent, updateEvent, deleteEvent } = useData();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const event = params.id ? events.find((e) => e.id === params.id) : undefined;
  const editing = !!params.id;

  const [form, setForm] = useState<CalendarEventInput>(() => ({
    title: event?.title ?? "",
    date: event?.date ?? params.date ?? todayISO(),
    startTime: event?.startTime ?? "",
    notes: event?.notes ?? "",
    applicationId: event?.applicationId ?? null,
  }));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CalendarEventInput>(field: K, value: CalendarEventInput[K]) => setForm((f) => ({ ...f, [field]: value }));
  const titleError = form.title.trim() ? null : "Give the event a title.";
  const dateError = form.date ? null : "Pick a date.";

  const save = async () => {
    setTouched(true);
    if (titleError || dateError || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (event) await updateEvent(event.id, form);
      else await addEvent(form);
      haptic.success();
      toast(event ? "Event updated" : `Added “${form.title.trim()}”`);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!event) return;
    if (!(await confirm({ title: `Delete “${event.title}”?`, message: "This can't be undone.", confirmLabel: "Delete", destructive: true }))) return;
    setSaving(true);
    try {
      await deleteEvent(event.id);
      toast("Event deleted");
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: editing ? "Edit event" : "New event",
        headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} disabled={saving} />,
        headerRight: () => (editing && !event ? null : <HeaderButton label={editing ? "Save" : "Add"} bold onPress={save} disabled={saving} />),
        gestureEnabled: !saving,
      }}
    />
  );

  if (editing && !event) {
    return (
      <>
        {header}
        <Screen>
          <EmptyState title="Event not found" description="It may have been deleted, or the link is out of date." />
        </Screen>
      </>
    );
  }

  return (
    <>
      {header}
      <Screen>
        {!editing && <AppText variant="muted">Coffee chats, info sessions, career fairs, anything with a date.</AppText>}
        {error && <Banner>{`Couldn't save: ${error}`}</Banner>}
        <Field label="Title" error={touched ? titleError : null}>
          <Input autoFocus={!editing} value={form.title} onChangeText={(v) => set("title", v)} placeholder="e.g. Coffee chat with Sarah Chen" />
        </Field>
        <Field label="Date" error={touched ? dateError : null}>
          <DateField label="Date" required value={form.date} onChange={(v) => set("date", v)} />
        </Field>
        <Field label="Time" hint="Optional">
          <TimeField label="Time" value={form.startTime} onChange={(v) => set("startTime", v)} />
        </Field>
        <Field label="Related application">
          <ApplicationPicker value={form.applicationId} onChange={(v) => set("applicationId", v)} />
        </Field>
        <Field label="Notes">
          <Textarea value={form.notes} onChangeText={(v) => set("notes", v)} placeholder="Location, agenda, what to prepare…" />
        </Field>
        {event && (
          <Button variant="danger-ghost" onPress={remove} disabled={saving}>
            Delete event
          </Button>
        )}
      </Screen>
    </>
  );
}
