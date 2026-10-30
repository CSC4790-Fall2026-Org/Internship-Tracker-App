import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CAREER_CATEGORIES, type CareerCategory, type CareerLogInput } from "@shared/data/careerLog";
import { formatDate, todayISO } from "@shared/data/dates";
import { useData } from "@shared/data/DataContext";
import { AppText, Banner, Button, Chip, EmptyState, Field, Input, Screen, Textarea } from "@/components/ui";
import { ApplicationPicker } from "@/components/application-picker";
import { DateField } from "@/components/date-field";
import { HeaderButton } from "@/components/header-button";
import { haptic } from "@/lib/haptics";
import { confirm, errorMessage, useToast } from "@/components/feedback";
import { useCareerLog } from "@/data/career-log-store";

const isCategory = (value: string | undefined): value is CareerCategory => CAREER_CATEGORIES.some((c) => c.value === value);

// The website's EntryModal as a sheet: `id` edits that entry, otherwise it adds one (in `category`, if given).
export default function EntryForm() {
  const { entries, add, update, remove: removeEntry } = useCareerLog();
  const { applications } = useData();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string; category?: string }>();
  const entry = params.id ? entries.find((e) => e.id === params.id) : undefined;
  const editing = !!params.id;

  const [form, setForm] = useState<CareerLogInput>(() =>
    entry
      ? { category: entry.category, title: entry.title, details: entry.details, impact: entry.impact, date: entry.date, applicationId: entry.applicationId }
      : { category: isCategory(params.category) ? params.category : "accomplishment", title: "", details: "", impact: "", date: todayISO(), applicationId: null },
  );
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CareerLogInput>(field: K, value: CareerLogInput[K]) => setForm((f) => ({ ...f, [field]: value }));
  const titleError = form.title.trim() ? null : "Give it a short title.";
  const dateError = form.date ? null : "Pick a date.";
  const hint = CAREER_CATEGORIES.find((c) => c.value === form.category)?.hint;
  // A link to an application that has since been deleted shows as "None".
  const linkedId = form.applicationId && applications.some((a) => a.id === form.applicationId) ? form.applicationId : null;

  const save = async () => {
    setTouched(true);
    if (titleError || dateError || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (entry) await update(entry.id, form);
      else await add(form);
      haptic.success();
      toast(entry ? "Entry saved" : "Added to your career log");
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    if (!(await confirm({ title: `Delete “${entry.title}”?`, message: "It will also disappear from your brag doc. This can't be undone.", confirmLabel: "Delete", destructive: true }))) return;
    setSaving(true);
    try {
      await removeEntry(entry.id);
      toast("Entry deleted");
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: editing ? "Edit entry" : "New entry",
        headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} disabled={saving} />,
        headerRight: () => (editing && !entry ? null : <HeaderButton label={editing ? "Save" : "Add"} bold onPress={save} disabled={saving} />),
        gestureEnabled: !saving,
      }}
    />
  );

  if (editing && !entry) {
    return (
      <>
        {header}
        <Screen>
          <EmptyState title="Entry not found" description="It may have been deleted, or the link is out of date." />
        </Screen>
      </>
    );
  }

  return (
    <>
      {header}
      <Screen>
        <AppText variant="muted">{entry ? `Logged ${formatDate(entry.date, { long: true })}` : "Write it down while the details are fresh."}</AppText>
        {error && <Banner>{`Couldn't save: ${error}`}</Banner>}
        <Field label="Category" hint={hint}>
          <View accessibilityRole="radiogroup" style={styles.chips}>
            {CAREER_CATEGORIES.map((c) => (
              <Chip key={c.value} label={c.label} active={form.category === c.value} onPress={() => set("category", c.value)} />
            ))}
          </View>
        </Field>
        <Field label="Date" error={touched ? dateError : null}>
          <DateField label="Date" required value={form.date} onChange={(v) => set("date", v)} />
        </Field>
        <Field label="Title" error={touched ? titleError : null}>
          <Input autoFocus={!editing} value={form.title} onChangeText={(v) => set("title", v)} placeholder="e.g. Shipped the onboarding redesign" maxLength={200} />
        </Field>
        <Field label="Details" hint="What you did, who you worked with, what was hard.">
          <Textarea value={form.details} onChangeText={(v) => set("details", v)} />
        </Field>
        <Field label="Impact" hint="Optional. The result, ideally with a number.">
          <Input value={form.impact} onChangeText={(v) => set("impact", v)} placeholder="e.g. Sign-up completion went from 52% to 71%" />
        </Field>
        <Field label="Related application" hint={applications.length === 0 ? "Optional. You haven't added any applications yet." : "Optional. For interview feedback, offers and the like."}>
          <ApplicationPicker value={linkedId} onChange={(v) => set("applicationId", v)} />
        </Field>
        {entry && linkedId && linkedId === entry.applicationId && (
          <Button variant="ghost" onPress={() => router.push({ pathname: "/applications/[id]", params: { id: linkedId } })}>
            Open application →
          </Button>
        )}
        {entry && (
          <Button variant="danger-ghost" onPress={remove} disabled={saving}>
            Delete entry
          </Button>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
