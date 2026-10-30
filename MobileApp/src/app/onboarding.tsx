import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { saveOnboardingPreferences, type ResumeProfile, type UploadStage } from "@shared/data/resume";
import { CAREER_FIELDS, CAREER_STAGES, MAX_CAREER_FIELDS, type CareerField, type JobType } from "@shared/data/jobs";
import { AppText, Banner, Button, Card, Chip, ChoiceRow, Screen } from "@/components/ui";
import { pickResume, uploadAndParseResume } from "@/data/resume-upload";
import { markOnboarded } from "@/lib/onboarding";
import { displayName, useSession } from "@/lib/session";
import { useTheme } from "@/theme/use-theme";

// The website's Onboarding page: what you're looking for, your fields, then an optional resume.
// Finishing sets `onboarded` on the user; the root layout sees the updated session and opens the tabs.
export default function Onboarding() {
  const session = useSession();
  const [step, setStep] = useState<"looking-for" | "field" | "resume">("looking-for");
  const [jobType, setJobType] = useState<JobType | null>(null);
  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    setFinishing(true);
    await markOnboarded();
  };

  return (
    <Screen>
      <View style={styles.brand}>
        <BrandMark />
        <AppText variant="heading">Pipeline</AppText>
      </View>
      <Card style={styles.card}>
        {step === "looking-for" ? (
          <LookingFor
            firstName={displayName(session).split(" ")[0]}
            initial={jobType}
            onDone={(choice) => {
              setJobType(choice);
              setStep("field");
            }}
          />
        ) : step === "field" ? (
          <FieldStep jobType={jobType ?? "auto"} onBack={() => setStep("looking-for")} onDone={() => setStep("resume")} />
        ) : (
          <ResumeStep userId={session.user.id} finishing={finishing} onFinish={finish} />
        )}
      </Card>
    </Screen>
  );
}

function BrandMark() {
  const { colors } = useTheme();
  return <View style={[styles.mark, { backgroundColor: colors.accent }]} />;
}

function StepLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return <AppText style={[styles.stepLabel, { color: colors.accentFg }]}>{children}</AppText>;
}

function LookingFor({ firstName, initial, onDone }: { firstName: string; initial: JobType | null; onDone: (choice: JobType) => void }) {
  const [choice, setChoice] = useState<JobType | null>(initial);
  return (
    <>
      <View style={styles.header}>
        <StepLabel>Step 1 of 3</StepLabel>
        <AppText variant="title" style={styles.stepTitle}>
          Welcome, {firstName}
        </AppText>
        <AppText variant="muted">What are you looking for? This decides which listings the Jobs page finds for you.</AppText>
      </View>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {CAREER_STAGES.map((option) => (
          <ChoiceRow key={option.value} label={option.label} hint={option.hint} selected={choice === option.value} onPress={() => setChoice(option.value)} />
        ))}
      </View>
      <Button variant="primary" disabled={!choice} onPress={() => choice && onDone(choice)}>
        Continue
      </Button>
      <AppText variant="small" style={styles.center}>
        You can change this any time on the Jobs or Profile page.
      </AppText>
    </>
  );
}

