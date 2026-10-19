import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useData } from "../data/DataContext";
import { fetchCareerLog, type CareerLogEntry } from "../data/careerLog";
import { askCoach, buildCoachContext, HISTORY_SENT, MAX_QUESTION_CHARS, STARTER_PROMPTS, type CoachMessage } from "../data/coach";
import { Banner, Button, Card, cx, IconButton, Page, PageHeader, Spinner, Textarea } from "../components/ui";
import { errorMessage, useFeedback } from "../components/feedback";
import { IconAlertCircle, IconArrowRight, IconCopy, IconRefresh, IconSend, IconSparkles } from "../components/icons";

export default function CareerCoach({ onNavigate }: { onNavigate: (screen: string, id?: string) => void }) {
  const { applications, tasks, contacts, events } = useData();
  const { toast } = useFeedback();
  // undefined while loading; null if it couldn't be loaded, so the coach can say so instead of guessing.
  const [careerLog, setCareerLog] = useState<CareerLogEntry[] | null | undefined>(undefined);
  // Chat history lives only on this page for now; leaving the page starts a new chat.
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchCareerLog()
      .then(setCareerLog)
      .catch(() => setCareerLog(null));
  }, []);

  // Rebuilt from live data, so a change made in another tab of the app is picked up by the next question.
  const context = useMemo(() => buildCoachContext({ applications, tasks, contacts, events, careerLog: careerLog ?? null }), [applications, tasks, contacts, events, careerLog]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending, error]);

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
    if (!text || pending) return;
    setDraft("");
    send([...messages, { role: "user", content: text }]);
  };

  const newChat = () => {
    setMessages([]);
    setError(null);
    setDraft("");
    inputRef.current?.focus();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied");
    } catch {
      toast("Couldn't reach the clipboard. Check your browser's permissions and try again.", { tone: "error" });
    }
  };

  const loadingData = careerLog === undefined;
  const { counts } = context;
  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <Page width="narrow">
      <PageHeader
        title="Career coach"
        description="Advice grounded in your applications, deadlines, contacts and career log."
        actions={
          messages.length > 0 && (
            <Button icon={IconRefresh} onClick={newChat} disabled={pending}>
              New chat
            </Button>
          )
        }
      />

      <Card className="flex flex-col">
        <div className="flex-1 px-4 py-4" aria-live="polite" aria-busy={pending}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center px-2 py-8 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <IconSparkles size={19} />
              </span>
              <p className="text-sm font-semibold text-fg">What do you want to work on?</p>
              <p className="mt-1 max-w-sm text-ui text-fg-muted">Ask anything about your search. Answers draw on what you've tracked here, so the more you log, the better they get.</p>
              <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loadingData}
                    onClick={() => ask(prompt)}
                    className="tactile-soft group flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-ui text-fg-2 shadow-xs hover:border-line-strong hover:bg-subtle hover:text-fg disabled:opacity-50"
                  >
                    {prompt}
                    <IconArrowRight size={14} className="shrink-0 text-fg-faint transition-transform duration-200 ease-snappy group-hover:translate-x-0.5 group-hover:text-fg-muted" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="space-y-5">
              {messages.length > HISTORY_SENT && <li className="text-center text-2xs text-fg-muted">Older messages are no longer sent to the coach. Start a new chat for a fresh topic.</li>}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <li key={i} className="flex justify-end">
                    <p className="max-w-[85%] rounded-xl rounded-br-sm bg-muted px-3.5 py-2 text-ui leading-relaxed whitespace-pre-wrap text-fg">{m.content}</p>
                  </li>
                ) : (
                  <li key={i} className="group flex gap-3">
                    <CoachAvatar />
                    <div className="min-w-0 flex-1">
                      <RichText text={m.content} />
                      <div className="mt-1 -ml-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                        <IconButton icon={IconCopy} label="Copy answer" size="sm" onClick={() => copy(m.content)} />
                      </div>
                    </div>
                  </li>
                ),
              )}
              {pending && (
                <li className="flex gap-3" role="status">
                  <CoachAvatar />
                  <p className="flex items-center gap-2 pt-1 text-ui text-fg-muted">
                    <Spinner size={14} /> Thinking…
                  </p>
                </li>
              )}
            </ol>
          )}
          {error && (
            <Banner
              icon={IconAlertCircle}
              className="mt-4"
              action={
                lastIsUser && (
                  <Button size="sm" icon={IconRefresh} onClick={() => send(messages)}>
                    Try again
                  </Button>
                )
              }
            >
              {error}
            </Banner>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="sticky bottom-0 rounded-b-card border-t border-line bg-subtle p-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              aria-label="Ask the career coach"
              rows={1}
              value={draft}
              maxLength={MAX_QUESTION_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(draft);
                }
              }}
              placeholder={loadingData ? "Loading your data…" : "Ask about your applications, interviews, resume…"}
              className="max-h-40 min-h-9 resize-none"
            />
            <Button type="submit" variant="primary" icon={IconSend} disabled={!draft.trim() || pending || loadingData} className="h-9">
              <span className="sr-only sm:not-sr-only">Send</span>
            </Button>
          </div>
          <p className="mt-2 text-2xs text-fg-muted">
            Uses {plural(counts.applications, "application")}, {plural(counts.upcoming, "upcoming item")}, {plural(counts.contacts, "contact")} and{" "}
            {careerLog === null ? (
              <span className="text-warning-fg">no career log (couldn't load it)</span>
            ) : (
              <button type="button" onClick={() => onNavigate("career-log")} className="underline decoration-line-strong underline-offset-2 hover:text-fg">
                {plural(counts.careerLog, "career log entry", "career log entries")}
              </button>
            )}
            . AI can be wrong; check anything important.
          </p>
        </form>
      </Card>
    </Page>
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function CoachAvatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden="true">
      <IconSparkles size={15} />
    </span>
  );
}

