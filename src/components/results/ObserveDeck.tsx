"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Mission,
  ResourceSummary,
  SatelliteDesign,
  SimResult,
} from "@/types/game";
import { getMissionStory } from "@/lib/story/missions";
import { MissionMap } from "./MissionMap";
import { MissionOrbit } from "./MissionOrbit";
import {
  advanceHour,
  cellFrame,
  clampToCheckpoint,
  deliveries,
  deliveryStatus,
  downlinkLatency,
  dueCheckpoint,
  missionMoments,
  nextMomentHour,
  observationWindowHours,
  playbackPlan,
  storageAt,
  storageSeries,
  windowState,
  type Checkpoint,
  type CheckpointId,
  type Moment,
} from "./mission-playback";
import styles from "./mission.module.css";

const r1 = (n: number) => Math.round(n * 10) / 10;

function clockText(hour: number) {
  const day = Math.floor(hour / 24) + 1;
  const h = Math.floor(hour % 24);
  const m = Math.floor(((hour % 24) - h) * 60);
  return {
    day,
    time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
  };
}

function momentText(m: Moment, hazard: string, deadlineMet: boolean | null) {
  const n = m.count;
  switch (m.kind) {
    case "onset":
      return {
        icon: "🔥",
        text: `${n} new ${hazard} zone${n === 1 ? "" : "s"} appear${n === 1 ? "s" : ""}!`,
      };
    case "window":
      return { icon: "🛰️", text: "Observation window opens" };
    case "detect":
      return {
        icon: "🎯",
        text: `Spotted ${n} ${hazard} zone${n === 1 ? "" : "s"}!`,
      };
    case "blocked":
      return {
        icon: "☁️",
        text: `${n} look${n === 1 ? "" : "s"} at danger zones blocked`,
      };
    case "delivery":
      return { icon: "📡", text: "First data lands on the ground!" };
    case "deadline":
      return deadlineMet
        ? { icon: "✅", text: "Deadline reached — data already down" }
        : { icon: "⏰", text: "Deadline passes — no data yet!" };
    case "storage-full":
      return { icon: "💾", text: "Storage estimate reaches capacity" };
  }
}

/**
 * OBSERVE stage: mission clock, live map, orbit view, onboard data and
 * decision checkpoints. Pauses itself at each unanswered checkpoint and when
 * scrolled out of view or the tab is hidden.
 */
