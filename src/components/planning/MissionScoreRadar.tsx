"use client";
import { useState } from "react";
import type {
  Mission,
  SatelliteDesign,
  SimResult,
  Constraints,
} from "@/types/game";
import { summarizeResources } from "@/lib/sim";
import {
  causeLines,
  scoreRows,
  winLines,
} from "@/components/results/mission-debrief";
import { scoreAxes } from "./radar-model";
import { RadarChart } from "./RadarChart";
import styles from "./planning.module.css";
const suggestions: Record<string, string> = {
  accuracy:
    "Compare sensor detail and hazard suitability, then inspect misses and false alarms.",
  coverage:
    "Compare orbit swath and revisit factors; check where observation opportunities were missed.",
  responseTime:
    "Compare radio rate and ground-contact time. A faster link helps after detection occurs.",
  costEfficiency:
    "Try a lighter-cost part while preserving the observations the mission needs.",
  reliability:
    "Check solar power, shadow continuity and whether your data fits the available storage and downlink.",
};
export function MissionScoreRadar({
  mission,
  design,
  result,
  constraints,
}: {
  mission: Mission;
  design: SatelliteDesign;
  result: SimResult;
  constraints: Constraints;
}) {
  const [active, setActive] = useState(0);
  const axes = scoreAxes(result);
  const axis = axes[active];
  const r = summarizeResources(design, constraints);
  const row = scoreRows(mission, result, r).find((x) => x.metric === axis.id)!;
  const positives = winLines(mission, design, result).filter(
    (x) => x.metric === axis.id,
  );
  const negatives = causeLines(mission, design, result).filter(
    (x) => x.metric === axis.id,
  );
  return (
    <section
      className={styles.dashboard}
      aria-label="Interactive mission score breakdown"
    >
      <h2>Your mission, explained.</h2>
      <p className={styles.total}>
        {result.score.total.toFixed(1)} <small>/ 100 overall</small>
      </p>
      <div className={styles.scoreGrid}>
        <div>
          <RadarChart
            axes={axes}
            label="Five-axis mission performance"
            active={active}
            onSelect={setActive}
            animate
          />
          <p className={styles.help}>
            0 at the center · 100 at the edge. Hover, click or focus a point to
            see why. Radio delivery affects Timing and Reliability.
          </p>
          <div
            className={styles.tabs}
            role="group"
            aria-label="Explain a score"
          >
            {axes.map((a, i) => (
              <button
                key={a.id}
                aria-pressed={i === active}
                onClick={() => setActive(i)}
              >
                {a.label} {Math.round(a.value)}
              </button>
            ))}
          </div>
        </div>
        <article className={styles.explanation} aria-live="polite">
          <h3>
            {axis.label} · {axis.value.toFixed(1)} / 100
          </h3>
          <p>{axis.meaning}</p>
          <p>
            <strong>
              {row.weightedPoints} / {row.weight} points
            </strong>{" "}
            toward your overall score.
          </p>
          <p>{row.why}</p>
          <h4>What helped</h4>
          {positives.length ? (
            positives.map((x) => <p key={x.id}>✓ {x.text}</p>)
          ) : (
            <p>
              The explanation above shows how this value contributes to your
              mission.
            </p>
          )}
          <h4>What held it back</h4>
          {negatives.length ? (
            negatives.slice(0, 2).map((x) => <p key={x.id}>! {x.text}</p>)
          ) : (
            <p>No extra penalty was identified for this part of the mission.</p>
          )}
          <h4>Your next experiment</h4>
          <p>{suggestions[axis.id]}</p>
          <details>
            <summary>Show the calculation</summary>
            <p>{row.formula}</p>
          </details>
        </article>
      </div>
      <p className={styles.help}>
        First data:{" "}
        {result.firstDeliveryHours === null
          ? "not delivered"
          : `${result.firstDeliveryHours} h`}{" "}
        · response target {mission.targetResponseHours} h · modeled downlink{" "}
        {r.downlinkGBPerDay} GB/day · engine {result.engineVersion}
      </p>
    </section>
  );
}
