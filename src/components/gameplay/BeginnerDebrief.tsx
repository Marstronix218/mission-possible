"use client";
import Link from "next/link";
import { PredictionComparison } from "@/components/gameplay/Prediction";
import type { Mission } from "@/types/game";
import type { SavedAttempt } from "@/components/results/session";
import { finalCounts } from "@/components/results/MissionMap";
import { ObservationView } from "@/components/results/observation/ObservationView";
import {
  causeLines,
  compareAttempts,
  fixSlots,
  scoreRows,
  teamPayoff,
  winLines,
} from "@/components/results/mission-debrief";
import { comparableAttempts } from "@/components/results/history-model";
import type { PartSlot } from "@/lib/story/parts";
import { summarizeResources } from "@/lib/sim";
import { MissionScoreRadar } from "@/components/planning/MissionScoreRadar";
import { ResultLeaderboard } from "@/components/player/ResultLeaderboard";
import styles from "./gameplay.module.css";

export function BeginnerDebrief({
  mission,
  attempt,
  history,
  onFix,
  resultHref,
}: {
  mission: Mission;
  attempt: SavedAttempt;
  history: SavedAttempt[];
  onFix: (slots: PartSlot[]) => void;
  resultHref: (id: string) => string;
}) {
  const { result, design } = attempt;
  const causes = causeLines(mission, design, result);
  const wins = winLines(mission, design, result);
  const counts = finalCounts(result);
  const fixes = fixSlots(mission, design, result, causes);
  const payoff = teamPayoff(mission, result);
  const previous = history
    .filter((a) => comparableAttempts(attempt, a) && a.at < attempt.at)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const resources = summarizeResources(design, attempt.constraints);
  const comparisons = previous
    ? compareAttempts(
        {
          result: previous.result,
          costM: summarizeResources(previous.design, previous.constraints)
            .costM,
        },
        { result, costM: resources.costM },
      )
    : [];
  const improvement = comparisons.find(
    (c) => c.better && ["coverage", "delivery", "found"].includes(c.id),
  );
  const best = history
    .filter(
      (a) =>
        comparableAttempts(attempt, a) &&
        a.id !== attempt.id &&
        a.at < attempt.at,
    )
    .every((a) => a.result.score.total < result.score.total);
  const mainCause = causes[0];
  return (
    <article className={styles.shell}>
      <p className={styles.kicker}>{mission.city} / Mission result</p>
      <h1>{result.success ? "MISSION SUCCESS!" : "MISSION INCOMPLETE"}</h1>
      <p className={styles.outcomeText}>
        {payoff.headline} {payoff.sub}
      </p>
      <MissionScoreRadar
        mission={mission}
        design={design}
        result={result}
        constraints={attempt.constraints}
      />
      <section
        className={styles.observation}
        aria-labelledby="observation-heading"
      >
        <h2 id="observation-heading">What your satellite found</h2>
        <p className={styles.kicker}>
          Archived NASA reference vs. Your simulated observation
        </p>
        <ObservationView
          mission={mission}
          design={design}
          resources={resources}
          result={result}
          hour={mission.durationDays * 24}
          mode="final"
          animate={false}
          showSummary
        />
        <p>
          <strong>{counts.found} hazard zones found.</strong>{" "}
          {Math.round(result.score.coverage)}% of the area observed.
        </p>
      </section>
      <PredictionComparison id={attempt.id} mission={mission} result={result} />
      <section aria-label="Your next experiment">
        <h2>
          {mainCause
            ? "One thing to try next"
            : "Ready for another experiment?"}
        </h2>
        <p className={styles.outcomeText}>
          {mainCause?.text ??
            wins[0]?.text ??
            "Try a different design and compare the observations."}
        </p>
        <p>
          {mainCause?.slot
            ? `Adjust your ${{ instruments: "sensor", orbit: "orbit", solar: "solar array", battery: "battery", comm: "radio", storage: "storage", groundStations: "ground stations" }[mainCause.slot]} and compare the next result.`
            : "Try a different sensor or open Advanced Mode to change the platform."}
        </p>
        <div className={styles.row}>
          <button className={styles.primary} onClick={() => onFix(fixes)}>
            FIX & RETRY →
          </button>
          <Link className={styles.secondary} href="/map">
            Next mission
          </Link>
        </div>
      </section>
      {improvement && (
        <p role="status">
          ↑ {improvement.label} improved: {improvement.before} →{" "}
          {improvement.after}
        </p>
      )}
      <p>
        {best ? "New personal best · " : ""}Score{" "}
        {result.score.total.toFixed(1)} / 100{" "}
        <span className={styles.credit}>
          · fictional response team · engine {result.engineVersion}
        </span>
      </p>
      <details className={styles.observation}>
        <summary>Why it happened & engineering details</summary>
        <ul>
          {[...causes, ...wins].map((c) => (
            <li key={c.id}>
              {c.text} {c.detail}
            </li>
          ))}
        </ul>
        <p>Success requires 60+ points and at least 50% coverage.</p>
        <ul>
          {scoreRows(mission, result, resources).map((r) => (
            <li key={r.metric}>
              {r.label}: {r.value}/100. {r.why}
            </li>
          ))}
        </ul>
        <p>
          NASA datasets and educational models are identified in the mission
          letter. Thermal instruments sense surface radiation, not air
          temperature; radar does not directly measure heat or predict
          earthquakes.
        </p>
        {comparisons.length > 0 && (
          <table>
            <caption>Compared with your previous compatible attempt</caption>
            <thead>
              <tr>
                <th>Measure</th>
                <th>Previous</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c) => (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td>{c.before}</td>
                  <td>{c.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h3>Your saved attempts</h3>
        <ul>
          {history.map((a) => (
            <li key={a.id}>
              <Link href={resultHref(a.id)}>
                {a.result.score.total.toFixed(1)} points ·{" "}
                {new Date(a.at).toLocaleString("en-US")}
              </Link>
            </li>
          ))}
        </ul>
      </details>
      <ResultLeaderboard
        attemptId={attempt.id}
        missionSlug={mission.slug}
        verified={attempt.verified}
      />
    </article>
  );
}
