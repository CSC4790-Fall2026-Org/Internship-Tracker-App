import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx, IconButton } from "./ui";
import { IconX } from "./icons";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Several overlays can be open at once (a confirm on top of a modal); only the top one handles Escape.
const stack: symbol[] = [];

/** Keeps Tab inside `container`, closes on Escape, and returns focus to wherever it was on unmount. */
function useDialogBehavior(container: React.RefObject<HTMLElement | null>, onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const token = Symbol("overlay");
    stack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const el = container.current;
    // Prefer an explicit autofocus target, then the first field, then the dialog itself.
    const initial = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("input:not([type=checkbox]), textarea, select") ?? el;
    initial?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab" && el) {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stack.splice(stack.indexOf(token), 1);
      if (stack.length === 0) document.body.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [enabled]);
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** False while saving, so a stray click or Escape can't drop the request. */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const close = () => {
    if (dismissible) onClose();
  };
  useDialogBehavior(ref, close);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgb(16_16_20/0.42)] p-0 animate-fade-in sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-dialog bg-surface shadow-dialog outline-none animate-pop-in sm:rounded-dialog",
          size === "sm" ? "sm:max-w-[420px]" : size === "lg" ? "sm:max-w-[680px]" : "sm:max-w-[540px]",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-4 pb-3.5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-ui text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton icon={IconX} label="Close" size="sm" onClick={close} className="-mt-0.5 -mr-1.5" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-subtle px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Menu ----------

export interface MenuItem {
  label: string;
  icon?: (p: { size?: number; className?: string }) => ReactNode;
  onSelect: () => void;
  tone?: "danger";
  disabled?: boolean;
}

/** A button that opens a small list of actions. Arrow keys move, Enter picks, Escape closes. */
export function Menu({ trigger, items, align = "end", placement = "bottom" }: { trigger: (props: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu"; ref: React.Ref<HTMLButtonElement> }) => ReactNode; items: (MenuItem | "divider")[]; align?: "start" | "end"; placement?: "bottom" | "top" }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const place = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      setPos({ top: placement === "bottom" ? r.bottom + 6 : r.top - 6, left: align === "end" ? r.right : r.left, width: r.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, placement]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const nodes = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    nodes[(i + (e.key === "ArrowDown" ? 1 : -1) + nodes.length) % nodes.length]?.focus();
  };

  return (
    <>
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu", ref: triggerRef })}
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={moveFocus}
            className="fixed z-[150] min-w-44 rounded-lg border border-line bg-surface p-1 shadow-pop animate-pop-in"
            style={{
              top: placement === "bottom" ? pos.top : undefined,
              bottom: placement === "top" ? window.innerHeight - pos.top : undefined,
              left: align === "start" ? pos.left : undefined,
              right: align === "end" ? window.innerWidth - pos.left : undefined,
              minWidth: Math.max(176, pos.width),
            }}
          >
            {items.map((item, i) =>
              item === "divider" ? (
                <div key={`d${i}`} role="separator" className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cx(
                    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-ui outline-none transition-colors disabled:opacity-50",
                    item.tone === "danger" ? "text-danger-fg hover:bg-danger-soft focus-visible:bg-danger-soft" : "text-fg-2 hover:bg-muted hover:text-fg focus-visible:bg-muted",
                  )}
                >
                  {item.icon && <item.icon size={15} className={item.tone === "danger" ? undefined : "text-fg-muted"} />}
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export { useDialogBehavior };
