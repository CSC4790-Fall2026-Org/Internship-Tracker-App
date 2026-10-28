import { useState } from "react";
import { extractJobPosting, type ExtractResult } from "../data/jobPosting";
import { Banner, Button, Field, IconButton, Input, Textarea } from "./ui";
import { errorMessage } from "./feedback";
import { IconAlertCircle, IconLink, IconSparkles, IconX } from "./icons";

/**
 * "Import from posting" on the Add application form. Collapsed, it's a one-line prompt; open, it takes a pasted
 * description and/or a link and hands the extracted fields to the form. It never saves anything itself.
 */
export default function ImportPostingPanel({ onExtracted, disabled }: { onExtracted: (result: ExtractResult, input: { text: string; url: string }) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const extract = async () => {
    if (loading) return;
    if (!text.trim() && !url.trim()) {
      setError("Paste the job description, or add a link to the posting.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const input = { text: text.trim(), url: url.trim() };
      const result = await extractJobPosting(input);
      onExtracted(result, input);
      setOpen(false);
      setText("");
      setUrl("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-dashed border-line bg-subtle px-3 py-2.5">
        <p className="flex items-center gap-2 text-ui text-fg-2">
          <IconSparkles size={15} className="text-fg-muted" />
          Have the job posting? Paste it and we'll fill in the form.
        </p>
        <Button size="sm" icon={IconSparkles} onClick={() => setOpen(true)} disabled={disabled}>
          Import from posting
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-label="Import from posting"
      className="space-y-4 rounded-lg border border-line bg-subtle p-3.5"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          extract();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-fg">
            <IconSparkles size={15} className="text-fg-muted" />
            Import from posting
          </h3>
          <p className="mt-0.5 text-xs text-fg-muted">AI reads the posting and fills in the form below. Nothing is saved until you add the application.</p>
        </div>
        <IconButton icon={IconX} size="sm" label="Close import" onClick={() => setOpen(false)} disabled={loading} />
      </div>

      <Field label="Paste the job description">
        <Textarea
          rows={8}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          placeholder="Copy the whole posting (title, company, location, pay, deadline, requirements) and paste it here."
        />
      </Field>

      <Field label="Link to the posting" hint="Optional. Saved as the job posting link. On its own we'll try to read the page, but LinkedIn, Indeed and Handshake block that, so pasting works best.">
        <Input
          icon={IconLink}
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              extract();
            }
          }}
          disabled={loading}
          placeholder="company.com/careers/…"
        />
      </Field>

      {error && (
        <Banner icon={IconAlertCircle}>
          {error}
        </Banner>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto hidden text-xs text-fg-muted sm:block">{isMac ? "⌘" : "Ctrl"} + Enter to extract</span>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" icon={IconSparkles} onClick={extract} loading={loading}>
          {loading ? "Reading posting…" : error ? "Try again" : "Extract"}
        </Button>
      </div>
    </section>
  );
}
