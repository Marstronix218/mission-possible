import type { FitVerdict } from "@/lib/story/parts";

export interface PartCardProps {
  name: string;
  /** Shared radio-group name; omit for checkboxes. */
  group?: string;
  type: "radio" | "checkbox";
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  does?: string;
  good?: string;
  bad?: string;
  specs: string[];
  fit?: { verdict: FitVerdict; label: string };
  disabledReason?: string;
}

const fitStyle: Record<FitVerdict, { icon: string; className: string }> = {
  great: { icon: "✓", className: "border-emerald-400/70 bg-emerald-400/10 text-emerald-200" },
  partial: { icon: "◐", className: "border-amber-300/70 bg-amber-300/10 text-amber-100" },
  blind: { icon: "✕", className: "border-destructive/70 bg-destructive/10 text-destructive" },
};

/** One selectable part. A real radio/checkbox input keeps it keyboard and screen-reader friendly. */
export function PartCard({ name, group, type, checked, disabled, onChange, does, good, bad, specs, fit, disabledReason }: PartCardProps) {
  return (
    <label
      className={
        "relative flex h-full cursor-pointer flex-col gap-2 rounded-lg border-2 p-3 transition-colors " +
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring " +
        (checked ? "border-primary bg-card" : "border-border hover:border-primary/60") +
        (disabled ? " cursor-not-allowed opacity-60" : "")
      }
    >
      <input
        className="sr-only"
        type={type}
        name={group}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="flex items-start justify-between gap-2">
        <span className="font-semibold leading-tight">{name}</span>
        <span
          aria-hidden="true"
          className={
            "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold " +
            (checked ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")
          }
        >
          {checked ? "✓ Installed" : "+ Install"}
        </span>
      </span>
      {fit && (
        <span className={"inline-flex w-fit items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold " + fitStyle[fit.verdict].className}>
          <span aria-hidden="true">{fitStyle[fit.verdict].icon}</span>
          {fit.label}
        </span>
      )}
      {does && <span className="text-sm">{does}</span>}
      {(good || bad) && (
        <span className="space-y-1 text-sm">
          {good && (
            <span className="flex gap-1.5"><span aria-hidden="true">👍</span><span><b className="font-semibold">Good:</b> {good}</span></span>
          )}
          {bad && (
            <span className="flex gap-1.5"><span aria-hidden="true">⚠️</span><span><b className="font-semibold">Trade-off:</b> {bad}</span></span>
          )}
        </span>
      )}
      <span className="mt-auto flex flex-wrap gap-1 pt-1">
        {specs.map((spec) => (
          <span key={spec} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{spec}</span>
        ))}
      </span>
      {disabled && disabledReason && <span className="text-xs text-muted-foreground">{disabledReason}</span>}
    </label>
  );
}
