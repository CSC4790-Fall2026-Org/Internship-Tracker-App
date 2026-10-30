import { useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { Contact } from "@shared/data/types";
import { useData } from "@shared/data/DataContext";
import { AppText, Avatar, Banner, Button, Card, CompanyLogo, EmptyState, Screen, Segmented } from "@/components/ui";
import { HeaderButton } from "@/components/header-button";
import { SwipeRow } from "@/components/swipe-row";
import { chooseAction, confirm, errorMessage, useToast } from "@/components/feedback";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme/use-theme";

/** The website's Networking page: everyone you've met, searchable, with the applications they're linked to. */
export default function Networking() {
  const { contacts, applications, deleteContact, error, refresh } = useData();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "linked" | "unlinked">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        (scope === "all" || (scope === "linked" ? c.applicationIds.length > 0 : c.applicationIds.length === 0)) &&
        (!q || [c.name, c.company, c.role, c.email, c.notes].some((field) => field.toLowerCase().includes(q))),
    );
  }, [contacts, search, scope]);

  const applicationById = new Map(applications.map((a) => [a.id, a]));
  const companies = new Set(contacts.map((c) => c.company.trim().toLowerCase()).filter(Boolean)).size;

  const open = (contact?: Contact) => router.push({ pathname: "/more/contact", params: contact ? { id: contact.id } : {} });

  const actions = (contact: Contact) =>
    chooseAction(contact.name, [
      ...(contact.email ? [{ label: `Email ${contact.email}`, onPress: () => Linking.openURL(`mailto:${contact.email}`) }] : []),
      ...(contact.phone ? [{ label: `Call ${contact.phone}`, onPress: () => Linking.openURL(`tel:${contact.phone.replace(/[^\d+]/g, "")}`) }] : []),
      { label: "Edit", onPress: () => open(contact) },
      {
        label: "Delete",
        destructive: true,
        onPress: async () => {
          if (!(await confirm({ title: `Delete ${contact.name}?`, message: "This also removes their links to applications. It can't be undone.", confirmLabel: "Delete", destructive: true }))) return;
          deleteContact(contact.id)
            .then(() => toast(`Deleted ${contact.name}`))
            .catch((e) => toast(`Couldn't delete: ${errorMessage(e)}`, { tone: "error" }));
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions:
            contacts.length > 0 ? { placeholder: "Search name, company, role, notes", hideWhenScrolling: false, onChangeText: (e) => setSearch(e.nativeEvent.text), onCancelButtonPress: () => setSearch("") } : undefined,
          headerRight: () => <HeaderButton icon="plus" label="Add contact" onPress={() => open()} />,
        }}
      />
      <Screen>
        {error && <Banner action={<Button onPress={refresh}>Try again</Button>}>{`Couldn't load your contacts: ${error}`}</Banner>}
        {contacts.length === 0 ? (
          <Card>
            <EmptyState icon="person.2" title="No contacts yet" description="Add the people you meet at career fairs, coffee chats and interviews, then link them to the applications they relate to.">
              <Button variant="primary" onPress={() => open()} style={styles.topGap}>
                Add your first contact
              </Button>
            </EmptyState>
          </Card>
        ) : (
          <>
            <AppText variant="muted">{`${contacts.length} ${contacts.length === 1 ? "person" : "people"} across ${companies} ${companies === 1 ? "company" : "companies"}`}</AppText>
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: "all", label: "All" },
                { value: "linked", label: "Linked" },
                { value: "unlinked", label: "Not linked" },
              ]}
            />
            {filtered.length === 0 ? (
              <Card>
                <EmptyState icon="magnifyingglass" title="Nobody matches" description={search ? `No one matches “${search}”.` : "No contacts in this view."}>
                  {scope !== "all" && (
                    <Button onPress={() => setScope("all")} style={styles.topGap}>
                      Show everyone
                    </Button>
                  )}
                </EmptyState>
              </Card>
            ) : (
              <Card style={styles.list}>
                {filtered.map((contact, i) => (
                  <SwipeRow
                    key={contact.id}
                    trailing={[
                      ...(contact.email ? [{ label: "Email", icon: "envelope" as const, color: colors.accent, onPress: () => Linking.openURL(`mailto:${contact.email}`) }] : []),
                      ...(contact.phone ? [{ label: "Call", icon: "phone" as const, color: colors.success, onPress: () => Linking.openURL(`tel:${contact.phone.replace(/[^\d+]/g, "")}`) }] : []),
                    ]}
                  >
                  <PressableScale feel="soft"
                    accessibilityRole="button"
                    accessibilityHint="Opens the contact. Touch and hold to email, call or delete."
                    onPress={() => open(contact)}
                    onLongPress={() => actions(contact)}
                    style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, { backgroundColor: pressed ? colors.subtle : colors.surface }]}
                  >
                    <Avatar name={contact.name} size={36} />
                    <View style={styles.grow}>
                      <AppText style={styles.name} numberOfLines={1}>
                        {contact.name}
                      </AppText>
                      <AppText variant="small" numberOfLines={1}>
                        {[contact.role, contact.company].filter(Boolean).join(" · ") || contact.email || "No role recorded"}
                      </AppText>
                      {contact.applicationIds.length > 0 && (
                        <View style={styles.links}>
                          {contact.applicationIds.map((id) => {
                            const app = applicationById.get(id);
                            if (!app) return null;
                            return (
                              <View key={id} style={[styles.linkChip, { borderColor: colors.line }]}>
                                <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={16} />
                                <AppText variant="small" numberOfLines={1} style={styles.shrink}>
                                  {app.position}
                                </AppText>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                    {contact.email ? <HeaderButton icon="envelope" muted label={`Email ${contact.name}`} onPress={() => Linking.openURL(`mailto:${contact.email}`)} /> : null}
                  </PressableScale>
                  </SwipeRow>
                ))}
              </Card>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  topGap: { marginTop: 8 },
  list: { padding: 0, gap: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 60 },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  name: { fontWeight: "600" },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  linkChip: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%", borderWidth: 1, borderCurve: "continuous", borderRadius: 999, paddingLeft: 3, paddingRight: 8, paddingVertical: 2 },
});
