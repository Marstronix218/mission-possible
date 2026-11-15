import { partsCatalog } from "@/lib/sim";
import type { SatelliteDesign, ResourceSummary } from "@/types/game";
import styles from "./planning.module.css";
export function resourceChanges(
  before: ResourceSummary,
  after: ResourceSummary,
) {
  return (
    [
      ["costM", "Cost", "$M", false],
      ["massKg", "Mass", "kg", false],
      ["powerUseW", "Power needed", "W", false],
      ["powerGenW", "Power generated", "W", true],
      ["downlinkGBPerDay", "Downlink", "GB/day", true],
      ["storageGB", "Storage", "GB", true],
    ] as const
  ).flatMap(([key, label, unit, higher]) => {
    const delta = Math.round((after[key] - before[key]) * 10) / 10;
    return delta === 0
      ? []
      : [
          {
            key,
            label,
            unit,
            before: before[key],
            after: after[key],
            delta,
            improves: higher ? delta > 0 : delta < 0,
          },
        ];
  });
}
export function ResourceDelta({
  before,
  after,
  beforeDesign,
  design,
}: {
  before: ResourceSummary | null;
  after: ResourceSummary;
  beforeDesign?: SatelliteDesign | null;
  design?: SatelliteDesign;
}) {
  if (!before)
    return <p className={styles.help}>Install a part to see what changes.</p>;
  const changes = resourceChanges(before, after);
  const oldBattery = partsCatalog.batteries.find(
    (p) => p.id === beforeDesign?.battery,
  );
  const newBattery = partsCatalog.batteries.find(
    (p) => p.id === design?.battery,
  );
  const batteryChanged =
    oldBattery && newBattery && oldBattery.id !== newBattery.id;

  return (
    <section
      aria-label="What changed with your last part"
      className={styles.plan}
    >
      <h3 className="mt-0 text-base">Your last change</h3>
      <div className={styles.delta}>
        {changes.map((c) => (
          <span key={c.key} className={c.improves ? styles.up : styles.demand}>
            {c.improves ? "✓" : "!"} {c.label}: {c.before} → {c.after} {c.unit}{" "}
            ({c.delta > 0 ? "+" : ""}
            {c.delta})
          </span>
        ))}
      </div>
      {batteryChanged && (
        <p
          className={
            newBattery.eclipseContinuity > oldBattery.eclipseContinuity
              ? styles.up
              : styles.demand
          }
        >
          Shadow continuity: {Math.round(oldBattery.eclipseContinuity * 100)}% →{" "}
          {Math.round(newBattery.eclipseContinuity * 100)}% (modeled duty
          through eclipse)
        </p>
      )}
      {changes.length === 0 && <p>No change to these resource totals.</p>}
    </section>
  );
}
