import { CAREER_FIELDS, MAX_CAREER_FIELDS, type CareerField } from "../data/jobs";
import { cx } from "./ui";
import { IconCheck } from "./icons";

/** Toggle chips for up to MAX_CAREER_FIELDS fields, in the style of the Career log filters. */
export default function CareerFieldPicker({ value, onChange, size = "md" }: { value: CareerField[]; onChange: (fields: CareerField[]) => void; size?: "sm" | "md" }) {
  const full = value.length >= MAX_CAREER_FIELDS;
  return (
    <div role="group" aria-label={`Fields, up to ${MAX_CAREER_FIELDS}`} className="flex flex-wrap gap-1.5">
      {CAREER_FIELDS.map((field) => {
        const active = value.includes(field.value);
        const disabled = !active && full;
        return (
          <button
            key={field.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(active ? value.filter((f) => f !== field.value) : [...value, field.value])}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
              size === "sm" ? "h-7 px-2.5 text-ui" : "h-8 px-3 text-sm",
              active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-fg-2 enabled:hover:border-line-strong enabled:hover:text-fg",
            )}
          >
            {active && <IconCheck size={13} strokeWidth={2.5} />}
            {field.label}
          </button>
        );
      })}
    </div>
  );
}
