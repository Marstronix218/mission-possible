"use client";

import { useId, useState, type DragEvent, type ReactNode } from "react";
import type { Consequence, PartCopy } from "./builder-copy";
import { PartDragHandle } from "@/components/planning/PartDragHandle";
import styles from "./designer.module.css";

export interface CardStat {
  icon: string;
  label: string;
  level: 1 | 2 | 3;
  /** Exact value, shown when the player turns numbers on. */
  exact: string;
}

const levelWord = { 1: "low", 2: "medium", 3: "high" } as const;

export const DRAG_TYPE = "application/x-satellite-part";

function Chip({ chip }: { chip: Consequence }) {
  const plus = chip.sign === "+";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-xs font-bold " +
        (plus
          ? "border-pop-lime/70 text-pop-lime"
          : "border-pop-pink/70 text-pop-pink")
      }
    >
      <span aria-hidden="true">{plus ? "＋" : "−"}</span>
      <span className="sr-only">{plus ? "Strength: " : "Limit: "}</span>
      <span className="text-foreground">{chip.text}</span>
    </span>
  );
}

/**
 * One big, illustrated part. A real radio/checkbox input keeps it usable with
 * keyboard and screen readers; dragging onto the satellite is an optional extra.
 * The scientific name sits behind the "?" button.
 */
export function BuildCard({
  type,
  group,
  checked,
  disabled,
  disabledReason,
  onChange,
  copy,
  art,
  accent = "#2de2e6",
  stats = [],
  showNumbers,
  extra,
  dragId,
  dragSlot,
}: {
  type: "radio" | "checkbox";
  group?: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange: () => void;
  copy: PartCopy;
  art: ReactNode;
  accent?: string;
  stats?: CardStat[];
  showNumbers: boolean;
  extra?: ReactNode;
  dragId?: string;
  dragSlot?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const draggable = Boolean(dragId && dragSlot && !disabled);

  function onDragStart(event: DragEvent<HTMLLabelElement>) {
    if (!dragId || !dragSlot) return;
    event.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({ slot: dragSlot, id: dragId }),
    );
    event.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      className={
        styles.card +
        " relative flex min-w-0 flex-col rounded-[var(--radius)] border-[3px] shadow-[var(--shadow-pop)] " +
        (checked
          ? "border-pop-cyan bg-space-700"
          : "border-border bg-space-800 hover:border-pop-cyan/60") +
        (disabled ? " opacity-60" : "")
      }
    >
      <label
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        className={
          "flex min-h-24 gap-3 rounded-[var(--radius)] p-3 pr-12 has-focus-visible:outline-[3px] has-focus-visible:outline-offset-4 has-focus-visible:outline-ring " +
          (disabled ? "cursor-not-allowed" : "cursor-pointer")
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
        <span
          aria-hidden="true"
          className="relative flex size-20 shrink-0 items-center justify-center rounded-2xl border-2 border-space-950 p-1.5"
          style={{
            background: `color-mix(in srgb, ${accent} 22%, var(--space-900))`,
          }}
        >
          {art}
          {checked && (
            <span
              className={
                styles.popIn +
                " absolute -right-2 -bottom-2 flex size-7 items-center justify-center rounded-full border-2 border-space-950 bg-pop-cyan text-sm font-black text-space-950"
              }
            >
              ✓
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-lg leading-tight font-bold tracking-wide">
              {copy.name}
            </span>
            <span
              className={
                "rounded-full px-2 py-0.5 text-[11px] font-black tracking-wider " +
                (checked
                  ? "bg-pop-cyan text-space-950"
                  : "border border-border text-muted-foreground")
              }
            >
              {checked
                ? type === "checkbox"
                  ? "ON BOARD"
                  : "PICKED"
                : type === "checkbox"
                  ? "+ ADD"
                  : "PICK"}
            </span>
          </span>
          <span className="text-sm leading-snug text-muted-foreground">
            {copy.tag}
          </span>
          {copy.chips && (
            <span className="flex flex-wrap gap-1">
              {copy.chips.map((chip) => (
                <Chip key={chip.text} chip={chip} />
              ))}
            </span>
          )}
          {extra}
          {stats.length > 0 && (
            <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-xs">
              {stats.map((stat) => (
                <span
                  key={stat.label}
                  className="inline-flex items-center gap-1"
                >
                  <span aria-hidden="true">{stat.icon}</span>
                  <span className="sr-only">{stat.label}: </span>
                  {showNumbers ? (
                    <span className="font-mono font-bold">{stat.exact}</span>
                  ) : (
                    <>
                      <span
                        aria-hidden="true"
                        className="tracking-[-0.1em] text-pop-yellow"
                      >
                        {"●".repeat(stat.level)}
                        <span className="text-white/20">
                          {"●".repeat(3 - stat.level)}
                        </span>
                      </span>
                      <span className="sr-only">{levelWord[stat.level]}</span>
                    </>
                  )}
                </span>
              ))}
            </span>
          )}
          {disabled && disabledReason && (
            <span className="text-xs font-bold text-pop-yellow">
              {disabledReason}
            </span>
          )}
        </span>
      </label>
      {dragId && dragSlot && (
        <PartDragHandle
          slot={dragSlot}
          id={dragId}
          name={copy.name}
          onSelect={() => {
            if (!checked) onChange();
          }}
          disabled={disabled}
        />
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full border-2 border-border bg-space-900 font-display text-base font-bold text-muted-foreground hover:border-pop-yellow hover:text-pop-yellow focus-visible:outline-[3px] focus-visible:outline-ring"
      >
        <span aria-hidden="true">?</span>
        <span className="sr-only">
          {open ? `Hide details about ${copy.name}` : `What is ${copy.name}?`}
        </span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="mx-3 mb-3 rounded-xl bg-space-950/70 p-3 text-sm"
      >
        <p className="font-bold text-pop-yellow">{copy.science}</p>
        <p className="mt-1 text-muted-foreground">{copy.more}</p>
      </div>
    </div>
  );
}
