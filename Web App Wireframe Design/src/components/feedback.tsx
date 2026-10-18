import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, cx } from "./ui";
import { Modal } from "./overlay";
import { IconAlertCircle, IconCheckCircle, IconInfo, IconX } from "./icons";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "default";
  /** For an acknowledgement rather than a choice: hides Cancel. */
  acknowledge?: boolean;
}

interface FeedbackValue {
  toast: (message: ReactNode, opts?: { tone?: ToastTone; action?: Toast["action"] }) => void;
  /** Resolves true when the person confirms; replaces window.confirm. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const value = useMemo<FeedbackValue>(
    () => ({
      toast: (message, opts = {}) => {
        const id = nextId.current++;
        setToasts((ts) => [...ts.slice(-2), { id, message, tone: opts.tone ?? "success", action: opts.action }]);
      },
      confirm: (opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    }),
    [],
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {pending && (
        <Modal
          size="sm"
          title={pending.title}
          onClose={() => settle(false)}
          footer={
            <>
              {!pending.acknowledge && <Button onClick={() => settle(false)}>Cancel</Button>}
              <Button variant={pending.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)} data-autofocus>
                {pending.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          <div className="text-ui leading-relaxed text-fg-2">{pending.message}</div>
        </Modal>
      )}
      {createPortal(
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[300] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </FeedbackContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (hovered) return;
    const timer = setTimeout(onDismiss, toast.action ? 6000 : toast.tone === "error" ? 7000 : 3800);
    return () => clearTimeout(timer);
  }, [hovered]);

  const Icon = toast.tone === "error" ? IconAlertCircle : toast.tone === "info" ? IconInfo : IconCheckCircle;
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg bg-ink py-2.5 pr-2 pl-3 text-ui text-white shadow-dialog animate-toast-in"
    >
      <Icon size={16} className={cx("mt-0.5", toast.tone === "error" ? "text-[#FF8A8A]" : toast.tone === "info" ? "text-white/70" : "text-[#5FD3A6]")} />
      <div className="min-w-0 flex-1 py-px leading-snug">{toast.message}</div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDismiss();
          }}
          className="-my-0.5 rounded px-1.5 py-0.5 text-ui font-semibold text-white underline-offset-2 hover:underline"
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-my-0.5 rounded p-0.5 text-white/50 transition-colors hover:text-white">
        <IconX size={14} />
      </button>
    </div>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
