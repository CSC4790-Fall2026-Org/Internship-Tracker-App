import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { AppStatus } from "@shared/data/types";
import { useData, type NewApplication } from "@shared/data/DataContext";
import { STATUS, STATUS_ORDER } from "@shared/data/status";
import { todayISO } from "@shared/data/dates";
import { AppText, Banner, EmptyState, Field, Input, Screen, StatusDot, Textarea } from "@/components/ui";
import { DateField } from "@/components/date-field";
import { HeaderButton } from "@/components/header-button";
import { errorMessage, useToast } from "@/components/feedback";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/theme/use-theme";

type FormState = NewApplication & { appliedDate: string };

/** Adds a scheme so "acme.com/jobs" still opens as a link. Same as the website's form. */
function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// The website's ApplicationFormModal as a sheet: `id` edits that application, otherwise it adds one
// (starting in `status` when opened from a Board column).
export default function ApplicationForm() {
  const { applications, addApplication, updateApplication } = useData();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string; status?: string }>();
  const application = params.id ? applications.find((a) => a.id === params.id) : undefined;
  const editing = !!params.id;
  const initialStatus = STATUS_ORDER.includes(params.status as AppStatus) ? (params.status as AppStatus) : "wishlist";

  const [form, setForm] = useState<FormState>(() => ({
    company: application?.company ?? "",
    position: application?.position ?? "",
    jobUrl: application?.jobUrl ?? "",
    deadline: application?.deadline ?? "",
    status: application?.status ?? initialStatus,
    location: application?.location ?? "",
    salary: application?.salary ?? "",
    notes: application?.notes ?? "",
    appliedDate: application?.appliedDate ?? "",
  }));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((f) => ({ ...f, [field]: value }));

  const errors = {
    company: form.company.trim() ? null : "Enter the company name.",
    position: form.position.trim() ? null : "Enter the role you're applying for.",
  };
  const invalid = !!(errors.company || errors.position);

  const submit = async () => {
    setTouched(true);
    if (invalid || saving) return;
    setSaving(true);
    setError(null);
    const payload = { ...form, jobUrl: normalizeUrl(form.jobUrl) };
    try {
      if (application) {
        await updateApplication(application.id, {
          company: payload.company,
          position: payload.position,
          jobUrl: payload.jobUrl,
          deadline: payload.deadline,
          status: payload.status,
          location: payload.location,
          salary: payload.salary,
          // Moving out of Wishlist without a date means "today"; moving back clears nothing.
          appliedDate: payload.status !== "wishlist" && !payload.appliedDate ? todayISO() : payload.appliedDate,
        });
        haptic.success();
        toast("Changes saved");
        router.back();
      } else {
        const id = await addApplication(payload);
        haptic.success();
        toast(`Added ${payload.company.trim()}`);
        router.back();
        router.push({ pathname: "/applications/[id]", params: { id } });
      }
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: editing ? "Edit application" : "New application",
        headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} disabled={saving} />,
        headerRight: () => (editing && !application ? null : <HeaderButton label={editing ? "Save" : "Add"} bold onPress={submit} disabled={saving} />),
        // A half-filled form shouldn't vanish with a stray swipe.
        gestureEnabled: !saving,
      }}
    />
  );

  if (editing && !application) {
    return (
      <>
        {header}
        <Screen>
          <EmptyState title="Application not found" description="It may have been deleted, or the link is out of date." />
        </Screen>
      </>
    );
  }

  return (
    <>
      {header}
      <Screen>
        {!editing && <AppText variant="muted">{"Track a job or internship you're interested in."}</AppText>}
        {error && <Banner>{`Couldn't save: ${error}`}</Banner>}

        <Field label="Company" error={touched ? errors.company : null}>
          <Input autoFocus={!editing} value={form.company} onChangeText={(v) => set("company", v)} placeholder="e.g. Stripe" autoComplete="organization" textContentType="organizationName" returnKeyType="next" />
        </Field>
        <Field label="Position" error={touched ? errors.position : null}>
          <Input value={form.position} onChangeText={(v) => set("position", v)} placeholder="e.g. Software Engineer Intern" textContentType="jobTitle" returnKeyType="next" />
        </Field>

        <Field label="Stage">
          <View accessibilityRole="radiogroup" style={styles.stages}>
            {STATUS_ORDER.map((s) => {
              const active = form.status === s;
              return (
                <Pressable
                  key={s}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityHint={STATUS[s].hint}
                  onPress={() => set("status", s)}
                  style={[styles.stage, { borderColor: active ? colors.fg : colors.line, borderWidth: active ? 2 : 1, backgroundColor: colors.surface }]}
                >
                  <StatusDot status={s} />
                  <AppText style={active && styles.bold}>{STATUS[s].label}</AppText>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Job posting" hint="Link to the listing">
          <Input
            value={form.jobUrl}
            onChangeText={(v) => set("jobUrl", v)}
            onBlur={() => set("jobUrl", normalizeUrl(form.jobUrl))}
            placeholder="company.com/careers/…"
            keyboardType="url"
            textContentType="URL"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>
        <Field label="Application deadline" hint="Shown on your dashboard and calendar">
          <DateField label="Application deadline" value={form.deadline} onChange={(v) => set("deadline", v)} />
        </Field>
        {editing && form.status !== "wishlist" && (
          <Field label="Applied on">
            <DateField label="Applied on" value={form.appliedDate} maximumDate={todayISO()} onChange={(v) => set("appliedDate", v)} />
          </Field>
        )}
        <Field label="Location">
          <Input value={form.location} onChangeText={(v) => set("location", v)} placeholder="e.g. New York, NY · Hybrid" />
        </Field>
        <Field label="Compensation">
          <Input value={form.salary} onChangeText={(v) => set("salary", v)} placeholder="e.g. $45/hr or $120k" />
        </Field>
        {!editing && (
          <Field label="Notes">
            <Textarea value={form.notes} onChangeText={(v) => set("notes", v)} placeholder="Referral, recruiter name, requirements, anything worth remembering…" />
          </Field>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  stages: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stage: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, borderCurve: "continuous", borderRadius: 10, paddingHorizontal: 12 },
  bold: { fontWeight: "600" },
});
