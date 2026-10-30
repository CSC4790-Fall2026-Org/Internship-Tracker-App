import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useData, type ContactInput } from "@shared/data/DataContext";
import { AppText, Banner, Button, Checkbox, CompanyLogo, EmptyState, Field, Input, Screen, StatusDot, Textarea } from "@/components/ui";
import { HeaderButton } from "@/components/header-button";
import { confirm, errorMessage, useToast } from "@/components/feedback";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/theme/use-theme";

const EMPTY: ContactInput = { name: "", role: "", company: "", email: "", phone: "", notes: "" };

// The website's ContactModal as a sheet: `id` edits that person, otherwise it adds one.
export default function ContactForm() {
  const { contacts, applications, addContact, updateContact, deleteContact, setContactApplications } = useData();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const contact = params.id ? contacts.find((c) => c.id === params.id) : undefined;
  const editing = !!params.id;

  const [form, setForm] = useState<ContactInput>(contact ? { name: contact.name, role: contact.role, company: contact.company, email: contact.email, phone: contact.phone, notes: contact.notes } : EMPTY);
  const [linkedIds, setLinkedIds] = useState<string[]>(contact?.applicationIds ?? []);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof ContactInput, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const toggleLink = (id: string) => setLinkedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const nameError = form.name.trim() ? null : "A name is required.";
  const emailError = form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? "That doesn't look like an email address." : null;

  // Applications at this contact's company first, usually the ones you want.
  const sortedApplications = [...applications].sort(
    (a, b) => Number(b.company.toLowerCase() === form.company.toLowerCase()) - Number(a.company.toLowerCase() === form.company.toLowerCase()) || a.company.localeCompare(b.company),
  );

  const save = async () => {
    setTouched(true);
    if (nameError || emailError || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (contact) {
        await updateContact(contact.id, form);
        await setContactApplications(contact.id, linkedIds);
      } else {
        await addContact(form, linkedIds);
      }
      haptic.success();
      toast(contact ? "Contact saved" : `Added ${form.name.trim()}`);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!contact) return;
    if (!(await confirm({ title: `Delete ${contact.name}?`, message: "This also removes their links to applications. It can't be undone.", confirmLabel: "Delete", destructive: true }))) return;
    setSaving(true);
    try {
      await deleteContact(contact.id);
      toast(`Deleted ${contact.name}`);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: contact ? contact.name : editing ? "" : "New contact",
        headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} disabled={saving} />,
        headerRight: () => (editing && !contact ? null : <HeaderButton label={editing ? "Save" : "Add"} bold onPress={save} disabled={saving} />),
        gestureEnabled: !saving,
      }}
    />
  );

  if (editing && !contact) {
    return (
      <>
        {header}
        <Screen>
          <EmptyState title="Contact not found" description="They may have been deleted, or the link is out of date." />
        </Screen>
      </>
    );
  }

  return (
    <>
      {header}
      <Screen>
        {!editing && <AppText variant="muted">{"Someone you've talked to, or want to reach out to."}</AppText>}
        {error && <Banner>{`Couldn't save: ${error}`}</Banner>}
        {contact && (contact.email || contact.phone) && (
          <View style={styles.quickActions}>
            {contact.email ? (
              <Button onPress={() => Linking.openURL(`mailto:${contact.email}`)} style={styles.grow}>
                Email
              </Button>
            ) : null}
            {contact.phone ? (
              <Button onPress={() => Linking.openURL(`tel:${contact.phone.replace(/[^\d+]/g, "")}`)} style={styles.grow}>
                Call
              </Button>
            ) : null}
          </View>
        )}
        <Field label="Name" error={touched ? nameError : null}>
          <Input autoFocus={!editing} value={form.name} onChangeText={(v) => set("name", v)} placeholder="e.g. Sarah Chen" textContentType="name" />
        </Field>
        <Field label="Company">
          <Input value={form.company} onChangeText={(v) => set("company", v)} placeholder="e.g. Acme Corp" textContentType="organizationName" />
        </Field>
        <Field label="Role">
          <Input value={form.role} onChangeText={(v) => set("role", v)} placeholder="e.g. University Recruiter" textContentType="jobTitle" />
        </Field>
        <Field label="Email" error={touched ? emailError : null}>
          <Input value={form.email} onChangeText={(v) => set("email", v)} placeholder="name@company.com" keyboardType="email-address" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Field label="Phone" hint="Optional">
          <Input value={form.phone} onChangeText={(v) => set("phone", v)} placeholder="(555) 123-4567" keyboardType="phone-pad" textContentType="telephoneNumber" />
        </Field>
        <Field label="Notes">
          <Textarea value={form.notes} onChangeText={(v) => set("notes", v)} placeholder="How you met, what you discussed, what to follow up on…" />
        </Field>

        <Field label={linkedIds.length > 0 ? `Linked applications · ${linkedIds.length} linked` : "Linked applications"}>
          {applications.length === 0 ? (
            <AppText variant="muted">{"You don't have any applications yet."}</AppText>
          ) : (
            <View style={[styles.links, { borderColor: colors.line, backgroundColor: colors.surface }]}>
              {sortedApplications.map((app, i) => {
                const checked = linkedIds.includes(app.id);
                return (
                  <Pressable
                    key={app.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`${app.company}, ${app.position}`}
                    onPress={() => toggleLink(app.id)}
                    style={[styles.linkRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, checked && { backgroundColor: colors.subtle }]}
                  >
                    <Checkbox checked={checked} onPress={() => toggleLink(app.id)} label={`Link ${app.company}`} />
                    <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={22} />
                    <AppText numberOfLines={1} style={styles.grow}>
                      {app.company}
                      <AppText variant="muted">{` · ${app.position}`}</AppText>
                    </AppText>
                    <StatusDot status={app.status} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </Field>

        {contact && (
          <Button variant="danger-ghost" onPress={remove} disabled={saving}>
            Delete contact
          </Button>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  quickActions: { flexDirection: "row", gap: 8 },
  links: { borderWidth: 1, borderCurve: "continuous", borderRadius: 10, overflow: "hidden" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 10 },
});
