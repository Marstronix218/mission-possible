"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PredictionComparison } from "@/components/gameplay/Prediction";
import type { Mission } from "@/types/game";
import { summarizeResources, scoreFormulaText } from "@/lib/sim";
import { describeDesignChanges } from "@/lib/story/events";
import { getMissionStory } from "@/lib/story/missions";
import type { PartSlot } from "@/lib/story/parts";
import type { SavedAttempt } from "./session";
import { comparableAttempts } from "./history-model";
import { ObservationView } from "./observation/ObservationView";
import {
  causeLines,
  compareAttempts,
  fixSlots,
  scoreRows,
  teamPayoff,
  winLines,
  type CauseLine,
} from "./mission-debrief";
import {
  missionChallenges,
  missionStars,
  progressSlot,
  recordProgress,
  starCount,
  type RecordOutcome,
} from "./mission-progress";
import { quadrantName } from "./mission-playback";
import { MissionScoreRadar } from "@/components/planning/MissionScoreRadar";
import { ResultLeaderboard } from "@/components/player/ResultLeaderboard";
import styles from "./mission.module.css";

export const slotIcon: Record<PartSlot, string> = {
  instruments: "🔭",
  orbit: "🛰️",
  solar: "☀️",
  battery: "🔋",
  comm: "📻",
  groundStations: "📡",
  storage: "💾",
};
export const slotName: Record<PartSlot, string> = {
  instruments: "Sensor",
  orbit: "Orbit",
  solar: "Solar",
  battery: "Battery",
  comm: "Radio",
  groundStations: "Ground stations",
  storage: "Storage",
};
const decisionName = {
  focus: "Pointing call",
  downlink: "Downlink call",
  retask: "Retask call",
} as const;
const STEPS = 5;

/**
 * DISCOVER + IMPROVE. Reveals the debrief one beat at a time:
 * verdict → map → why → score → fix & retry.
 */