function FieldStep({ jobType, onBack, onDone }: { jobType: JobType; onBack: () => void; onDone: () => void }) {
  const [fields, setFields] = useState<CareerField[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = fields.length >= MAX_CAREER_FIELDS;

  const save = async (careerFields: CareerField[]) => {
    setSaving(true);
    setError(null);
    try {
      await saveOnboardingPreferences({ jobType, careerFields });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.header}>
        <StepLabel>Step 2 of 3</StepLabel>
        <AppText variant="title" style={styles.stepTitle}>
          What field are you in?
        </AppText>
        <AppText variant="muted">{`Pick up to ${MAX_CAREER_FIELDS}. Job matches stay inside these, so you won't see roles from fields you don't work in.`}</AppText>
      </View>
      {error && <Banner>{`Couldn't save that: ${error}`}</Banner>}
      <View style={styles.chips}>
        {CAREER_FIELDS.map((field) => {
          const active = fields.includes(field.value);
          return (
            <Chip
              key={field.value}
              label={field.label}
              active={active}
              disabled={!active && full}
              onPress={() => setFields(active ? fields.filter((f) => f !== field.value) : [...fields, field.value])}
            />
          );
        })}
      </View>
      <AppText variant="small" accessibilityLiveRegion="polite" style={styles.limitNote}>
        {full ? `That's ${MAX_CAREER_FIELDS}. Unselect one to pick another.` : ""}
      </AppText>
      <Button variant="primary" onPress={() => save(fields)} loading={saving} disabled={fields.length === 0}>
        Continue
      </Button>
      <View style={styles.row}>
        <Button variant="ghost" onPress={onBack} disabled={saving}>
          Back
        </Button>
        <Button variant="ghost" onPress={() => save([])} disabled={saving}>
          Skip
        </Button>
      </View>
    </>
  );
}

function ResumeStep({ userId, finishing, onFinish }: { userId: string; finishing: boolean; onFinish: () => void }) {
  const { colors } = useTheme();
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = stage !== null;

  const choose = async () => {
    setError(null);
    try {
      const asset = await pickResume();
      if (!asset) return;
      setProfile(await uploadAndParseResume(userId, asset, setStage));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStage(null);
    }
  };

  if (profile) {
    return (
      <ProfileConfirmation
        profile={profile}
        finishing={finishing}
        onFinish={onFinish}
        onRetry={() => {
          setProfile(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <>
      <View style={styles.header}>
        <StepLabel>Step 3 of 3 · Optional</StepLabel>
        <AppText variant="title" style={styles.stepTitle}>
          Add your resume
        </AppText>
        <AppText variant="muted">{"We'll pull out your skills, experience and preferences. It powers your job matches, and you won't have to retype any of it."}</AppText>
      </View>
      {error && <Banner>{error}</Banner>}
      <View style={[styles.dropZone, { borderColor: colors.lineStrong, backgroundColor: colors.subtle }]}>
        {busy ? (
          <>
            <ActivityIndicator color={colors.accent} />
            <AppText style={styles.dropTitle}>{stage === "uploading" ? "Uploading…" : "Reading your resume…"}</AppText>
            <AppText variant="small">This usually takes a few seconds.</AppText>
          </>
        ) : (
          <>
            <View style={[styles.dropIcon, { borderColor: colors.line, backgroundColor: colors.surface }]}>
              <SymbolView name="arrow.up.doc" size={20} tintColor={colors.fgMuted} />
            </View>
            <AppText style={styles.dropTitle}>Choose your resume</AppText>
            <AppText variant="small">PDF, up to 5 MB</AppText>
            <Button variant="primary" onPress={choose} style={styles.dropButton}>
              Choose file
            </Button>
          </>
        )}
      </View>
      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        <AppText variant="small" style={styles.grow}>
          You can add it later from Profile.
        </AppText>
        <Button variant="ghost" onPress={onFinish} disabled={busy} loading={finishing}>
          Skip for now
        </Button>
      </View>
    </>
  );
}

function ProfileConfirmation({ profile, finishing, onFinish, onRetry }: { profile: ResumeProfile; finishing: boolean; onFinish: () => void; onRetry: () => void }) {
  const { colors } = useTheme();
  const rows = [
    { label: "Name", value: profile.full_name },
    { label: "School", value: profile.school },
    { label: "Major", value: profile.major },
    { label: "Graduation", value: profile.graduation },
    { label: "Looking for", value: CAREER_STAGES.find((s) => s.value === profile.job_type && s.value !== "auto")?.hint ?? "" },
    { label: "Fields", value: profile.career_fields.map((f) => CAREER_FIELDS.find((c) => c.value === f)?.label).join(", ") },
    { label: "Skills", value: profile.skills.slice(0, 6).join(", ") + (profile.skills.length > 6 ? ` +${profile.skills.length - 6} more` : "") },
    { label: "Experience", value: `${profile.experience.length} ${profile.experience.length === 1 ? "entry" : "entries"}` },
  ].filter((row) => row.value);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.row}>
          <View style={[styles.check, { backgroundColor: colors.successSoft }]}>
            <SymbolView name="checkmark" size={12} weight="bold" tintColor={colors.successFg} />
          </View>
          <AppText variant="title" style={[styles.stepTitle, styles.grow]}>
            {"Here's what we found"}
          </AppText>
        </View>
        <AppText variant="muted">You can correct any of this later in Profile.</AppText>
      </View>
      <View style={[styles.table, { borderColor: colors.line }]}>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.tableRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
            <AppText variant="small" style={styles.tableLabel}>
              {row.label}
            </AppText>
            <AppText style={styles.grow}>{row.value}</AppText>
          </View>
        ))}
      </View>
      <Button variant="primary" onPress={onFinish} loading={finishing}>
        Continue to Pipeline
      </Button>
      <Button variant="ghost" onPress={onRetry} disabled={finishing}>
        Upload a different file
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 },
  mark: { width: 26, height: 26, borderCurve: "continuous", borderRadius: 7 },
  card: { padding: 20, gap: 16 },
  header: { gap: 6 },
  stepLabel: { fontSize: 14, fontWeight: "500" },
  stepTitle: { fontSize: 22, lineHeight: 28 },
  options: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  limitNote: { minHeight: 18, marginTop: -6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  center: { textAlign: "center" },
  grow: { flex: 1 },
  dropZone: { alignItems: "center", gap: 4, borderWidth: 1, borderStyle: "dashed", borderCurve: "continuous", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 28 },
  dropIcon: { width: 40, height: 40, borderCurve: "continuous", borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  dropTitle: { fontWeight: "600", marginTop: 4 },
  dropButton: { marginTop: 12 },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  check: { width: 24, height: 24, borderCurve: "continuous", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  table: { borderWidth: StyleSheet.hairlineWidth, borderCurve: "continuous", borderRadius: 8 },
  tableRow: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  tableLabel: { width: 84 },
});
