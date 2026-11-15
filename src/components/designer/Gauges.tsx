import type { Gauge, GaugeStatus } from "./builder-model";
import styles from "./designer.module.css";

const statusStyle: Record<GaugeStatus, { icon: string; word: string; badge: string; bar: string }> = {
  ok: { icon: "✓", word: "OK", badge: "bg-ok text-space-950", bar: "bg-ok" },
  risky: { icon: "!", word: "RISKY", badge: "bg-warn text-space-950", bar: "bg-warn" },
  over: { icon: "✕", word: "OVER", badge: "bg-bad text-space-950", bar: "bg-bad" },
  waiting: { icon: "…", word: "WAITING", badge: "border-2 border-border text-muted-foreground", bar: "bg-muted-foreground" },
};

/**
 * Budget / Weight / Power / Data at a glance: a chunky bar plus an icon and a
 * word (OK, RISKY, OVER, WAITING), so status never relies on color alone.
 * Exact numbers appear only when the player asks for them.
 */
export function Gauges({ gauges, showNumbers, compact }: { gauges: Gauge[]; showNumbers: boolean; compact?: boolean }) {
  return (
    <ul className={compact ? "grid grid-cols-2 gap-x-3 gap-y-2" : "grid grid-cols-2 gap-3 lg:grid-cols-1"}>
      {gauges.map((gauge) => {
        const style = statusStyle[gauge.status];
        return (
          <li key={gauge.key} className={styles.popIn + " min-w-0"}>
            <div className="flex items-center justify-between gap-2">
              <span className={"flex items-center gap-1.5 font-display font-bold " + (compact ? "text-sm" : "text-base")}>
                <span aria-hidden="true">{gauge.icon}</span>{gauge.label}
              </span>
              <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black tracking-wider " + style.badge}>
                <span aria-hidden="true">{style.icon}</span>{style.word}
              </span>
            </div>
            <div aria-hidden="true" className={"relative mt-1 overflow-hidden rounded-full border-2 border-space-950 bg-space-950 " + (compact ? "h-2.5" : "h-4")}>
              <div className={styles.bar + " h-full rounded-full " + style.bar + (gauge.status === "over" ? " " + styles.overStripes : "")}
                style={{ width: `${Math.round(gauge.fill * 100)}%` }} />
            </div>
            {(showNumbers || gauge.hint) && (
              <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                {showNumbers ? gauge.numbers : gauge.hint}
                {showNumbers && gauge.hint ? ` · ${gauge.hint}` : ""}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