export function ObserveDeck({
  mission,
  design,
  resources,
  result,
  reducedMotion,
  checkpoints,
  answered,
  renderDecision,
  change,
  onEnd,
}: {
  mission: Mission;
  design: SatelliteDesign;
  resources: ResourceSummary;
  result: SimResult;
  reducedMotion: boolean;
  checkpoints: Checkpoint[];
  answered: Set<CheckpointId>;
  renderDecision: (id: CheckpointId) => ReactNode;
  /** Short "what changed" note after the last decision. */
  change: string | null;
  onEnd: () => void;
}) {
  const story = getMissionStory(mission.slug);
  const hazard = story?.hazardNoun ?? "hazard";
  const plan = useMemo(() => playbackPlan(mission, result), [mission, result]);
  const span = plan.spanHours;
  const windowHours = useMemo(() => observationWindowHours(design), [design]);
  const latency = downlinkLatency(result, resources);
  const packages = useMemo(
    () => deliveries(result, latency),
    [result, latency],
  );
  const storage = useMemo(
    () => storageSeries(resources, latency, windowHours, span),
    [resources, latency, windowHours, span],
  );
  const moments = useMemo(
    () => missionMoments(mission, result, packages, windowHours, storage),
    [mission, result, packages, windowHours, storage],
  );

  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(!reducedMotion);
  const [speed, setSpeed] = useState(1);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const hourRef = useRef(0);
  const endedRef = useRef(false);
  const due = dueCheckpoint(checkpoints, answered, hour);
  const done = hour >= span;

  // Pause when off-screen or the tab is hidden.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let inView = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        setVisible(inView && !document.hidden);
      },
      {
        threshold: 0.15,
      },
    );
    io.observe(el);
    const onVis = () => setVisible(inView && !document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Mission clock.
  useEffect(() => {
    if (!playing || due || !visible || done) return;
    let frame = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      acc += dt;
      if (acc >= 1 / 30) {
        const from = hourRef.current;
        const to = clampToCheckpoint(
          checkpoints,
          answered,
          from,
          advanceHour(plan, from, acc * speed),
        );
        acc = 0;
        hourRef.current = to;
        setHour(to);
        if (dueCheckpoint(checkpoints, answered, to) || to >= plan.spanHours)
          return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, due, visible, done, plan, speed, checkpoints, answered]);

  useEffect(() => {
    if (done && !endedRef.current) {
      endedRef.current = true;
      onEnd();
    }
  }, [done, onEnd]);

  function jump(to: number) {
    const target = clampToCheckpoint(
      checkpoints,
      answered,
      hourRef.current,
      Math.min(span, to),
    );
    hourRef.current = target;
    setHour(target);
  }

  // ── Derived HUD state at this hour ──────────────────────────────────
  const { day, time } = clockText(hour);
  const deadline = mission.targetResponseHours;
  const delivered = result.firstDeliveryHours;
  const deliveredYet = delivered !== null && hour >= delivered;
  const deadlineMet = delivered !== null ? delivered <= deadline : null;
  const deadlineBadge =
    deliveredYet && delivered! <= deadline
      ? { cls: styles.good, text: `✓ Deadline met · hour ${delivered}` }
      : deliveredYet
        ? { cls: styles.bad, text: `✕ ${r1(delivered! - deadline)} h late` }
        : hour >= deadline
          ? { cls: styles.bad, text: "✕ Deadline missed" }
          : {
              cls: styles.wait,
              text: `⏱ ${r1(deadline - hour)} h to deadline`,
            };
  const win = windowState(windowHours, hour, span);
  const { onboard, delivered: landed } = deliveryStatus(packages, hour);
  const stored = storageAt(storage, hour);
  const full = storage.capacityGB > 0 && stored >= storage.capacityGB - 0.01;
  const gridById = new Map(mission.grid.map((g) => [g.id, g]));
  let found = 0;
  let active = 0;
  for (const c of result.cells) {
    const g = gridById.get(c.id);
    if (!g || g.truth <= 0.5) continue;
    const f = cellFrame(g, c, hour, span);
    if (f.hazardActive) active += 1;
    if (f.flagged && !f.falseAlarm) found += 1;
  }
  const log = moments
    .filter((m) => m.hour <= hour + 1e-6)
    .slice(-4)
    .reverse();
  const pct = (h: number) => `${Math.min(100, (h / span) * 100)}%`;
  const retask =
    result.diagnostics?.decisions.retask ?? design.decisions?.retask;
  const nextHour = nextMomentHour(moments, hour);
  const still = reducedMotion || !playing;

  return (
    <div
      ref={root}
      className={`${styles.deck} ${reducedMotion ? styles.still : ""}`}
    >
      <div className="min-w-0">
        <div className={styles.hud}>
          <p
            className={styles.clock}
            aria-label={`Mission day ${day}, ${time}. Hour ${Math.floor(hour)} of ${span}.`}
          >
            Day {day} · {time}
            <small>
              h {Math.floor(hour)}/{span}
            </small>
          </p>
          <span className={`${styles.badge} ${deadlineBadge.cls}`}>
            {deadlineBadge.text}
          </span>
        </div>
        <div className={styles.mapFrame}>
          <MissionMap
            mission={mission}
            result={result}
            hour={hour}
            mode="live"
            animate={!still && visible}
            retask={retask ?? undefined}
            label={`Live ${hazard} map of ${mission.city}, day ${day}: ${active} danger zones active, ${found} found by your satellite.`}
          />
          {due && (
            <div className={styles.overlay} key={due.id}>
              {renderDecision(due.id)}
            </div>
          )}
        </div>
        <ul className={styles.legend} aria-label="Map legend">
          <li>
            <span
              className={styles.swatch}
              style={{ background: `var(--hazard-${mission.category})` }}
              aria-hidden="true"
            />
            {hazard} (mission data)
          </li>
          <li>
            <span
              className={styles.swatch}
              style={{ background: "#e9edff", opacity: 0.6 }}
              aria-hidden="true"
            />
            {mission.category === "wildfire" || mission.category === "volcano"
              ? "Smoke"
              : "Cloud"}{" "}
            cover chance
          </li>
          <li>
            <span
              className={styles.swatch}
              style={{
                outline: "3px solid var(--pop-cyan)",
                outlineOffset: -3,
              }}
              aria-hidden="true"
            />
            Sensor look
          </li>
          <li>
            <span
              className={styles.swatch}
              style={{ background: "#c9cde6" }}
              aria-hidden="true"
            >
              ☁
            </span>
            Look blocked
          </li>
          <li>
            <span
              className={styles.swatch}
              style={{ background: "var(--pop-yellow)", borderRadius: 999 }}
              aria-hidden="true"
            >
              !
            </span>
            Found
          </li>
          <li>
            <span
              className={styles.swatch}
              style={{ background: "#2b3a92" }}
              aria-hidden="true"
            />
            Scanned
          </li>
        </ul>
        {change && (
          <p className={styles.change} role="status">
            <strong>What changed:</strong> {change}
          </p>
        )}
        <div className={styles.timeline} aria-hidden="true">
          <div className={styles.timelineFill} style={{ width: pct(hour) }} />
          {deadline < span && (
            <>
              <span
                className={styles.mark}
                style={{ left: pct(deadline), background: "var(--pop-yellow)" }}
              />
              <span
                className={styles.markLabel}
                style={{ left: pct(deadline), color: "var(--pop-yellow)" }}
              >
                ⏱ {deadline} h
              </span>
            </>
          )}
          {checkpoints
            .filter((c) => c.hour > 0)
            .map((c) => (
              <span
                key={c.id}
                className={styles.mark}
                style={{ left: pct(c.hour), background: "var(--pop-pink)" }}
              />
            ))}
          {deliveredYet && (
            <span
              className={styles.mark}
              style={{ left: pct(delivered!), background: "var(--pop-lime)" }}
            />
          )}
        </div>
        <div className={styles.controls}>
          <button
            type="button"
            className="btn-pop btn-pop--secondary btn-pop--sm"
            onClick={() => setPlaying((p) => !p)}
            disabled={done || !!due}
            aria-label={playing ? "Pause mission clock" : "Play mission clock"}
          >
            {playing ? "❚❚ Pause" : "▶ Play"}
          </button>
          <button
            type="button"
            className="btn-pop btn-pop--ghost btn-pop--sm"
            onClick={() => nextHour !== null && jump(nextHour)}
            disabled={done || !!due || nextHour === null}
          >
            ⏭ Next event
          </button>
          <div role="group" aria-label="Playback speed" className="flex gap-1">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                type="button"
                className="btn-pop btn-pop--ghost btn-pop--sm"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
                style={
                  speed === s
                    ? {
                        background: "var(--pop-cyan)",
                        color: "var(--primary-foreground)",
                      }
                    : undefined
                }
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.side}>
        <section className={styles.tile} aria-label="Satellite status">
          <h3 className={styles.tileTitle}>🛰️ YOUR SATELLITE</h3>
          <MissionOrbit
            city={mission.city}
            windowHours={windowHours}
            hour={hour}
            span={span}
            stations={design.groundStations}
            transmitting={onboard > 0 || stored > 0.05}
            geo={design.orbit === "geo"}
            animate={!still && visible}
          />
          <p className="m-0 mt-1 text-center font-display text-sm">
            {win.open ? (
              <span className={styles.info}>
                ● Over {mission.city} — observing
              </span>
            ) : Number.isFinite(win.untilOpen) ? (
              <>
                Next pass over {mission.city} in {r1(win.untilOpen)} h
              </>
            ) : (
              <>Last pass of the mission done</>
            )}
          </p>
        </section>
        <section className={styles.tile} aria-label="Mission data">
          <div className={styles.gauges}>
            <div className={styles.gauge}>
              <span className={styles.tileTitle}>🎯 FOUND</span>
              <span className={styles.gaugeValue}>
                {found}
                <small className="text-sm text-muted-foreground">
                  {" "}
                  / {active} active
                </small>
              </span>
            </div>
            <div className={styles.gauge}>
              <span className={styles.tileTitle}>📡 DATA PACKS</span>
              <span className={styles.gaugeValue}>
                {landed}{" "}
                <small className="text-sm text-muted-foreground">landed</small>
              </span>
              <span className="text-xs text-muted-foreground">
                {onboard} on board · {r1(latency)} h radio delay
              </span>
            </div>
            <div className={`${styles.gauge} col-span-2`}>
              <span className={styles.tileTitle}>
                💾 STORAGE ESTIMATE {full ? "· FULL!" : ""}
              </span>
              <div
                className={styles.bar}
                role="meter"
                aria-label="Estimated onboard storage used"
                aria-valuemin={0}
                aria-valuemax={storage.capacityGB}
                aria-valuenow={r1(stored)}
                aria-valuetext={`${r1(stored)} of ${storage.capacityGB} GB${full ? ", estimate at capacity" : ""}`}
              >
                <div
                  className={`${styles.barFill} ${full ? styles.barFull : ""}`}
                  style={{
                    width: `${storage.capacityGB ? Math.min(100, (stored / storage.capacityGB) * 100) : 0}%`,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {r1(stored)} / {storage.capacityGB} GB · collects{" "}
                {resources.dataGBPerDay} GB/day
              </span>
            </div>
          </div>
        </section>
        <section className={styles.tile} aria-labelledby="log-title">
          <h3 id="log-title" className={styles.tileTitle}>
            📋 MISSION LOG
          </h3>
          {log.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">
              Waiting for the first pass…
            </p>
          ) : (
            <ol
              className={styles.ticker}
              aria-live="polite"
              aria-relevant="additions"
            >
              {log.map((m) => {
                const t = momentText(m, hazard, deadlineMet);
                return (
                  <li key={m.kind + m.hour}>
                    <span className={styles.tickerHour}>
                      h {Math.floor(m.hour)}
                    </span>
                    <span aria-hidden="true">{t.icon}</span>
                    <span>{t.text}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <p className={styles.caption}>
          {
            "Every pass, cloud block, find and delivery comes from the simulation engine. The orbit drawing and storage gauge are simplified pictures of your design's real rates."
          }
        </p>
      </div>
    </div>
  );
}