export function Debrief({
  mission,
  attempt,
  history,
  reducedMotion,
  classroomId,
  resultHref,
  onFix,
}: {
  mission: Mission;
  attempt: SavedAttempt;
  history: SavedAttempt[];
  reducedMotion: boolean;
  classroomId?: string;
  resultHref: (id: string) => string;
  onFix: (slots: PartSlot[]) => void;
}) {
  const { result, design } = attempt;
  const story = getMissionStory(mission.slug);
  const resources = useMemo(
    () => summarizeResources(design, attempt.constraints),
    [design, attempt.constraints],
  );
  const causes = useMemo(
    () => causeLines(mission, design, result),
    [mission, design, result],
  );
  const wins = useMemo(
    () => winLines(mission, design, result),
    [mission, design, result],
  );
  const payoff = teamPayoff(mission, result);
  const stars = missionStars(mission, result);
  const challenges = missionChallenges(mission, result, resources);
  const rows = scoreRows(mission, result, resources);
  const fixes = fixSlots(mission, design, result, causes);

  const [revealed, setRevealed] = useState(reducedMotion ? STEPS : 1);
  const shown = reducedMotion ? STEPS : revealed;
  useEffect(() => {
    if (reducedMotion || revealed >= STEPS) return;
    const t = setTimeout(
      () => setRevealed((r) => r + 1),
      revealed === 1 ? 1900 : 1300,
    );
    return () => clearTimeout(t);
  }, [revealed, reducedMotion]);

  const [progress, setProgress] = useState<RecordOutcome | null>(null);
  useEffect(() => {
    const outcome = recordProgress(progressSlot(mission.slug, classroomId), {
      id: attempt.id,
      score: result.score.total,
      stars: starCount(stars),
      deliveryHours: result.firstDeliveryHours,
      challenges: challenges.filter((c) => c.done).map((c) => c.id),
    });
    // Reading browser storage is only possible after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(outcome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.id]);
  const celebrate =
    !!progress?.firstView &&
    (progress.newBest ||
      progress.newStars ||
      progress.newChallenges.length > 0);
  const personalBest = progress?.entry.bestAttemptId === attempt.id;

  const score = useCountUp(result.score.total, reducedMotion);

  // Comparison with an earlier attempt.
  const ordered = useMemo(
    () => [...history].sort((a, b) => a.at.localeCompare(b.at)),
    [history],
  );
  const number = (a: SavedAttempt) =>
    ordered.findIndex((x) => x.id === a.id) + 1;
  const comparable = history.filter(
    (a) => comparableAttempts(attempt, a) && a.at < attempt.at,
  );
  const [compareId, setCompareId] = useState("");
  const comparison =
    comparable.find((a) => a.id === compareId) ??
    [...comparable].sort((a, b) => b.at.localeCompare(a.at))[0];

  const showAllButton = useRef<HTMLButtonElement>(null);

  return (
    <div className={`${styles.reveal} ${reducedMotion ? styles.still : ""}`}>
      {/* 1 — Verdict */}
      <section
        className={`${styles.hero} ${styles.step}`}
        aria-labelledby="verdict"
      >
        {celebrate && !reducedMotion && <Confetti />}
        <h2 id="verdict" className="sr-only">
          Verdict
        </h2>
        <p
          className={`${styles.stamp} ${result.success ? styles.good : styles.bad}`}
        >
          {result.success ? "MISSION SUCCESS" : "NOT YET!"}
        </p>
        <p
          className={styles.bigScore}
          aria-label={`Score ${result.score.total} out of 100`}
        >
          {score.toFixed(1)}
          <small>/100</small>
        </p>
        <p className={styles.payoff}>
          <span aria-hidden="true">
            {payoff.tone === "good" ? "🚒 " : "📭 "}
          </span>
          {payoff.headline}
        </p>
        {payoff.sub && (
          <p className="m-0 mt-1 text-muted-foreground">{payoff.sub}</p>
        )}
        <ul
          className={styles.starRow}
          aria-label={`${starCount(stars)} of 3 stars`}
        >
          {stars.map((s) => (
            <li
              key={s.id}
              className={`${styles.star} ${s.earned ? styles.starOn : ""}`}
            >
              <span className={styles.starIcon} aria-hidden="true">
                ⭐
              </span>
              <span>
                {s.earned ? "✓ " : "○ "}
                {s.label}
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-3 flex flex-wrap justify-center gap-2">
          {personalBest && (
            <span className="chip chip--solid">🏆 Personal best</span>
          )}
          {progress?.newChallenges.map((id) => (
            <span key={id} className="chip">
              🎉 Challenge done: {challenges.find((c) => c.id === id)?.label}
            </span>
          ))}
        </p>
        <p className="m-0 mt-3 text-xs text-muted-foreground">
          Simulated outcome for a fictional response team · engine{" "}
          {result.engineVersion}
        </p>
        {shown < STEPS && (
          <button
            ref={showAllButton}
            type="button"
            className="btn-pop btn-pop--ghost btn-pop--sm mt-3"
            onClick={() => setRevealed(STEPS)}
          >
            Show everything now
          </button>
        )}
      </section>

      <MissionScoreRadar
        mission={mission}
        design={design}
        result={result}
        constraints={attempt.constraints}
      />

      {/* 2 — Map */}
      {shown >= 2 && (
        <section
          className={`card-pop ${styles.step}`}
          aria-labelledby="saw-heading"
        >
          <h2 id="saw-heading" className="mt-0 font-display">
            🗺️ What your satellite saw
          </h2>
          <ObservationView
            mission={mission}
            design={design}
            resources={resources}
            result={result}
            hour={mission.durationDays * 24}
            mode="final"
            animate={false}
            retask={
              result.diagnostics?.decisions.retask ??
              design.decisions?.retask ??
              undefined
            }
            showSummary
          />
        </section>
      )}

      {/* 3 — Why */}
      {shown >= 3 && (
        <section
          className={`card-pop ${styles.step}`}
          aria-labelledby="why-heading"
        >
          <h2 id="why-heading" className="mt-0 font-display">
            🔍 Why it happened
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mt-0 font-display text-lg">
                <span aria-hidden="true">✕ </span>Problems
              </h3>
              {causes.length === 0 ? (
                <p>No problems found by the engine. Can you do it cheaper?</p>
              ) : (
                <ul className={styles.causes}>
                  {causes.slice(0, 4).map((c) => (
                    <CauseItem key={c.id} line={c} />
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mt-0 font-display text-lg">
                <span aria-hidden="true">✓ </span>What helped
              </h3>
              {wins.length === 0 ? (
                <p>
                  Nothing worked well enough yet — now you know where to look.
                </p>
              ) : (
                <ul className={styles.causes}>
                  {wins.slice(0, 4).map((c) => (
                    <CauseItem key={c.id} line={c} />
                  ))}
                </ul>
              )}
            </div>
          </div>
          {causes.length > 4 && (
            <details className="mt-3">
              <summary className="cursor-pointer">
                {causes.length - 4} more problems
              </summary>
              <ul className={`${styles.causes} mt-2`}>
                {causes.slice(4).map((c) => (
                  <CauseItem key={c.id} line={c} />
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* 4 — Score */}
      {shown >= 4 && (
        <section
          className={`card-pop ${styles.step}`}
          aria-labelledby="score-heading"
        >
          <h2 id="score-heading" className="mt-0 font-display">
            🧮 How your score adds up
          </h2>
          <p className="m-0 text-sm text-muted-foreground">
            {scoreFormulaText(mission.category)}
          </p>
          <div className="mt-2">
            {rows.map((r) => (
              <div key={r.metric} className={styles.scoreRow}>
                <span>
                  <strong>{r.label}</strong>{" "}
                  <span className="text-sm text-muted-foreground">
                    · weight {r.weight}%
                  </span>
                </span>
                <span className={styles.scorePoints}>
                  {r.weightedPoints} / {r.weight} pts
                </span>
                <span
                  className={styles.scoreBar}
                  role="meter"
                  aria-label={`${r.label} ${r.value} out of 100`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={r.value}
                >
                  <span
                    className={styles.scoreBarFill}
                    style={{ width: `${r.value}%` }}
                  />
                </span>
                {r.why && (
                  <span className="col-span-2 text-sm text-muted-foreground">
                    {r.why}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mb-0 font-display">
            Total {result.score.total} / 100 · success needs 60+ points and 50%+
            coverage
          </p>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer">Formulas</summary>
            <ul>
              {rows.map((r) => (
                <li key={r.metric}>
                  <strong>{r.label}:</strong> {r.formula}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {/* 5 — Improve */}
      <PredictionComparison id={attempt.id} mission={mission} result={result} />
      {shown >= 5 && (
        <section
          className={`card-pop ${styles.step}`}
          aria-labelledby="improve-heading"
        >
          <h2 id="improve-heading" className="mt-0 font-display">
            🔧 Improve
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid content-start gap-3">
              <button
                type="button"
                className={`btn-pop btn-pop--lg btn-pop--block ${styles.fixButton}`}
                onClick={() => onFix(fixes)}
              >
                🔧 {result.success ? "UPGRADE & RETRY" : "FIX & RETRY"}
              </button>
              {fixes.length > 0 && (
                <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
                  Check first:
                  {fixes.map((s) => (
                    <span key={s} className="chip">
                      <span aria-hidden="true">{slotIcon[s]}</span>{" "}
                      {slotName[s]}
                    </span>
                  ))}
                </p>
              )}
              <h3 className="mb-0 font-display text-lg">🏅 Challenges</h3>
              <ul className="m-0 grid list-none gap-2 p-0">
                {challenges.map((c) => (
                  <li
                    key={c.id}
                    className={`${styles.challenge} ${c.done || progress?.entry.challenges.includes(c.id) ? styles.challengeDone : ""}`}
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {c.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong>{c.label}</strong>
                      <br />
                      <span className="text-sm text-muted-foreground">
                        This run:{" "}
                        {c.value === null
                          ? "no delivery"
                          : c.id === "speed"
                            ? `${c.value} h`
                            : c.id === "budget"
                              ? `$${c.value}M`
                              : `${c.value} W`}
                        {c.id !== "speed" && !result.success
                          ? " (needs mission success)"
                          : ""}
                      </span>
                    </span>
                    <span className="font-display">
                      {c.done
                        ? "✓ Done"
                        : progress?.entry.challenges.includes(c.id)
                          ? "✓ Done before"
                          : "○ Open"}
                    </span>
                  </li>
                ))}
              </ul>
              {progress && (
                <p className="m-0 text-sm text-muted-foreground">
                  Personal best: {progress.entry.bestScore.toFixed(1)} pts ·{" "}
                  {progress.entry.bestStars}★
                  {progress.entry.bestDeliveryHours !== null
                    ? ` · fastest data ${progress.entry.bestDeliveryHours} h`
                    : ""}
                </p>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="mt-0 font-display text-lg">
                ↔️ Versus your last try
              </h3>
              {comparison ? (
                <Comparison
                  attempt={attempt}
                  comparison={comparison}
                  label={`Attempt ${number(attempt)} vs ${number(comparison)}`}
                />
              ) : (
                <p className="text-sm">
                  Retry this mission to see what your changes did.
                </p>
              )}
              {comparable.length > 1 && (
                <label className="field mt-2">
                  Compare with
                  <select
                    value={compareId}
                    onChange={(e) => setCompareId(e.target.value)}
                  >
                    <option value="">Previous attempt</option>
                    {comparable.map((a) => (
                      <option key={a.id} value={a.id}>
                        Attempt {number(a)} · {a.result.score.total.toFixed(1)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer font-display">
              📜 All attempts ({ordered.length})
            </summary>
            <ol className="mt-2">
              {[...ordered].reverse().map((a) => (
                <li key={a.id} value={number(a)}>
                  <Link
                    href={resultHref(a.id)}
                    aria-current={a.id === attempt.id ? "page" : undefined}
                  >
                    Attempt {number(a)} · {a.result.score.total.toFixed(1)}/100
                    ·{" "}
                    {a.result.firstDeliveryHours === null
                      ? "no delivery"
                      : `data at ${a.result.firstDeliveryHours} h`}
                  </Link>
                </li>
              ))}
            </ol>
          </details>
          {story && <p className="sr-only">{story.goal}</p>}
        </section>
      )}
      {/* Posted on load (idempotent per attempt ID); shown with the result. */}
      <ResultLeaderboard
        attemptId={attempt.id}
        missionSlug={mission.slug}
        classroomId={classroomId}
        verified={attempt.verified}
      />
    </div>
  );
}

function CauseItem({ line }: { line: CauseLine }) {
  const tag = line.slot
    ? `${slotIcon[line.slot]} ${slotName[line.slot]}`
    : line.decision
      ? `🎛️ ${decisionName[line.decision]}`
      : null;
  return (
    <li
      className={`${styles.cause} ${line.tone === "bad" ? styles.causeBad : styles.causeGood}`}
    >
      <span className={styles.causeIcon} aria-hidden="true">
        {line.icon}
      </span>
      <p className={styles.causeText}>
        <span className="sr-only">
          {line.tone === "bad" ? "Problem: " : "Helped: "}
        </span>
        {line.text}
      </p>
      <p className={styles.causeMeta}>
        {line.detail}
        {tag && (
          <>
            {line.detail ? " · " : ""}
            <span className="whitespace-nowrap font-semibold">{tag}</span>
          </>
        )}
        <span className="sr-only"> (from engine data: {line.source})</span>
      </p>
    </li>
  );
}

function Comparison({
  attempt,
  comparison,
  label,
}: {
  attempt: SavedAttempt;
  comparison: SavedAttempt;
  label: string;
}) {
  const cost = (a: SavedAttempt) =>
    summarizeResources(a.design, a.constraints).costM;
  const rows = compareAttempts(
    { result: comparison.result, costM: cost(comparison) },
    { result: attempt.result, costM: cost(attempt) },
  );
  const changes = describeDesignChanges(comparison.design, attempt.design);
  const dec = (a: SavedAttempt) => a.result.diagnostics?.decisions;
  const before = dec(comparison);
  const after = dec(attempt);
  if (before && after) {
    if (before.focus !== after.focus)
      changes.push(`Pointing: ${before.focus} → ${after.focus}`);
    if (before.downlink !== after.downlink)
      changes.push(`Downlink: ${before.downlink} → ${after.downlink}`);
    const rq = (r?: { quadrant: keyof typeof quadrantName }) =>
      r ? quadrantName[r.quadrant] : "none";
    if (rq(before.retask) !== rq(after.retask))
      changes.push(`Retask: ${rq(before.retask)} → ${rq(after.retask)}`);
  }
  return (
    <>
      <p className="m-0 text-sm">
        <strong>Changed:</strong>{" "}
        {changes.length
          ? changes.join(" · ")
          : "nothing — same design and calls"}
      </p>
      <table className={`${styles.compare} mt-2`}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <th scope="col">What</th>
            <th scope="col">Before</th>
            <th scope="col">Now</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="font-normal">
                {r.label}
              </th>
              <td>{r.before}</td>
              <td>
                {r.after}{" "}
                {r.better !== null && (
                  <span
                    className={r.better ? styles.arrowUp : styles.arrowDown}
                  >
                    {r.trend === "up" ? "▲" : "▼"}
                    <span className="sr-only">
                      {r.better ? " better" : " worse"}
                    </span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function useCountUp(target: number, still: boolean) {
  const [value, setValue] = useState(still ? target : 0);
  useEffect(() => {
    if (still) return;
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      setValue(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, still]);
  return still ? target : value;
}

const confettiColors = [
  "var(--pop-yellow)",
  "var(--pop-pink)",
  "var(--pop-cyan)",
  "var(--pop-lime)",
  "var(--pop-violet)",
  "var(--pop-orange)",
];

function Confetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: confettiColors[i % confettiColors.length],
            animationDelay: `${(i % 7) * 90}ms`,
          }}
        />
      ))}
    </div>
  );
}
