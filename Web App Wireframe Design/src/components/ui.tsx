import { Children, cloneElement, isValidElement, useEffect, useId, useRef, type ComponentProps, type ReactElement, type ReactNode } from "react";
import type { AppStatus } from "../data/types";
import { STATUS, STATUS_ORDER } from "../data/status";
import { dueTone, formatDate, relativeDay } from "../data/dates";
import { IconCheck, IconChevronDown, type IconComponent } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---------- Buttons ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium select-none transition-[background-color,border-color,color,box-shadow,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white shadow-xs hover:bg-ink-hover active:bg-black",
  secondary: "border border-line bg-surface text-fg shadow-xs hover:border-line-strong hover:bg-subtle active:bg-muted",
  ghost: "text-fg-2 hover:bg-muted hover:text-fg active:bg-muted-strong",
  danger: "bg-danger text-white shadow-xs hover:bg-danger-hover",
  "danger-ghost": "text-danger-fg hover:bg-danger-soft",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-ui",
  md: "h-8 px-3 text-ui",
  lg: "h-10 px-4 text-sm",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconComponent;
  loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", icon: Icon, loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)} {...rest}>
      {loading ? <Spinner size={size === "lg" ? 16 : 14} /> : Icon && <Icon size={size === "lg" ? 16 : 15} className={variant === "secondary" || variant === "ghost" ? "text-fg-muted" : undefined} />}
      {children}
    </button>
  );
}

type IconButtonProps = ComponentProps<"button"> & { icon: IconComponent; label: string; size?: "sm" | "md"; variant?: "ghost" | "secondary" };

export function IconButton({ icon: Icon, label, size = "md", variant = "ghost", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "size-7" : "size-8",
        variant === "ghost" ? "text-fg-muted hover:bg-muted hover:text-fg active:bg-muted-strong" : "border border-line bg-surface text-fg-muted shadow-xs hover:bg-subtle hover:text-fg",
        className,
      )}
      {...rest}
    >
      <Icon size={size === "sm" ? 15 : 16} />
    </button>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cx("shrink-0 animate-spin", className)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cx("inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface px-1 font-sans text-2xs font-medium text-fg-muted", className)}>
      {children}
    </kbd>
  );
}

// ---------- Form controls ----------

const FIELD_BASE =
  "w-full rounded-md border border-line bg-surface text-ui text-fg shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-fg-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-fg-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export const inputClass = (className?: string) => cx(FIELD_BASE, "h-8 px-2.5", className);

