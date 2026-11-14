"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type {
  Mission,
  SatelliteDesign,
  Constraints,
  SimResult,
} from "@/types/game";
import { runSimulation, summarizeResources, partsCatalog } from "@/lib/sim";
import { defaultDesign } from "./missions";
import { api, cloudConfigured } from "./cloud";
import { designSchema, type Classroom } from "./contracts";
import {
  loadAttempts,
  saveAttempt,
  draftKey,
  designerDraftKey,
  type SavedAttempt,
} from "./session";
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
  const [paused, setPaused] = useState(false);
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
  useEffect(() => {
    let active = true;
    async function load() {
      await Promise.resolve();
      try {
        const store=classroomId?null:localStorage.getItem(designerDraftKey(mission.slug));
        const shared=store?JSON.parse(store)?.state?.design:null;
        const draft=shared&&designSchema.safeParse(shared).success?JSON.stringify(shared):localStorage.getItem(draftKey(mission.slug,classroomId));
        if (draft) {
          const parsed = designSchema.safeParse(JSON.parse(draft));
          if (parsed.success && active) setDesign(parsed.data);
        }
        const rows = loadAttempts()
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
          const c = await api<Classroom>("classroom", { id: classroomId });
          if (active) {
            setClassroom(c);
            setConstraints({
              budgetM: Number(c.budget_m),
              massKg: Number(c.mass_kg),
            });
          }
        }
        if(cloudConfigured&&stage==='result'){
          const remote=await api<{id:string;mission_slug:string;design:SatelliteDesign;constraints:Constraints|null;result:SimResult;created_at:string;classroom_id:string|null}[]>('history',{missionSlug:mission.slug,classroomId});
          const rows:SavedAttempt[]=remote.map(a=>({id:a.id,slug:a.mission_slug,design:a.design,constraints:a.constraints??mission.defaultConstraints,result:a.result,at:a.created_at,classroomId:a.classroom_id??undefined,verified:true}));
          if(active){setHistory(rows);setAttempt(rows.find(a=>a.id===attemptId)??(attemptId?null:rows[0]??null));}
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
  }, [mission.slug, mission.defaultConstraints, classroomId, attemptId,stage]);
  useEffect(() => {
    if (stage !== "run" || paused || progress >= 1 || !loaded || error) return;
    const timer = setInterval(
      () => setProgress((p) => Math.min(1, p + 0.01)),
      180,
    );
    return () => clearInterval(timer);
  }, [stage, paused, progress, loaded, error]);
  const resources = summarizeResources(design, constraints);
  const result = attempt?.result;
  const previous = history[history.findIndex((a) => a.id === attempt?.id) + 1];
  const comparison = history.find((a) => a.id === compare) ?? previous;
  function update(next: SatelliteDesign) {
    setDesign(next);
    try {
      localStorage.setItem(
        draftKey(mission.slug, classroomId),
        JSON.stringify(next),
      );
      if(!classroomId)localStorage.setItem(designerDraftKey(mission.slug),JSON.stringify({state:{design:next},version:0}));
      setError("");
    } catch {
      setError("Your browser could not save this draft.");
    }
  }
  async function launch() {
    setError("");
    if (resources.violations.length) return;
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
      if (resources.violations.length)
        throw new Error(resources.violations.join(" "));
      let outcome: SimResult;
      const id = (requestId.current ??= crypto.randomUUID());
      let verified = false;
      if (cloudConfigured) {
        const saved = await api<{ result: SimResult }>("attempt", {
          missionSlug: mission.slug,
          design,
          classroomId,
          requestId: id,
        });
        outcome = saved.result;
        verified = true;
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
      saveAttempt(row);
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
  const cells = stage === "result" ? result?.cells : simulated.cells;
  const track = simulated.timeline.slice(
    0,
    Math.max(1, Math.ceil(progress * simulated.timeline.length)),
  );
  const point = (p: { lon: number; lat: number }) => [
    ((p.lon - mission.bbox[0]) / (mission.bbox[2] - mission.bbox[0])) * 100,
    ((mission.bbox[3] - p.lat) / (mission.bbox[3] - mission.bbox[1])) * 100,
  ];
  const cellGrid = (complete: boolean) => (
    <div
      className="observation-grid"
      role="img"
      aria-label="Simulated observation cells: solid green observed, outlined orange detected hazards, striped blocked or missed, dark pending"
    >
      {cells?.map((c, i) => (
        <span
          key={c.id}
          className={
            !complete && i >= Math.floor(progress * cells.length)
              ? "pending"
              : c.detected
                ? "detected"
                : c.observed
                  ? "observed"
                  : "cloud"
          }
        />
      ))}
      {!complete && (
        <svg
          className="track-overlay"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points={track.map((p) => point(p).join(",")).join(" ")}
            fill="none"
            stroke="#f8cd76"
            strokeWidth="0.5"
          />
          <circle
            cx={point(track[track.length - 1])[0]}
            cy={point(track[track.length - 1])[1]}
            r="1.5"
            fill="#fff0a5"
          />
        </svg>
      )}
    </div>
  );
  return (
    <main>
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
              ? "Observing "
              : "Mission debrief: "}
        <em>{mission.city}</em>
      </h1>
      <p className="notice">
        Educational simulation · Hazard grids are modeled, not NASA
        observations.{" "}
        {cloudConfigured
          ? "Cloud submissions are recalculated on the server."
          : "Solo attempts are saved in this browser. Live classrooms and rankings require cloud configuration."}
      </p>
      {!loaded && <p role="status">Loading mission…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
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
                !loaded ||
                resources.violations.length > 0 ||
                (!!classroomId && (!classroom || !classroom.is_active))
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
        <section className="panel">
          <div className="section-heading">
            <h2>Observation playback</h2>
            <span>
              Day{" "}
              {Math.min(
                mission.durationDays,
                Math.floor(progress * mission.durationDays) + 1,
              )}{" "}
              / {mission.durationDays}
            </span>
          </div>
          <progress value={progress} max="1" aria-label="Mission playback" />
          {cellGrid(false)}
          <div className="legend">
            <span>■ Observed</span>
            <span>◇ Detected hazard</span>
            <span>▧ Blocked / missed</span>
            <span>▪ Pending</span>
          </div>
          <p>
            Simulated cells; reveal order illustrates the completed engine
            result, rather than per-pass observation timing.
          </p>
          <div className="actions">
            <button
              onClick={() => setPaused((p) => !p)}
              disabled={progress >= 1 || busy}
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              className="primary"
              disabled={!loaded || busy || resources.violations.length > 0}
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
        (result && attempt ? (
          <>
            <div className="two-column">
              <section className="panel">
                <div className="eyebrow">
                  MISSION SCORE · ENGINE {result.engineVersion}
                </div>
                <div className="score">
                  {result.score.total.toFixed(1)}
                  <small>/100</small>
                </div>
                <span className="success">
                  {result.success
                    ? "✓ Mission successful"
                    : "△ Keep experimenting"}
                </span>
                <p>
                  Coverage {result.score.coverage.toFixed(1)}% ·{" "}
                  {attempt.verified ? "Submitted to cloud" : "Local attempt"}
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
              </section>
              <section className="panel">
                <h2>What your observations tell us</h2>
                {result.feedback.map((f, i) => (
                  <article className="feedback" key={f.key + ":" + i}>
                    <span className="eyebrow">{f.type.toUpperCase()}</span>
                    <p>{f.message}</p>
                  </article>
                ))}
                <div className="actions">
                  <button
                    className="primary"
                    onClick={() => {
                      update(attempt.design);
                      router.push(base + "/design" + suffix);
                    }}
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
              </section>
            </div>
            <section className="two-column">
              <div className="panel">
                <h2>NASA observed imagery</h2>
                <Image
                  width={512}
                  height={512}
                  className="nasa-image"
                  src={"/nasa/" + mission.slug + ".jpg"}
                  alt={
                    "NASA Terra MODIS true-color view of " +
                    mission.city +
                    " on July 1, 2024"
                  }
                />
                <p>
                  NASA GIBS · Terra MODIS true color · July 1, 2024.
                  Geographical context only; this image is not the source of
                  modeled hazard labels.
                </p>
                <a href={"/nasa/" + mission.slug + ".json"}>
                  Source, date, and bounding box ↗
                </a>
              </div>
              <div className="panel">
                <h2>Simulated observations</h2>
                {cellGrid(true)}
                <p>
                  Educational-model grid ·{" "}
                  {result.cells.filter((c) => c.observed).length} observed /{" "}
                  {result.cells.length} cells.
                </p>
                <p>◇ Detected hazards · ■ Observed · ▧ Blocked or missed</p>
              </div>
            </section>
            <section className="panel history">
              <h2>Compare attempts</h2>
              <label className="field">
                Compare with
                <select
                  value={compare}
                  onChange={(e) => setCompare(e.target.value)}
                >
                  <option value="">Previous attempt</option>
                  {history
                    .filter((a) => a.id !== attempt.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {new Date(a.at).toLocaleString("en-US")} ·{" "}
                        {a.result.score.total.toFixed(1)}
                      </option>
                    ))}
                </select>
              </label>
              {comparison ? (
                <>
                  <p>
                    Score change:{" "}
                    {(
                      result.score.total - comparison.result.score.total
                    ).toFixed(1)}{" "}
                    points
                  </p>
                  <ul>
                    {(Object.keys(attempt.design) as (keyof SatelliteDesign)[])
                      .filter(
                        (k) =>
                          JSON.stringify(attempt.design[k]) !==
                          JSON.stringify(comparison.design[k]),
                      )
                      .map((k) => (
                        <li key={k}>
                          {k}: {String(comparison.design[k])} →{" "}
                          {String(attempt.design[k])}
                        </li>
                      ))}
                  </ul>
                </>
              ) : (
                <p>Complete another attempt to compare designs and scores.</p>
              )}
              <ol>
                {history.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={
                        base +
                        "/result?attempt=" +
                        a.id +
                        (classroomId ? "&classroom=" + classroomId : "")
                      }
                    >
                      {new Date(a.at).toLocaleString("en-US")} ·{" "}
                      {a.result.score.total.toFixed(1)}/100 ·{" "}
                      {a.design.instruments.join(", ")}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
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
