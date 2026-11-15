"use client";
import { useId } from "react";
import styles from "./mission.module.css";

export interface DecisionOption {
  id: string;
  icon: string;
  title: string;
  text: string;
}

/** A mission-control call: two chunky options, keyboard first. The clock waits. */
export function DecisionPrompt({
  alarm,
  title,
  subtitle,
  options,
  onChoose,
}: {
  alarm?: string;
  title: string;
  subtitle?: string;
  options: DecisionOption[];
  onChoose: (id: string) => void;
}) {
  const headingId = useId();
  return (
    <div className={styles.decision} role="group" aria-labelledby={headingId}>
      {alarm && <span className={styles.alarm}>{alarm}</span>}
      <h3 id={headingId}>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      <div className={styles.options}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={styles.option}
            onClick={() => onChoose(o.id)}
          >
            <span className={styles.optionIcon} aria-hidden="true">
              {o.icon}
            </span>
            <span className={styles.optionTitle}>{o.title}</span>
            <span className={styles.optionText}>{o.text}</span>
          </button>
        ))}
      </div>
      <p className="text-xs">⏸ The mission clock waits for your call.</p>
    </div>
  );
}