export function Input({ className, icon: Icon, ...rest }: ComponentProps<"input"> & { icon?: IconComponent }) {
  if (!Icon) return <input className={inputClass(className)} {...rest} />;
  return (
    <div className="relative">
      <Icon size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-faint" />
      <input className={inputClass(cx("pl-8", className))} {...rest} />
    </div>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx(FIELD_BASE, "min-h-20 resize-y px-2.5 py-2 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, wrapperClassName, children, ...rest }: ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={cx("relative", wrapperClassName)}>
      <select className={cx(FIELD_BASE, "h-8 appearance-none pr-8 pl-2.5", className)} {...rest}>
        {children}
      </select>
      <IconChevronDown size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}

/** Label + control + hint/error, wired together for screen readers. The single child receives the id. */
export function Field({ label, required, hint, error, className, children }: { label: ReactNode; required?: boolean; hint?: ReactNode; error?: string | null; className?: string; children: ReactElement }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: (child.props as { id?: string }).id ?? id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        // Only override when Field was told; otherwise keep whatever the control itself set.
        ...(required !== undefined && { required }),
      })
    : child;
  return (
    <div className={className}>
      <label htmlFor={(child.props as { id?: string }).id ?? id} className="mb-1.5 flex items-center gap-1 text-ui font-medium text-fg-2">
        {label}
        {required && (
          <span className="text-fg-faint" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger-fg">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-fg-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function Checkbox({ indeterminate, className, ...rest }: Omit<ComponentProps<"input">, "type"> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <span className={cx("relative inline-flex size-4 shrink-0", className)}>
      <input
        ref={ref}
        type="checkbox"
        className="peer size-4 appearance-none rounded-[4px] border border-line-strong bg-surface shadow-xs transition-colors checked:border-ink checked:bg-ink indeterminate:border-ink indeterminate:bg-ink hover:border-fg-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        {...rest}
      />
      <IconCheck size={12} strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100" />
      <span className="pointer-events-none absolute inset-0 m-auto h-0.5 w-2 rounded bg-white opacity-0 peer-indeterminate:opacity-100" />
    </span>
  );
}

// ---------- Layout ----------

export function Page({ children, className, width = "default" }: { children: ReactNode; className?: string; width?: "default" | "narrow" | "medium" | "wide" }) {
  return (
    <div className={cx("mx-auto w-full px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-8", width === "narrow" ? "max-w-[960px]" : width === "medium" ? "max-w-[1120px]" : width === "wide" ? "max-w-[1600px]" : "max-w-[1280px]", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-ui text-fg-muted">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-fg">{title}</h1>
        {description && <p className="mt-1 text-ui text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-card border border-line bg-surface", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, icon: Icon, action, className }: { title: ReactNode; description?: ReactNode; icon?: IconComponent; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start justify-between gap-3 px-4 pt-3.5 pb-3", className)}>
      <div className="flex min-w-0 items-start gap-2">
        {Icon && <Icon size={15} className="mt-0.5 text-fg-muted" />}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
    </div>
  );
}

/** A text link styled for card headers, e.g. "View all". */
export function LinkButton({ className, children, ...rest }: ComponentProps<"button">) {
  return (
    <button type="button" className={cx("inline-flex items-center gap-1 rounded text-ui font-medium text-fg-muted transition-colors hover:text-fg", className)} {...rest}>
      {children}
    </button>
  );
}

// ---------- Status & badges ----------

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
const TONE: Record<Tone, string> = {
  neutral: "bg-muted text-fg-2",
  accent: "bg-accent-soft text-accent-fg",
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  danger: "bg-danger-soft text-danger-fg",
};

export function Badge({ tone = "neutral", children, className, icon: Icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: IconComponent }) {
  return (
    <span className={cx("inline-flex h-5 items-center gap-1 rounded-full px-2 text-2xs font-medium whitespace-nowrap", TONE[tone], className)}>
      {Icon && <Icon size={12} strokeWidth={2} />}
      {children}
    </span>
  );
}

export function StatusDot({ status, className }: { status: AppStatus; className?: string }) {
  return <span aria-hidden="true" className={cx("inline-block size-2 shrink-0 rounded-full", STATUS[status].dot, className)} />;
}

export function StatusBadge({ status, className }: { status: AppStatus; className?: string }) {
  return (
    <span className={cx("inline-flex h-[22px] items-center gap-1.5 rounded-full pr-2.5 pl-2 text-xs font-medium whitespace-nowrap", STATUS[status].badge, className)}>
      <StatusDot status={status} />
      {STATUS[status].label}
    </span>
  );
}

/** A status badge that is also a native select, for changing stage in place. */
export function StatusSelect({ value, onChange, disabled, size = "sm", label = "Status", className }: { value: AppStatus; onChange: (status: AppStatus) => void; disabled?: boolean; size?: "sm" | "md"; label?: string; className?: string }) {
  return (
    <span className={cx("relative inline-flex", className)} onClick={(e) => e.stopPropagation()}>
      <span aria-hidden="true" className={cx("pointer-events-none absolute top-1/2 -translate-y-1/2", size === "sm" ? "left-2" : "left-2.5")}>
        <StatusDot status={value} />
      </span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as AppStatus)}
        className={cx(
          "appearance-none rounded-full border border-transparent font-medium [field-sizing:content] transition-[box-shadow,border-color] hover:border-black/10 focus:outline-none focus-visible:ring-3 focus-visible:ring-accent/20 disabled:opacity-60",
          size === "sm" ? "h-[22px] pr-6 pl-5 text-xs" : "h-8 pr-8 pl-6.5 text-ui",
          STATUS[value].badge,
        )}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS[s].label}
          </option>
        ))}
      </select>
      <IconChevronDown size={size === "sm" ? 12 : 14} strokeWidth={2} className={cx("pointer-events-none absolute top-1/2 -translate-y-1/2 opacity-60", size === "sm" ? "right-1.5" : "right-2.5", STATUS[value].badge.split(" ")[1])} />
    </span>
  );
}

