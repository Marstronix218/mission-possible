"use client";
import { useState } from "react";
import {
  comparisonParts,
  componentAxes,
  type PartCategory,
} from "./radar-model";
import { RadarChart } from "./RadarChart";
import styles from "./planning.module.css";
const names: Record<PartCategory, string> = {
  instruments: "Sensors",
  solar: "Solar panels",
  batteries: "Batteries",
  communications: "Radios",
  storage: "Memory",
  orbits: "Orbits",
};
export function ComponentComparison({
  category: initial = "instruments",
}: {
  category?: PartCategory;
}) {
  const [category, setCategory] = useState(initial);
  const parts = comparisonParts(category);
  const [ids, setIds] = useState<Record<string, [string, string]>>({});
  const [a, b] = ids[category] ?? [parts[0].id, parts[1].id];
  const axes = componentAxes(category, a),
    other = componentAxes(category, b);
  return (
    <details className={styles.comparison} open>
      <summary>Compare the trade-offs</summary>
      <div className={styles.tabs}>
        {Object.entries(names).map(([id, name]) => (
          <button
            key={id}
            onClick={() => setCategory(id as PartCategory)}
            aria-pressed={category === id}
          >
            {name}
          </button>
        ))}
      </div>
      <div className={styles.selects}>
        {([a, b] as const).map((id, i) => (
          <label key={i}>
            {i === 0 ? "Solid cyan" : "Dashed amber"}
            <select
              aria-label={`Compare component ${i === 0 ? "A" : "B"}`}
              value={id}
              onChange={(e) =>
                setIds({
                  ...ids,
                  [category]:
                    i === 0 ? [e.target.value, b] : [a, e.target.value],
                })
              }
            >
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <RadarChart
        axes={axes}
        comparison={other}
        label={`${parts.find((p) => p.id === a)?.name} compared with ${parts.find((p) => p.id === b)?.name}`}
      />
      <p className={styles.help}>
        Further out = more of the labelled trait. These are category-relative
        comparisons, not mission scores. A bigger polygon is not automatically a
        better mission.
      </p>
      <div className={styles.tableWrap}>
        <table>
          <caption>
            Actual catalog values · 0–100 compares all parts in this category
          </caption>
          <thead>
            <tr>
              <th>Trait</th>
              <th>Solid cyan</th>
              <th>Dashed amber</th>
            </tr>
          </thead>
          <tbody>
            {axes.map((axis, i) => (
              <tr key={axis.id}>
                <th>
                  {axis.label}
                  <small>{axis.meaning}</small>
                </th>
                <td>{axis.actual}</td>
                <td>{other[i].actual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>How the chart is calculated</summary>
        <p>
          Each trait is scaled between the minimum and maximum across this
          entire catalog category. Lower cost, mass, power use and data load are
          reversed so further out means less demand. Ratios use the displayed
          catalog units. These values do not alter the engine or show
          hazard-specific fit.
        </p>
      </details>
    </details>
  );
}
