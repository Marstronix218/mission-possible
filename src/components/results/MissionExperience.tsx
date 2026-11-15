"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Mission,
  SatelliteDesign,
  Constraints,
  SimResult,
} from "@/types/game";
import { runSimulation, summarizeResources, partsCatalog } from "@/lib/sim";
import { defaultDesign } from "./missions";
import { api, backendAvailable, isMockMode } from "./cloud";
import {
  designSchema,
  type Classroom,
  type ClassroomProgress,
} from "./contracts";
import {
  loadAttempts,
  saveAttempt,
  draftKey,
  designerDraftKey,
  type SavedAttempt,
} from "./session";
import { classroomBlocker, attemptsRemaining } from "./classroom-policy";
import { loadClassroomState } from "./classroom-state";
import { useReducedMotion } from "./use-reduced-motion";
import { comparableAttempts, previousComparableAttempt } from "./history-model";
import { MissionSteps } from "@/components/story/MissionSteps";
import { buildMissionStory, diagnoseMission } from "@/lib/story/events";
import { LaunchSequence } from "./LaunchSequence";
import { MissionTimeline } from "./MissionTimeline";
import { OutcomeStory } from "./OutcomeStory";
import { AttemptComparison } from "./AttemptComparison";
import { HazardGrid } from "./HazardGrid";
import { NasaVsSimulated, hazardProvenance } from "./DataProvenance";
const metrics = [
  "Observation accuracy",
  "Response time",
  "Coverage",
  "Cost efficiency",
  "Reliability",
];
export default function MissionExperience({
  mission,
  stage,
  classroomId,
  attemptId,
}: {
  mission: Mission;
  stage: "brief" | "design" | "run" | "result";
  classroomId?: string;
  attemptId?: string;
}) {
  const router = useRouter();
  const [design, setDesign] = useState<SatelliteDesign>(defaultDesign);
  const [constraints, setConstraints] = useState<Constraints>(
    mission.defaultConstraints,
  );
  const [progress, setProgress] = useState(0);
  const [launchDone, setLaunchDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const [manualPlayback, setManualPlayback] = useState(false);
  const [stillPlayback, setStillPlayback] = useState(false);
  const motionReduced = reducedMotion || stillPlayback;
  const elapsedPlayback = useRef(0);
  const [clock, setClock] = useState(0);
  const [classProgress, setClassProgress] = useState<ClassroomProgress | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<SavedAttempt[]>([]);
  const [attempt, setAttempt] = useState<SavedAttempt | null>(null);
  const [compare, setCompare] = useState("");
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const requestId = useRef<string | null>(null);
  const base = "/mission/" + mission.slug;
  const suffix = classroomId ? "?classroom=" + classroomId : "";
  // The debrief replaces a long playback page; start at its headline once loaded.
  useEffect(() => {
    if (stage === "result" && loaded) window.scrollTo({ top: 0 });
  }, [stage, loaded]);
  useEffect(() => {
    let active = true;
    async function load() {
      await Promise.resolve();
      try {
        const store = classroomId
          ? null
          : localStorage.getItem(designerDraftKey(mission.slug));
        const shared = store ? JSON.parse(store)?.state?.design : null;
        const draft =
          shared && designSchema.safeParse(shared).success
            ? JSON.stringify(shared)
            : localStorage.getItem(draftKey(mission.slug, classroomId));
        if (draft) {
          const parsed = designSchema.safeParse(JSON.parse(draft));
          if (parsed.success && active) setDesign(parsed.data);
        }
        const rows = (backendAvailable ? [] : loadAttempts())
          .filter(
            (a) => a.slug === mission.slug && a.classroomId === classroomId,
          )
          .reverse();
        if (active) {
          setHistory(rows);
          setAttempt(
            rows.find((a) => a.id === attemptId) ??
              (attemptId ? null : (rows[0] ?? null)),
          );
        }
        if (classroomId) {
          const { classroom: c, progress } =
            await loadClassroomState(classroomId);
          if (active) {
            setClassroom(c);
            setClassProgress(progress);
            setClock(Date.now());
            setConstraints({
              budgetM: Number(c.budget_m),
              massKg: Number(c.mass_kg),
            });
          }
        }
        if (backendAvailable && stage === "result") {
          const remote = await api<
            {
              id: string;
              mission_slug: string;
              design: SatelliteDesign;
              constraints: Constraints | null;
              result: SimResult;
              created_at: string;
              classroom_id: string | null;
            }[]
          >("history", { missionSlug: mission.slug, classroomId });
          const rows: SavedAttempt[] = remote.map((a) => ({
            id: a.id,
            slug: a.mission_slug,
            design: a.design,
            constraints: a.constraints ?? mission.defaultConstraints,
            result: a.result,
            at: a.created_at,
            classroomId: a.classroom_id ?? undefined,
            verified: !isMockMode,
          }));
          if (active) {
            setHistory(rows);
            setAttempt(
              rows.find((a) => a.id === attemptId) ??
                (attemptId ? null : (rows[0] ?? null)),
            );
          }
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load mission.");
      } finally {
        if (active) setLoaded(true);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [mission.slug, mission.defaultConstraints, classroomId, attemptId, stage]);
  useEffect(() => {
    if (!classroomId) return;
    let active = true;
    const refresh = async () => {
      try {
        const { classroom: c, progress } =
          await loadClassroomState(classroomId);
        if (active) {
          setClassroom(c);
          setClassProgress(progress);
          setConstraints({
            budgetM: Number(c.budget_m),
            massKg: Number(c.mass_kg),
          });
          setClock(Date.now());
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Could not refresh classroom.",
          );
      }
    };
    const tick = setInterval(() => setClock(Date.now()), 1000);
    const changed = () => {
      void refresh();
    };
    window.addEventListener("storage", changed);
    window.addEventListener("mission-possible:mock-updated", changed);
    return () => {
      active = false;
      clearInterval(tick);
      window.removeEventListener("storage", changed);
      window.removeEventListener("mission-possible:mock-updated", changed);
    };
  }, [classroomId]);
  useEffect(() => {
    if (
      stage !== "run" ||
      !launchDone ||
      paused ||
      !loaded ||
      error ||
      (motionReduced && !manualPlayback)
    )
      return;
    const before = elapsedPlayback.current;
    if (before >= 18000) return;
    const start = performance.now();
    const timer = setInterval(() => {
      const elapsed = Math.min(18000, before + performance.now() - start);
      setProgress(elapsed / 18000);
      if (elapsed === 18000) clearInterval(timer);
    }, 100);
    return () => {
      elapsedPlayback.current = Math.min(
        18000,
        before + performance.now() - start,
      );
      clearInterval(timer);
    };
  }, [stage, launchDone, paused, loaded, error, motionReduced, manualPlayback]);
  const resources = useMemo(
    () => summarizeResources(design, constraints),
    [design, constraints],
  );
  const result = attempt?.result;
  const previous = attempt
    ? previousComparableAttempt(history, attempt)
    : undefined;
  const comparison = attempt
    ? (history.find(
        (a) => a.id === compare && comparableAttempts(attempt, a),
      ) ?? previous)
    : undefined;
  const classBlocker = classroomId
    ? (classroomBlocker(classroom, classProgress?.attemptsUsed ?? 0, clock) ??
      (!classProgress
        ? "Loading classroom participation…"
        : !classProgress.canSubmit
          ? "Join this classroom as a demo student before launching."
          : null))
    : null;
  const remaining = classroom
    ? attemptsRemaining(classroom, classProgress?.attemptsUsed ?? 0)
    : null;
  const playbackPaused = paused || (motionReduced && !manualPlayback);
  function update(next: SatelliteDesign) {
    setDesign(next);
    try {
      localStorage.setItem(
        draftKey(mission.slug, classroomId),
        JSON.stringify(next),
      );
      if (!classroomId)
        localStorage.setItem(
          designerDraftKey(mission.slug),
          JSON.stringify({ state: { design: next }, version: 0 }),
        );
      setError("");
    } catch {
      setError("Your browser could not save this draft.");
    }
  }
  async function launch() {
    setError("");
    if (resources.violations.length || classBlocker) return;
    try {
      localStorage.setItem(
        draftKey(mission.slug, classroomId),
        JSON.stringify(design),
      );
      router.push(base + "/run" + suffix);
    } catch {
      setError(
        "Browser storage is unavailable. Enable storage before launching.",
      );
    }
  }
  async function finish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (classBlocker) throw new Error(classBlocker);
      if (resources.violations.length)
        throw new Error(resources.violations.join(" "));
      let outcome: SimResult;
      const id = (requestId.current ??= crypto.randomUUID());
      let verified = false;
      if (backendAvailable) {
        const saved = await api<{ result: SimResult }>("attempt", {
          missionSlug: mission.slug,
          design,
          classroomId,
          requestId: id,
        });
        outcome = saved.result;
        verified = !isMockMode;
      } else {
        if (classroomId)
          throw new Error("Live classrooms require the backend connection.");
        outcome = runSimulation(mission, design, constraints);
      }
      const row: SavedAttempt = {
        id,
        slug: mission.slug,
        design,
        constraints,
        result: outcome,
        at: new Date().toISOString(),
        classroomId,
        verified,
      };
      if (backendAvailable) {
        try {
          saveAttempt(row);
        } catch {
          /* The primary attempt store succeeded; history can reload its result. */
        }
      } else saveAttempt(row);
      router.push(
        base +
          "/result?attempt=" +
          id +
          (classroomId ? "&classroom=" + classroomId : ""),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not submit this attempt.",
      );
      setBusy(false);
    }
  }
  const values = result
    ? [
        result.score.accuracy,
        result.score.responseTime,
        result.score.coverage,
        result.score.costEfficiency,
        result.score.reliability,
      ]
    : [];
  const simulated = useMemo(
    () => runSimulation(mission, design, constraints),
    [mission, design, constraints],
  );
  const runEvents = useMemo(
    () => buildMissionStory(mission, design, resources, simulated),
    [mission, design, resources, simulated],
  );
  const resultResources = useMemo(
    () => (attempt ? summarizeResources(attempt.design, attempt.constraints) : null),
    [attempt],
  );
  const resultEvents = useMemo(
    () =>
      attempt && resultResources
        ? buildMissionStory(mission, attempt.design, resultResources, attempt.result)
        : [],
    [mission, attempt, resultResources],
  );
  const resultDiagnosis = useMemo(
    () =>
      attempt && resultResources
        ? diagnoseMission(mission, attempt.design, resultResources, attempt.result)
        : null,
    [mission, attempt, resultResources],
  );
  function redesign(from: SatelliteDesign, slot?: string) {
    update(from);
    router.push(base + "/design" + suffix + (slot ? "#slot-" + slot : ""));
  }
  return (
    <main id="main-content" tabIndex={-1}>
      <Link className="back" href="/map">
        ← All missions
      </Link>
      <div className="eyebrow">
        {mission.category} / {stage}
        {classroom ? " / " + classroom.name : ""}
      </div>
      <h1>
        {stage === "brief"
          ? "A mission for "
          : stage === "design"
            ? "Design for "
            : stage === "run"
              ? launchDone
                ? "Observing "
                : "Launching for "
              : "Mission debrief: "}
        <em>{mission.city}</em>
      </h1>
      <p className="notice">
        Educational simulation · {hazardProvenance(mission)}{" "}
        {isMockMode
          ? "Mock classroom data stays in this browser. Scores are computed by the real simulation engine."
          : backendAvailable
            ? "Cloud submissions are recalculated on the server."
            : "Solo attempts are saved in this browser. Live classrooms and rankings require cloud configuration."}
      </p>
      {(stage === "run" || stage === "result") && (
        <MissionSteps
          slug={mission.slug}
          current={
            stage === "result" ? "debrief" : launchDone ? "observe" : "launch"
          }
          query={suffix}
        />
      )}
      {!loaded && <p role="status">Loading mission…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {classroomId && loaded && stage !== "result" && (
        <section className="notice" aria-label="Classroom attempt status">
          <p>
            {classProgress?.isTeacher
              ? "Teacher preview"
              : `Your attempts: ${classProgress?.attemptsUsed ?? 0}${classroom?.max_attempts !== null && classroom?.max_attempts !== undefined ? " / " + classroom.max_attempts : ""}`}
            {remaining !== null ? ` · ${remaining} remaining` : ""}
          </p>
          {classBlocker && <p role="status">{classBlocker}</p>}
          <Link href={"/classroom/" + classroomId}>
            Return to classroom ranking ↗
          </Link>
        </section>
      )}
      {stage === "brief" && (
        <div className="two-column">
          <section className="panel">
            <h2>Protect your community from above.</h2>
            <p>{mission.objective.en}</p>
            <p>Achieve a score of at least 60 with at least 50% coverage.</p>
            <dl>
              <div>
                <dt>Budget</dt>
                <dd>${constraints.budgetM}M</dd>
              </div>
              <div>
                <dt>Mass</dt>
                <dd>{constraints.massKg} kg</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{mission.durationDays} days</dd>
              </div>
            </dl>
            <details>
              <summary>Observation hint</summary>
              <p>
                {mission.category === "flood"
                  ? "Radar can observe flood extent through clouds."
                  : "Thermal infrared reveals heat, but clouds can block observations."}
              </p>
            </details>
            {mission.sources.map((s) => (
              <p key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.name} ↗
                </a>
                <br />
                <small>{s.usage}</small>
              </p>
            ))}
          </section>
          <section className="panel">
            <h2>Make the trade-offs.</h2>
            <p>
              Choose instruments, orbit, power, communications, and storage.
              Your design changes coverage, accuracy, response time, and
              reliability.
            </p>
            <Link className="primary" href={base + "/design" + suffix}>
              Design your satellite ↗
            </Link>
          </section>
        </div>
      )}
      {stage === "design" && (
        <div className="two-column">
          <section className="panel">
            <h2>Satellite configuration</h2>
            <fieldset>
              <legend>Instruments · choose one or more</legend>
              {partsCatalog.instruments.map((p) => (
                <label className="choice" key={p.id}>
                  <input
                    type="checkbox"
                    checked={design.instruments.includes(p.id)}
                    onChange={(e) =>
                      update({
                        ...design,
                        instruments: e.target.checked
                          ? [...design.instruments, p.id]
                          : design.instruments.filter((id) => id !== p.id),
                      })
                    }
                  />
                  <span>
                    {p.name}
                    <small>
                      ${p.costM}M · {p.massKg} kg · {p.powerW} W ·{" "}
                      {p.dataGBPerDay} GB/day
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            {(
              [
                ["orbit", "Orbit", partsCatalog.orbits],
                ["solar", "Solar array", partsCatalog.solar],
                ["battery", "Battery", partsCatalog.batteries],
                ["comm", "Communications", partsCatalog.communications],
                ["storage", "Storage", partsCatalog.storage],
              ] as const
            ).map(([key, label, parts]) => (
              <label className="field" key={key}>
                {label}
                <select
                  value={design[key]}
                  onChange={(e) => update({ ...design, [key]: e.target.value })}
                >
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · ${p.costM}M · {p.massKg} kg
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="field">
              Ground stations
              <select
                value={design.groundStations}
                onChange={(e) =>
                  update({
                    ...design,
                    groundStations: Number(e.target.value) as 1 | 3 | 5,
                  })
                }
              >
                {[1, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} stations
                  </option>
                ))}
              </select>
            </label>
          </section>
          <aside className="panel">
            <h2>Resource dashboard</h2>
            <dl>
              <div>
                <dt>Budget</dt>
                <dd>
                  ${resources.costM}M / ${constraints.budgetM}M
                </dd>
              </div>
              <div>
                <dt>Mass</dt>
                <dd>
                  {resources.massKg} / {constraints.massKg} kg
                </dd>
              </div>
              <div>
                <dt>Power use / generation</dt>
                <dd>
                  {resources.powerUseW} / {resources.powerGenW} W
                </dd>
              </div>
              <div>
                <dt>Data generated / downlink</dt>
                <dd>
                  {resources.dataGBPerDay.toFixed(1)} /{" "}
                  {resources.downlinkGBPerDay.toFixed(1)} GB/day
                </dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>{resources.storageGB} GB</dd>
              </div>
            </dl>
            {resources.violations.map((v) => (
              <p className="error" key={v}>
                ✕ {v}
              </p>
            ))}
            {resources.warnings.map((v) => (
              <p className="notice" key={v}>
                △ {v}
              </p>
            ))}
            <button
              className="primary"
              disabled={
                !loaded || resources.violations.length > 0 || !!classBlocker
              }
              onClick={launch}
            >
              Launch mission ↗
            </button>
            <p>No score prediction is shown. Launch, learn, and redesign.</p>
          </aside>
        </div>
      )}
      {stage === "run" && (
        <section className="panel" aria-busy={busy}>
          <label className="choice">
            <input
              type="checkbox"
              checked={motionReduced}
              disabled={reducedMotion}
              onChange={(e) => {
                setStillPlayback(e.target.checked);
                setManualPlayback(false);
              }}
            />
            <span>
              Reduce motion{reducedMotion ? " (system preference)" : ""}
            </span>
          </label>
          {busy && (
            <p role="status">Saving your attempt. Your design is preserved.</p>
          )}
          {loaded && !launchDone && (
            <LaunchSequence
              events={runEvents.filter((e) => e.launchStage)}
              design={design}
              reducedMotion={motionReduced}
              onComplete={() => {
                setLaunchDone(true);
                requestAnimationFrame(() =>
                  document.getElementById("observe-heading")?.focus(),
                );
              }}
            />
          )}
          {loaded && launchDone && (
            <>
              <h2 id="observe-heading" tabIndex={-1}>
                Observe: race the deadline
              </h2>
              {motionReduced && !manualPlayback && (
                <p role="status" className="notice">
                  Reduced motion is on. Choose Play animation to start, or skip
                  directly to your results.
                </p>
              )}
              <MissionTimeline
                mission={mission}
                design={design}
                result={simulated}
                events={runEvents}
                progress={progress}
              />
            </>
          )}
          <div className="actions">
            {launchDone && (
              <button
                onClick={() => {
                  if (motionReduced && !manualPlayback) {
                    setManualPlayback(true);
                    setPaused(false);
                  } else setPaused((p) => !p);
                }}
                disabled={progress >= 1 || busy}
              >
                {motionReduced && !manualPlayback
                  ? "Play animation"
                  : playbackPaused
                    ? "Resume"
                    : "Pause"}
              </button>
            )}
            <button
              className="primary"
              disabled={
                !loaded ||
                busy ||
                resources.violations.length > 0 ||
                !!classBlocker
              }
              onClick={finish}
            >
              {busy
                ? "Submitting…"
                : progress === 1
                  ? "View results →"
                  : "Skip to results →"}
            </button>
            <Link href={base + "/design" + suffix}>Return to design</Link>
          </div>
        </section>
      )}
      {stage === "result" &&
        loaded &&
        (result && attempt && resultDiagnosis ? (
          <>
            <OutcomeStory
              mission={mission}
              design={attempt.design}
              result={result}
              events={resultEvents}
              diagnosis={resultDiagnosis}
              onRedesign={(slot) => redesign(attempt.design, slot)}
            />
            <NasaVsSimulated mission={mission}>
              <HazardGrid
                mission={mission}
                cells={result.cells}
                label={`Simulated observations of ${mission.city}`}
              />
              <p className="text-sm">
                {result.cells.filter((c) => c.observed).length} of{" "}
                {result.cells.length} map cells observed during the{" "}
                {mission.durationDays}-day simulated mission.
              </p>
            </NasaVsSimulated>
            <AttemptComparison
              attempt={attempt}
              comparison={comparison}
              history={history}
              compare={compare}
              onCompareChange={setCompare}
              resultHref={(id) =>
                base +
                "/result?attempt=" +
                id +
                (classroomId ? "&classroom=" + classroomId : "")
              }
            />
            <details className="panel">
              <summary>
                Score details · {result.score.total.toFixed(1)} / 100 ·{" "}
                {result.success ? "✓ Mission successful" : "△ Keep experimenting"}
              </summary>
              <div className="two-column">
                <div>
                  <div className="eyebrow">
                    MISSION SCORE · ENGINE {result.engineVersion}
                  </div>
                  <div className="score">
                    {result.score.total.toFixed(1)}
                    <small>/100</small>
                  </div>
                  <p>
                    Coverage {result.score.coverage.toFixed(1)}% ·{" "}
                    {isMockMode
                      ? "Local demo attempt"
                      : attempt.verified
                        ? "Submitted to cloud"
                        : "Local attempt"}
                  </p>
                  <Radar values={values} />
                  <dl>
                    {metrics.map((m, i) => (
                      <div key={m}>
                        <dt>{m}</dt>
                        <dd>{values[i].toFixed(1)} / 100</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <h2>Engine feedback</h2>
                  {result.feedback.map((f, i) => (
                    <article className="feedback" key={f.key + ":" + i}>
                      <span className="eyebrow">{f.type.toUpperCase()}</span>
                      <p>{f.message}</p>
                    </article>
                  ))}
                </div>
              </div>
            </details>
            <div className="actions">
              <button
                className="primary"
                onClick={() => redesign(attempt.design)}
              >
                Redesign this satellite ↗
              </button>
              <Link
                href={
                  "/leaderboard?mission=" +
                  mission.slug +
                  (classroomId ? "&classroom=" + classroomId : "")
                }
              >
                View ranking
              </Link>
            </div>
          </>
        ) : (
          <section className="panel">
            <h2>No attempt selected</h2>
            <p>Launch a satellite to generate a result.</p>
            <Link className="primary" href={base + "/design" + suffix}>
              Design a satellite ↗
            </Link>
          </section>
        ))}
    </main>
  );
}
function Radar({ values }: { values: number[] }) {
  const point = (i: number, r: number) =>
    [
      160 + Math.sin((i * Math.PI * 2) / 5) * r,
      140 - Math.cos((i * Math.PI * 2) / 5) * r,
    ].join(",");
  return (
    <svg
      className="radar"
      viewBox="0 0 320 290"
      role="img"
      aria-label={
        "Score breakdown: " +
        metrics.map((m, i) => m + " " + values[i]).join(", ")
      }
    >
      {[25, 50, 75, 100].map((r) => (
        <polygon
          key={r}
          points={values.map((_, i) => point(i, r)).join(" ")}
          fill="none"
          stroke="#344f64"
        />
      ))}
      {values.map((_, i) => (
        <line
          key={i}
          x1="160"
          y1="140"
          x2={point(i, 100).split(",")[0]}
          y2={point(i, 100).split(",")[1]}
          stroke="#344f64"
        />
      ))}
      <polygon
        points={values.map((v, i) => point(i, v)).join(" ")}
        fill="#78e3ce44"
        stroke="#78e3ce"
        strokeWidth="2"
      />
      {["Accuracy", "Response", "Coverage", "Cost", "Reliability"].map(
        (m, i) => (
          <text
            key={m}
            x={point(i, 125).split(",")[0]}
            y={Number(point(i, 125).split(",")[1]) + 4}
            textAnchor="middle"
            fill="#c2d4de"
            fontSize="11"
          >
            {m}
          </text>
        ),
      )}
    </svg>
  );
}
