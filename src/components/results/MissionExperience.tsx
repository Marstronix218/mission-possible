"use client";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Mission,
  MissionDecisions,
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
import { savedAttemptSchema } from "./history-model";
import { classroomBlocker, attemptsRemaining } from "./classroom-policy";
import { loadClassroomState } from "./classroom-state";
import { useReducedMotion } from "./use-reduced-motion";
import { MissionSteps } from "@/components/story/MissionSteps";
import { buildMissionStory } from "@/lib/story/events";
import { getMissionStory } from "@/lib/story/missions";
import type { PartSlot } from "@/lib/story/parts";
import { LaunchSequence } from "./LaunchSequence";
import { ObserveDeck } from "./ObserveDeck";
import { DecisionPrompt } from "./DecisionPrompt";
import { Debrief } from "./Debrief";
import { BeginnerObservation } from "@/components/gameplay/BeginnerObservation";
import { BeginnerDebrief } from "@/components/gameplay/BeginnerDebrief";
import { savePrediction, type Prediction } from "@/components/gameplay/Prediction";
import { modeKey } from "@/components/gameplay/beginner-model";
import { hazardProvenance } from "./DataProvenance";
import { fixHref, stripDecisions } from "./mission-debrief";
import {
  missionCheckpoints,
  retaskOffer,
  type CheckpointId,
} from "./mission-playback";
import {
  applyDecision,
  decisionCopy,
  describeChange,
} from "./mission-decisions";
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
  const [launchDone, setLaunchDone] = useState(false);
  const [predictionConfirmed, setPredictionConfirmed] = useState(false);
  const prediction = useRef<Prediction | null>(null);
  function confirmPrediction(value: Prediction | null) {
    prediction.current = value;
    setPredictionConfirmed(true);
  }
  const [beginner, setBeginner] = useState(false);
  const [observeEnded, setObserveEnded] = useState(false);
  const [decisions, setDecisions] = useState<MissionDecisions>({});
  const [answered, setAnswered] = useState<Set<CheckpointId>>(() => new Set());
  const [change, setChange] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const [stillPlayback, setStillPlayback] = useState(false);
  const motionReduced = reducedMotion || stillPlayback;
  const [clock, setClock] = useState(0);
  const [classProgress, setClassProgress] = useState<ClassroomProgress | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<SavedAttempt[]>([]);
  const [attempt, setAttempt] = useState<SavedAttempt | null>(null);
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
        if (active)
          setBeginner(
            !classroomId &&
              localStorage.getItem(modeKey(mission.slug)) === "beginner",
          );
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
          if (parsed.success && active) setDesign(stripDecisions(parsed.data));
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
          const rows: SavedAttempt[] = remote.map((a) => {
            const parsed = savedAttemptSchema.safeParse({
              id: a.id,
              slug: a.mission_slug,
              design: a.design,
              constraints: a.constraints ?? mission.defaultConstraints,
              result: a.result,
              at: a.created_at,
              classroomId: a.classroom_id ?? undefined,
              verified: !isMockMode,
            });
            if (!parsed.success)
              throw new Error(
                "A saved mission result is invalid. Please try loading your history again.",
              );
            return parsed.data;
          });
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
  const resources = useMemo(
    () => summarizeResources(design, constraints),
    [design, constraints],
  );
  const result = attempt?.result;
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
          design: runDesign,
          classroomId,
          requestId: id,
        });
        outcome = saved.result;
        verified = !isMockMode;
      } else {
        if (classroomId)
          throw new Error("Live classrooms require the backend connection.");
        outcome = runSimulation(mission, runDesign, constraints);
      }
      const row: SavedAttempt = {
        id,
        slug: mission.slug,
        design: runDesign,
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
      savePrediction(id, prediction.current);
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
  // ── Run: design + in-mission decisions → one engine result ────────────
  const runDesign: SatelliteDesign = { ...stripDecisions(design), decisions };
  const simulated = useMemo(
    () =>
      runSimulation(
        mission,
        { ...stripDecisions(design), decisions },
        constraints,
      ),
    [mission, design, decisions, constraints],
  );
  // The retask offer is read from the result *without* a retask, so answering it cannot move it.
  const preRetask = useMemo(() => {
    const { retask: _r, ...rest } = decisions;
    void _r;
    return runSimulation(
      mission,
      { ...stripDecisions(design), decisions: rest },
      constraints,
    );
  }, [mission, design, decisions, constraints]);
  const offer = useMemo(
    () => retaskOffer(mission, preRetask),
    [mission, preRetask],
  );
  const checkpoints = useMemo(() => missionCheckpoints(offer), [offer]);
  const hazardNoun = getMissionStory(mission.slug)?.hazardNoun ?? "hazard";
  const runEvents = useMemo(
    () => buildMissionStory(mission, design, resources, simulated),
    [mission, design, resources, simulated],
  );
  function answer(id: CheckpointId, choice: string) {
    const next = applyDecision(decisions, id, choice, offer);
    const after = runSimulation(
      mission,
      { ...stripDecisions(design), decisions: next },
      constraints,
    );
    setChange(describeChange(id, choice, simulated, after, offer));
    setDecisions(next);
    setAnswered((prev) => new Set([...prev, id]));
  }
  const onObserveEnd = useCallback(() => setObserveEnded(true), []);
  function fixAndRetry(from: SatelliteDesign, slots: PartSlot[]) {
    update(stripDecisions(from));
    router.push(fixHref(mission.slug, slots, classroomId));
  }
  const DebriefView = beginner ? BeginnerDebrief : Debrief;
  return (
    <main id="main-content" tabIndex={-1}>
      <Link className="back" href="/map">
        ← All missions
      </Link>
      <div className="eyebrow">
        {mission.category} / {stage}
        {classroom ? " / " + classroom.name : ""}
      </div>
      <h1
        className={
          stage === "run" || stage === "result" ? "sr-only" : undefined
        }
      >
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
      <details className="mb-4 text-sm text-muted-foreground">
        <summary>Simulation & data sources</summary>
        <p
          className={
            stage === "run" || stage === "result"
              ? "text-xs text-muted-foreground"
              : "notice"
          }
        >
          Educational simulation · {hazardProvenance(mission)}{" "}
          {isMockMode
            ? "Mock data stays in this browser; scores come from the real engine."
            : backendAvailable
              ? "Cloud submissions are recalculated on the server."
              : "Solo attempts are saved in this browser."}
        </p>
      </details>
      {(stage === "run" || stage === "result") && !beginner && (
        <MissionSteps
          slug={mission.slug}
          current={
            stage === "result" ? "discover" : launchDone ? "observe" : "launch"
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
            <p>You can predict your delivery time before launch.</p>
          </aside>
        </div>
      )}
      {stage === "run" && (
        <section aria-busy={busy} className="grid gap-4">
          <details>
            <summary>Playback options</summary>
            <label className="choice">
              <input
                type="checkbox"
                checked={motionReduced}
                disabled={reducedMotion}
                onChange={(e) => setStillPlayback(e.target.checked)}
              />
              <span>
                Reduce motion{reducedMotion ? " (system preference)" : ""}
              </span>
            </label>
          </details>
          {busy && (
            <p role="status">Saving your attempt. Your design is preserved.</p>
          )}
          {loaded && !predictionConfirmed && (
            <section className="panel grid gap-4" aria-labelledby="predict-heading">
              <div>
                <h2 id="predict-heading">Predict your first delivery</h2>
                <p>Will the first target detection reach Earth within {mission.targetResponseHours} hours?</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="primary" onClick={() => confirmPrediction("on-time")}>Yes, within the target</button>
                <button className="primary" onClick={() => confirmPrediction("late-or-none")}>No, later or never</button>
                <button className="secondary" onClick={() => confirmPrediction(null)}>Skip prediction</button>
              </div>
            </section>
          )}
          {loaded && predictionConfirmed && !launchDone && (
            <LaunchSequence
              events={runEvents.filter((e) => e.launchStage)}
              design={design}
              reducedMotion={motionReduced}
              city={mission.city}
              responseHours={mission.targetResponseHours}
              blocker={
                classBlocker ??
                (resources.violations.length
                  ? resources.violations.join(" ")
                  : null)
              }
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
              <h2
                id="observe-heading"
                tabIndex={-1}
                className="m-0 font-display"
              >
                🛰️ Observe {mission.city}
              </h2>
              {beginner ? (
                <BeginnerObservation
                  mission={mission}
                  design={runDesign}
                  resources={resources}
                  result={simulated}
                  reducedMotion={motionReduced}
                  onEnd={onObserveEnd}
                />
              ) : (
                <ObserveDeck
                  mission={mission}
                  design={runDesign}
                  resources={resources}
                  result={simulated}
                  reducedMotion={motionReduced}
                  checkpoints={beginner ? [] : checkpoints}
                  answered={answered}
                  change={change}
                  onEnd={onObserveEnd}
                  renderDecision={(id) => {
                    const copy = decisionCopy(id, hazardNoun, offer);
                    return (
                      <DecisionPrompt
                        alarm={copy.alarm}
                        title={copy.title}
                        subtitle={copy.subtitle}
                        options={copy.options}
                        onChoose={(choice) => answer(id, choice)}
                      />
                    );
                  }}
                />
              )}
            </>
          )}
          <div className="actions">
            {launchDone && (
              <button
                className={
                  observeEnded
                    ? "btn-pop btn-pop--lg"
                    : "btn-pop btn-pop--ghost"
                }
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
                  : observeEnded
                    ? "🔎 See what happened →"
                    : "⏩ Skip to results"}
              </button>
            )}
            <Link href={base + "/design" + suffix}>Back to design</Link>
          </div>
        </section>
      )}
      {stage === "result" &&
        loaded &&
        (result && attempt ? (
          <DebriefView
            key={attempt.id}
            mission={mission}
            attempt={attempt}
            history={history}
            reducedMotion={motionReduced}
            classroomId={classroomId}
            resultHref={(id) =>
              base +
              "/result?attempt=" +
              id +
              (classroomId ? "&classroom=" + classroomId : "")
            }
            onFix={(slots) => fixAndRetry(attempt.design, slots)}
          />
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