/** **bold** and `code` inside a line. */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-fg">
        {part.slice(2, -2)}
      </strong>
    ) : part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <code key={i} className="rounded bg-muted px-1 font-mono text-[0.92em]">
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: { text: string; depth: number }[] };

/**
 * The coach is asked for prose, "-" bullets and **bold**. This renders just that (plus numbered lists and stray
 * headings shown as bold lines) without pulling in a Markdown library.
 */
function RichText({ text }: { text: string }) {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
    const numbered = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet || numbered) {
      const [, indent, body] = (bullet ?? numbered)!;
      const kind = bullet ? "ul" : "ol";
      const item = { text: body, depth: indent.length >= 2 ? 1 : 0 };
      // Nested items stay in their parent's list whatever their marker.
      if (last && last.kind !== "p" && (last.kind === kind || item.depth > 0)) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (!line.trim()) {
      if (last?.kind === "p" && last.lines.length > 0) blocks.push({ kind: "p", lines: [] });
    } else {
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      const content = heading ? `**${heading[1].replace(/\*\*/g, "")}**` : line.trim();
      if (last?.kind === "p") last.lines.push(content);
      else blocks.push({ kind: "p", lines: [content] });
    }
  }

  return (
    <div className="space-y-2.5 text-ui leading-relaxed text-fg-2">
      {blocks.map((block, i) => {
        if (block.kind === "p") {
          if (block.lines.length === 0) return null;
          return (
            <p key={i}>
              {block.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l)}
                </Fragment>
              ))}
            </p>
          );
        }
        const List = block.kind;
        return (
          <List key={i} className={cx("space-y-1 pl-5", block.kind === "ul" ? "list-disc marker:text-fg-faint" : "list-decimal marker:text-fg-muted")}>
            {block.items.map((item, j) => (
              <li key={j} className={item.depth > 0 ? "ml-4 list-[circle]" : undefined}>
                {inline(item.text)}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
