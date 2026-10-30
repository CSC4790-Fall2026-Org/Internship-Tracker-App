import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import type { Json } from "@shared/lib/database.types";
import { fetchOrCreateProfile, type ExperienceItem, type ResumeProfile, type UploadStage } from "@shared/data/resume";
import { CAREER_FIELDS, CAREER_STAGES, MAX_CAREER_FIELDS } from "@shared/data/jobs";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { AppText, Banner, Button, Card, Chip, Field, Input, Screen, Textarea } from "@/components/ui";
import { HeaderButton } from "@/components/header-button";
import { TagEditor } from "@/components/tag-editor";
import { chooseAction, useToast } from "@/components/feedback";
import { pickResume, uploadAndParseResume } from "@/data/resume-upload";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/theme/use-theme";

/** The website's Profile page: the resume behind job matches, and everything read from it, editable. */
export default function Profile() {
  const session = useSession();
  const toast = useToast();
  const { colors } = useTheme();
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  // The last saved version, so unsaved edits can be discarded.
  const [savedProfile, setSavedProfile] = useState<ResumeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingExperience, setEditingExperience] = useState(false);

  useEffect(() => {
    fetchOrCreateProfile()
      .then((p) => {
        setProfile(p);
        setSavedProfile(p);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const upload = async () => {
    setError(null);
    try {
      const asset = await pickResume();
      if (!asset) return;
      const parsed = await uploadAndParseResume(session.user.id, asset, setStage);
      setProfile(parsed);
      setSavedProfile(parsed);
      setDirty(false);
      haptic.success();
      toast("Resume read. Check the details below.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStage(null);
    }
  };

  const update = <K extends keyof ResumeProfile>(field: K, value: ResumeProfile[K]) => {
    setProfile((p) => (p ? { ...p, [field]: value } : p));
    setDirty(true);
  };
  const updateExperience = (index: number, field: keyof ExperienceItem, value: string) =>
    update(
      "experience",
      profile!.experience.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );

  // Same fields as the website's save, so either app can edit what the other wrote.
  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("resume_profiles")
      .update({
        full_name: profile.full_name,
        email: profile.email,
        school: profile.school,
        major: profile.major,
        graduation: profile.graduation,
        summary: profile.summary,
        skills: profile.skills,
        interests: profile.interests,
        preferred_locations: profile.preferred_locations,
        job_type: profile.job_type,
        career_fields: profile.career_fields,
        // jsonb column: the row type is Json, the app type is stricter.
        experience: profile.experience as unknown as Json,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setSavedProfile(profile);
      setDirty(false);
      setEditingExperience(false);
      haptic.success();
      toast("Profile saved");
    }
  };

  const discard = () => {
    setProfile(savedProfile);
    setDirty(false);
    setEditingExperience(false);
  };

  // Leaving with unsaved edits asks first, rather than silently dropping them.
  usePreventRemove(dirty, ({ repeat }) =>
    Alert.alert("Discard unsaved changes?", "Your edits to your profile haven't been saved.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          discard();
          repeat();
        },
      },
    ]),
  );

  const busy = stage !== null;
  const lookingFor = CAREER_STAGES.find((s) => s.value === profile?.job_type);

  return (
    <>
      <Stack.Screen options={{ headerRight: () => (dirty ? <HeaderButton label="Save" bold onPress={save} disabled={saving} /> : null) }} />
      <Screen>
        <AppText variant="muted">Your resume powers job matches on the Jobs tab. Check what we pulled out and fix anything we got wrong.</AppText>

        {dirty && (
          <Card style={[styles.unsaved, { borderColor: colors.warning }]}>
            <View style={[styles.unsavedDot, { backgroundColor: colors.warning }]} />
            <AppText style={styles.grow}>Unsaved changes</AppText>
            <Button variant="ghost" onPress={discard} disabled={saving}>
              Discard
            </Button>
            <Button variant="primary" onPress={save} loading={saving}>
              Save
            </Button>
          </Card>
        )}

        {error && <Banner>{error}</Banner>}

        <Card>
          <AppText variant="heading">Resume</AppText>
          <View style={[styles.dropZone, { borderColor: colors.lineStrong, backgroundColor: colors.subtle }]}>
            {busy ? (
              <>
                <ActivityIndicator color={colors.accent} />
                <AppText style={styles.bold}>{stage === "uploading" ? "Uploading…" : "Reading your resume…"}</AppText>
                <AppText variant="small">This usually takes a few seconds.</AppText>
              </>
            ) : (
              <>
                <SymbolView name="arrow.up.doc" size={22} tintColor={colors.fgMuted} />
                <AppText variant="small">PDF, up to 5 MB</AppText>
                <Button onPress={upload} disabled={loading} style={styles.topGap}>
                  {profile?.file_name ? "Replace resume" : "Choose file"}
                </Button>
              </>
            )}
          </View>
          {profile?.file_name && !busy && (
            <View style={[styles.file, { borderColor: colors.line }]}>
              <SymbolView name="doc" size={15} tintColor={colors.fgMuted} />
              <View style={styles.grow}>
                <AppText numberOfLines={1}>{profile.file_name}</AppText>
                {profile.parsed_at && <AppText variant="small">{`Read ${new Date(profile.parsed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}</AppText>}
              </View>
            </View>
          )}
          <View style={styles.tip}>
            <SymbolView name="sparkles" size={13} tintColor={colors.accent} />
            <AppText variant="small" style={styles.grow}>
              {"Skills, interests, graduation date and preferred locations decide which listings we search for and how they're ranked."}
            </AppText>
          </View>
        </Card>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : !profile ? null : (
          <>
            <Section title="Basics">
              <Field label="Full name">
                <Input value={profile.full_name} onChangeText={(v) => update("full_name", v)} textContentType="name" />
              </Field>
              <Field label="Email">
                <Input value={profile.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} />
              </Field>
              <Field label="School">
                <Input value={profile.school} onChangeText={(v) => update("school", v)} />
              </Field>
              <Field label="Major">
                <Input value={profile.major} onChangeText={(v) => update("major", v)} />
              </Field>
              <Field label="Graduation" hint={profile.job_type === "auto" ? "Used to choose internships vs. full-time roles" : undefined}>
                <Input value={profile.graduation} onChangeText={(v) => update("graduation", v)} placeholder="e.g. May 2027" />
              </Field>
              <Field label="Looking for" hint="Decides which listings the Jobs tab finds">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Looking for: ${lookingFor?.label}. Change`}
                  onPress={() => chooseAction("Looking for", CAREER_STAGES.map((s) => ({ label: s.label, onPress: () => update("job_type", s.value) })))}
                  style={[styles.picker, { borderColor: colors.line, backgroundColor: colors.surface }]}
                >
                  <AppText style={styles.grow}>{lookingFor?.label}</AppText>
                  <SymbolView name="chevron.up.chevron.down" size={13} tintColor={colors.fgMuted} />
                </Pressable>
              </Field>
            </Section>

            <Section title="Field" description={`Up to ${MAX_CAREER_FIELDS}. Job matches stay inside these.`}>
              <View style={styles.chips}>
                {CAREER_FIELDS.map((field) => {
                  const active = profile.career_fields.includes(field.value);
                  return (
                    <Chip
                      key={field.value}
                      label={field.label}
                      active={active}
                      disabled={!active && profile.career_fields.length >= MAX_CAREER_FIELDS}
                      onPress={() => update("career_fields", active ? profile.career_fields.filter((f) => f !== field.value) : [...profile.career_fields, field.value])}
                    />
                  );
                })}
              </View>
            </Section>

            <Section title="Summary">
              <Textarea accessibilityLabel="Summary" value={profile.summary} onChangeText={(v) => update("summary", v)} />
            </Section>
            <Section title="Skills" description="Press return or type a comma to add">
              <TagEditor label="skill" tags={profile.skills} onChange={(v) => update("skills", v)} placeholder="Add a skill" />
            </Section>
            <Section title="Interests">
              <TagEditor label="interest" tags={profile.interests} onChange={(v) => update("interests", v)} placeholder="Add an interest" />
            </Section>
            <Section title="Preferred locations">
              <TagEditor label="location" tags={profile.preferred_locations} onChange={(v) => update("preferred_locations", v)} placeholder="Add a location" />
            </Section>

            <Section title="Experience" action={<HeaderButton label={editingExperience ? "Done editing" : "Edit"} onPress={() => setEditingExperience((v) => !v)} />}>
              {profile.experience.length === 0 && !editingExperience ? (
                <AppText variant="muted">Nothing here yet.</AppText>
              ) : (
                profile.experience.map((item, i) =>
                  editingExperience ? (
                    <View key={i} style={[styles.experience, { borderColor: colors.line, backgroundColor: colors.subtle }]}>
                      <Field label="Title">
                        <Input value={item.title} onChangeText={(v) => updateExperience(i, "title", v)} placeholder="e.g. Software Engineering Intern" />
                      </Field>
                      <Field label="Organization">
                        <Input value={item.organization} onChangeText={(v) => updateExperience(i, "organization", v)} placeholder="e.g. Comcast" />
                      </Field>
                      <Field label="Dates">
                        <Input value={item.dates} onChangeText={(v) => updateExperience(i, "dates", v)} placeholder="e.g. Jun 2026 – Aug 2026" />
                      </Field>
                      <Field label="What you did">
                        <Textarea value={item.highlight} onChangeText={(v) => updateExperience(i, "highlight", v)} placeholder="One sentence describing the work and its impact" />
                      </Field>
                      <Button
                        variant="danger-ghost"
                        onPress={() =>
                          update(
                            "experience",
                            profile.experience.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </View>
                  ) : (
                    <View key={i} style={[styles.experience, { borderColor: colors.line }]}>
                      <AppText style={styles.bold}>
                        {item.title || "Untitled"}
                        {item.organization ? <AppText variant="muted">{` · ${item.organization}`}</AppText> : null}
                      </AppText>
                      {item.dates ? <AppText variant="small">{item.dates}</AppText> : null}
                      {item.highlight ? <AppText variant="muted">{item.highlight}</AppText> : null}
                    </View>
                  ),
                )
              )}
              {editingExperience && (
                <Button
                  onPress={() => {
                    update("experience", [...profile.experience, { title: "", organization: "", dates: "", highlight: "" }]);
                  }}
                >
                  Add entry
                </Button>
              )}
            </Section>
          </>
        )}
      </Screen>
    </>
  );
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <View style={styles.grow}>
          <AppText variant="heading">{title}</AppText>
          {description && <AppText variant="small">{description}</AppText>}
        </View>
        {action}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  bold: { fontWeight: "600" },
  topGap: { marginTop: 8 },
  loading: { paddingVertical: 32, alignItems: "center" },
  unsaved: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  unsavedDot: { width: 8, height: 8, borderCurve: "continuous", borderRadius: 4 },
  dropZone: { alignItems: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderCurve: "continuous", borderRadius: 10, paddingVertical: 22, paddingHorizontal: 16 },
  file: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderCurve: "continuous", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  tip: { flexDirection: "row", gap: 8 },
  picker: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, paddingHorizontal: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  experience: { borderWidth: 1, borderCurve: "continuous", borderRadius: 10, padding: 12, gap: 8 },
});