/** "Oct 24 · In 6 days", colored by urgency. */
export function DueChip({ date, prefix, className }: { date: string; prefix?: string; className?: string }) {
  const tone = dueTone(date);
  return (
    <span
      title={formatDate(date, { long: true })}
      className={cx(
        "inline-flex items-center gap-1 text-xs whitespace-nowrap tabular-nums",
        tone === "danger" ? "font-medium text-danger-fg" : tone === "warning" ? "font-medium text-warning-fg" : "text-fg-muted",
        className,
      )}
    >
      {prefix && <span>{prefix}</span>}
      {tone === "neutral" ? formatDate(date) : prefix ? relativeDay(date).toLowerCase() : relativeDay(date)}
    </span>
  );
}

// ---------- Identity ----------

/** Monogram tile in the company's color; text is darkened from the same hue so it stays legible. */
export function CompanyLogo({ name, initials, color, size = 28, className }: { name: string; initials?: string; color: string; size?: number; className?: string }) {
  const text = initials || name.trim().slice(0, 2).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center font-semibold tracking-tight", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        fontSize: Math.max(9, Math.round(size * 0.36)),
        background: `color-mix(in oklab, ${color} 13%, white)`,
        color: `color-mix(in oklab, ${color} 72%, black)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)`,
      }}
    >
      {text}
    </span>
  );
}

const AVATAR_HUES = ["#2A78D6", "#E8622C", "#12996A", "#4B57D6", "#C2417A", "#0E8DA3", "#8A5A00", "#6E56CF"];

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const hue = AVATAR_HUES[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.37)),
        background: `color-mix(in oklab, ${hue} 14%, white)`,
        color: `color-mix(in oklab, ${hue} 75%, black)`,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

// ---------- Feedback & states ----------

const BANNER_TONE = {
  danger: "border-danger-line bg-danger-soft text-danger-fg",
  warning: "border-warning-line bg-warning-soft text-warning-fg",
  success: "border-success-line bg-success-soft text-success-fg",
  info: "border-line bg-subtle text-fg-2",
};

export function Banner({ tone = "danger", icon: Icon, children, action, className }: { tone?: keyof typeof BANNER_TONE; icon?: IconComponent; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-ui", BANNER_TONE[tone], className)}>
      {Icon && <Icon size={16} className="mt-0.5" />}
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="-my-0.5 shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, actions, compact, className }: { icon?: IconComponent; title: ReactNode; description?: ReactNode; actions?: ReactNode; compact?: boolean; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {Icon && (
        <div className={cx("mb-3.5 flex items-center justify-center rounded-xl border border-line bg-subtle text-fg-muted", compact ? "size-9" : "size-11")}>
          <Icon size={compact ? 17 : 20} />
        </div>
      )}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-ui text-fg-muted">{description}</p>}
      {actions && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-muted", className)} />;
}

// ---------- Segmented control & tabs ----------

export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: IconComponent; title?: string }[]; label: string; size?: "sm" | "md" }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-[background-color,color,box-shadow] duration-150",
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-ui",
              active ? "bg-surface text-fg shadow-[0_1px_2px_rgb(16_16_20/0.08),0_0_0_1px_rgb(16_16_20/0.04)]" : "text-fg-muted hover:text-fg",
            )}
          >
            {opt.icon && <opt.icon size={14} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cx(
              "relative -mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-ui font-medium whitespace-nowrap transition-colors",
              active ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cx("rounded-full px-1.5 text-2xs tabular-nums", active ? "bg-muted-strong text-fg-2" : "bg-muted text-fg-muted")}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
