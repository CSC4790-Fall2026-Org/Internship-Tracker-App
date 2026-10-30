import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import { TextInput } from "@/components/text";
import { Stack, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "@shared/data/DataContext";
import { askCoach, buildCoachContext, HISTORY_SENT, MAX_QUESTION_CHARS, STARTER_PROMPTS, type CoachMessage } from "@shared/data/coach";
import { AppText, Banner, Button } from "@/components/ui";
import { HeaderButton } from "@/components/header-button";
import { RichText } from "@/components/rich-text";
import { errorMessage, useToast } from "@/components/feedback";
import { useCareerLog } from "@/data/career-log-store";
import { useTheme } from "@/theme/use-theme";

/**
 * The website's Career Coach: a chat grounded in the user's own data, built into a summary by the shared coach.ts
 * and answered by the career-coach Edge Function. Opens as a sheet so the message bar isn't under the tab bar.
 */
export default function CareerCoach() {
  const { applications, tasks, contacts, events } = useData();
  const careerLog = useCareerLog();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  // Chat history lives only on this screen for now; closing it starts a new chat, like leaving the page on the website.
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // A log that couldn't be loaded goes in as null, so the coach says so instead of guessing.
  const logForCoach = careerLog.error ? null : careerLog.entries;
  const context = useMemo(() => buildCoachContext({ applications, tasks, contacts, events, careerLog: logForCoach }), [applications, tasks, contacts, events, logForCoach]);
  const loadingData = careerLog.loading;

  const send = async (history: CoachMessage[]) => {
    setMessages(history);
    setPending(true);
    setError(null);
    try {
      const reply = await askCoach(history, context.text);
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || pending || loadingData) return;
    setDraft("");
    send([...messages, { role: "user", content: text }]);
  };

  const newChat = () => {
    setMessages([]);
    setError(null);
    setDraft("");
  };

  const copy = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      toast("Copied");
    } catch (e) {
      toast(`Couldn't copy: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  const { counts } = context;
  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (messages.length > 0 ? <HeaderButton label="New chat" onPress={newChat} disabled={pending} /> : null),
          headerRight: () => <HeaderButton label="Done" bold onPress={() => router.back()} />,
        }}
      />
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.canvas }]} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          // New messages land at the bottom; keep them in view.
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          accessibilityLiveRegion="polite"
        >
          {messages.length === 0 ? (
            <View style={styles.welcome}>
              <View style={[styles.avatarLarge, { backgroundColor: colors.accentSoft }]}>
                <SymbolView name="sparkles" size={20} tintColor={colors.accent} />
              </View>
              <AppText variant="heading">What do you want to work on?</AppText>
              <AppText variant="muted" style={styles.center}>
                {"Ask anything about your search. Answers draw on what you've tracked here, so the more you log, the better they get."}
              </AppText>
              <View style={styles.prompts}>
                {STARTER_PROMPTS.map((prompt) => (
                  <Pressable
                    key={prompt}
                    accessibilityRole="button"
                    disabled={loadingData}
                    onPress={() => ask(prompt)}
                    style={({ pressed }) => [styles.prompt, { borderColor: colors.line, backgroundColor: pressed ? colors.subtle : colors.surface, opacity: loadingData ? 0.5 : 1 }]}
                  >
                    <AppText style={[styles.grow, { color: colors.fg2 }]}>{prompt}</AppText>
                    <SymbolView name="arrow.right" size={13} tintColor={colors.fgFaint} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <>
              {messages.length > HISTORY_SENT && (
                <AppText variant="small" style={styles.center}>
                  Older messages are no longer sent to the coach. Start a new chat for a fresh topic.
                </AppText>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <View key={i} style={[styles.userBubble, { backgroundColor: colors.muted }]}>
                    <AppText>{m.content}</AppText>
                  </View>
                ) : (
                  <View key={i} style={styles.answer}>
                    <CoachAvatar />
                    <View style={styles.grow}>
                      <RichText text={m.content} />
                      <Pressable accessibilityRole="button" accessibilityLabel="Copy answer" onPress={() => copy(m.content)} hitSlop={8} style={styles.copy}>
                        <SymbolView name="doc.on.doc" size={14} tintColor={colors.fgMuted} />
                        <AppText variant="small">Copy</AppText>
                      </Pressable>
                    </View>
                  </View>
                ),
              )}
              {pending && (
                <View style={styles.answer} accessibilityRole="progressbar">
                  <CoachAvatar thinking />
                  <AppText variant="muted">Thinking…</AppText>
                </View>
              )}
            </>
          )}
          {error && <Banner action={lastIsUser ? <Button onPress={() => send(messages)}>Try again</Button> : undefined}>{error}</Banner>}
        </ScrollView>

        <View style={[styles.composer, { borderTopColor: colors.line, backgroundColor: colors.subtle, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="Ask the career coach"
              value={draft}
              onChangeText={setDraft}
              maxLength={MAX_QUESTION_CHARS}
              multiline
              placeholder={loadingData ? "Loading your data…" : "Ask about your applications, interviews, resume…"}
              placeholderTextColor={colors.fgFaint}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.fg }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              disabled={!draft.trim() || pending || loadingData}
              onPress={() => ask(draft)}
              style={[styles.send, { backgroundColor: colors.ink, opacity: !draft.trim() || pending || loadingData ? 0.4 : 1 }]}
            >
              <SymbolView name="arrow.up" size={16} weight="bold" tintColor={colors.onInk} />
            </Pressable>
          </View>
          <AppText variant="small">
            {`Uses ${plural(counts.applications, "application")}, ${plural(counts.upcoming, "upcoming item")}, ${plural(counts.contacts, "contact")} and `}
            {careerLog.error ? <AppText variant="small" style={{ color: colors.warningFg }}>{"no career log (couldn't load it)"}</AppText> : plural(counts.careerLog, "career log entry", "career log entries")}
            . AI can be wrong; check anything important.
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function CoachAvatar({ thinking }: { thinking?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]} accessibilityElementsHidden>
      <SymbolView name="sparkles" size={14} tintColor={colors.accent} animationSpec={thinking ? { effect: { type: "pulse" }, repeating: true } : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  center: { textAlign: "center" },
  messages: { padding: 16, gap: 18, flexGrow: 1 },
  welcome: { alignItems: "center", gap: 8, paddingVertical: 24 },
  avatarLarge: { width: 40, height: 40, borderCurve: "continuous", borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  prompts: { alignSelf: "stretch", gap: 8, marginTop: 12 },
  prompt: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  userBubble: { alignSelf: "flex-end", maxWidth: "85%", borderCurve: "continuous", borderRadius: 14, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 9 },
  answer: { flexDirection: "row", gap: 10 },
  avatar: { width: 28, height: 28, borderCurve: "continuous", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  copy: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, alignSelf: "flex-start" },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 140, borderWidth: 1, borderCurve: "continuous", borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15 },
  send: { width: 40, height: 40, borderCurve: "continuous", borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
