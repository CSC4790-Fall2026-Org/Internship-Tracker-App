import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import type { Task } from "@shared/data/types";
import { useData } from "@shared/data/DataContext";
import { formatDate } from "@shared/data/dates";
import { AppText, Button, Checkbox, DueChip, Input } from "@/components/ui";
import { ApplicationPicker } from "@/components/application-picker";
import { DateField } from "@/components/date-field";
import { HeaderButton } from "@/components/header-button";
import { SwipeRow } from "@/components/swipe-row";
import { errorMessage, useToast } from "@/components/feedback";
import { useTheme } from "@/theme/use-theme";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { ROW_ENTER, ROW_EXIT, ROW_LAYOUT } from "@/theme/motion";

/** Dated tasks first (soonest first), then undated ones. Same order as the website. */
function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => (a.due ? 0 : 1) - (b.due ? 0 : 1) || a.due.localeCompare(b.due) || a.text.localeCompare(b.text));
}

/** The website's dashboard TasksPanel: add, check off, delete (with Undo), and a collapsible Completed list. */
export function TasksPanel() {
  const { tasks, addTask, setTaskDone, deleteTask } = useData();
  const toast = useToast();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<{ text: string; due: string; applicationId: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const open = sortTasks(tasks.filter((t) => !t.done));
  const done = tasks.filter((t) => t.done);

  const save = async () => {
    if (!draft?.text.trim()) return;
    setSaving(true);
    try {
      await addTask({ text: draft.text, due: draft.due, applicationId: draft.applicationId });
      // Keep the form open with the same application, for adding several in a row.
      setDraft({ text: "", due: "", applicationId: draft.applicationId });
    } catch (e) {
      toast(`Couldn't add task: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (task: Task) => setTaskDone(task.id, !task.done).catch((e) => toast(`Couldn't update task: ${errorMessage(e)}`, { tone: "error" }));

  const remove = async (task: Task) => {
    try {
      await deleteTask(task.id);
      toast("Task deleted", {
        action: {
          label: "Undo",
          onPress: () =>
            addTask({ text: task.text, due: task.due, applicationId: task.applicationId })
              .then((id) => (task.done ? setTaskDone(id, true) : undefined))
              .catch((e) => toast(`Couldn't restore task: ${errorMessage(e)}`, { tone: "error" })),
        },
      });
    } catch (e) {
      toast(`Couldn't delete task: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  return (
    <View style={styles.panel}>
      {draft ? (
        <View style={[styles.draft, { borderColor: colors.line, backgroundColor: colors.subtle }]}>
          <Input autoFocus accessibilityLabel="Task" placeholder="e.g. Send thank-you note to recruiter" value={draft.text} onChangeText={(text) => setDraft({ ...draft, text })} returnKeyType="done" onSubmitEditing={save} />
          <ApplicationPicker value={draft.applicationId} onChange={(applicationId) => setDraft({ ...draft, applicationId })} noneLabel="No application" />
          <DateField label="Due date" value={draft.due} onChange={(due) => setDraft({ ...draft, due })} />
          <View style={styles.draftActions}>
            <Button variant="ghost" onPress={() => setDraft(null)} disabled={saving}>
              Done
            </Button>
            <Button variant="primary" onPress={save} loading={saving} disabled={!draft.text.trim()}>
              Add task
            </Button>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setDraft({ text: "", due: "", applicationId: null })} style={({ pressed }) => [styles.addRow, pressed && { backgroundColor: colors.subtle }]}>
          <SymbolView name="plus" size={15} tintColor={colors.fgMuted} />
          <AppText variant="muted">Add task</AppText>
        </Pressable>
      )}

      {open.length === 0 ? (
        !draft && <AppText variant="muted">{done.length ? "Every task is done." : "Follow-ups and prep with a due date also appear on your calendar."}</AppText>
      ) : (
        <LayoutAnimationConfig skipEntering>
          {open.map((task) => (
            <Animated.View key={task.id} layout={ROW_LAYOUT} entering={ROW_ENTER} exiting={ROW_EXIT}>
              <TaskRow task={task} onToggle={() => toggle(task)} onDelete={() => remove(task)} swipeable />
            </Animated.View>
          ))}
        </LayoutAnimationConfig>
      )}

      {done.length > 0 && (
        <View style={[styles.doneSection, { borderTopColor: colors.line }]}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDone }} onPress={() => setShowDone((s) => !s)} style={styles.doneToggle} hitSlop={6}>
            <SymbolView name={showDone ? "chevron.down" : "chevron.right"} size={12} tintColor={colors.fgMuted} />
            <AppText variant="small" style={styles.bold}>
              Completed ({done.length})
            </AppText>
          </Pressable>
          {showDone && done.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} onDelete={() => remove(task)} />)}
        </View>
      )}
    </View>
  );
}

function TaskRow({ task, onToggle, onDelete, swipeable }: { task: Task; onToggle: () => void; onDelete: () => void; swipeable?: boolean }) {
  const { colors } = useTheme();
  const row = (
    <View style={[styles.taskRow, { backgroundColor: colors.surface }]}>
      <Checkbox checked={task.done} onPress={onToggle} label={task.done ? `Mark "${task.text}" as not done` : `Mark "${task.text}" as done`} />
      <View style={styles.grow}>
        <AppText style={task.done && { color: colors.fgMuted, textDecorationLine: "line-through" }}>{task.text}</AppText>
        {(task.company || task.due) && (
          <View style={styles.taskMeta}>
            {task.company ? (
              <AppText variant="small" numberOfLines={1} style={styles.shrink}>
                {task.company}
              </AppText>
            ) : null}
            {task.company && task.due ? <AppText variant="small">·</AppText> : null}
            {task.due ? task.done ? <AppText variant="small">{formatDate(task.due)}</AppText> : <DueChip date={task.due} /> : null}
          </View>
        )}
      </View>
      <HeaderButton icon="trash" muted label={`Delete "${task.text}"`} onPress={onDelete} />
    </View>
  );
  if (!swipeable) return row;
  return (
    <SwipeRow
      leading={[{ label: task.done ? "Not done" : "Done", icon: task.done ? "arrow.uturn.backward" : "checkmark", color: colors.success, onPress: onToggle }]}
      trailing={[{ label: "Delete", icon: "trash", color: colors.danger, onPress: onDelete }]}
    >
      {row}
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  bold: { fontWeight: "600" },
  draft: { gap: 10, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, padding: 10 },
  draftActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40, borderCurve: "continuous", borderRadius: 8, paddingHorizontal: 4 },
  taskRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 6 },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  doneSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  doneToggle: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 },
});
