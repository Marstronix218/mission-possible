"use client";
import { useEffect, useRef, useState } from "react";
import type { SatelliteDesign } from "@/types/game";
import type { LaunchStage, StoryEvent } from "@/lib/story/events";
import { StoryEventCard } from "./StoryEventCard";

const stages: { id: LaunchStage; label: string }[] = [
  { id: "liftoff", label: "Liftoff" },
  { id: "orbit", label: "Orbit insertion" },
  { id: "panels", label: "Solar panels deployed" },
  { id: "contact", label: "First contact with the ground" },
];
const COUNTDOWN = 3;
const DONE = COUNTDOWN + stages.length;

/**
 * Short launch sequence. Design problems surface at the stage where they
 * would first show up. Static (all stages complete) under reduced motion.
 */
export function LaunchSequence({
  events,
  design,
  reducedMotion,
  onComplete,
}: {
  events: StoryEvent[];
  design: SatelliteDesign;
  reducedMotion: boolean;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const startButton = useRef<HTMLButtonElement>(null);
  const shown = reducedMotion ? DONE : step;
  useEffect(() => {
    if (reducedMotion || step >= DONE) return;
    const timer = setTimeout(() => setStep((s) => s + 1), step < COUNTDOWN ? 800 : 1700);
    return () => clearTimeout(timer);
  }, [step, reducedMotion]);
  useEffect(() => {
    // Keep keyboard focus in place when the Skip button is replaced.
    if (skipped) startButton.current?.focus();
  }, [skipped]);
  const stageIndex = shown - COUNTDOWN; // -n..stages.length
  const problems = events.filter((e) => e.tone === "bad").length;
  const status =
    shown < COUNTDOWN
      ? `T-minus ${COUNTDOWN - shown}`
      : shown >= DONE
        ? problems
          ? `In orbit — ${problems} design problem${problems === 1 ? "" : "s"} found`
          : "In orbit — all systems working"
        : stages[stageIndex].label;
  const lifted = stageIndex >= 0;
  const inOrbit = stageIndex >= 1;
  const panelsOut = stageIndex >= 2;
  const contact = stageIndex >= 3;
  return (
    <section aria-labelledby="launch-heading" className="grid gap-6 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[220px]">
        <svg viewBox="0 0 200 260" className="w-full" role="img" aria-label={`Launch animation: ${status}`}>
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#050b14" />
              <stop offset="1" stopColor="#14304a" />
            </linearGradient>
          </defs>
          <rect width="200" height="260" rx="10" fill="url(#sky)" />
          {[18, 52, 96, 140, 170, 30, 120].map((x, i) => (
            <circle key={i} cx={x} cy={14 + ((i * 37) % 120)} r="0.9" fill="#cfe3f5" opacity="0.7" />
          ))}
          {/* Orbit arc */}
          <path d="M10 70 Q100 20 190 70" fill="none" stroke="#617a9a" strokeDasharray="3 3" opacity={inOrbit ? 1 : 0.3} />
          {/* Ground */}
          <rect y="236" width="200" height="24" fill="#1d3b2f" />
          {/* Ground station dish */}
          <g transform="translate(160 222)">
            <path d="M-8 0 Q0 -10 8 0 Z" fill="#a5bac9" />
            <rect x="-1" y="0" width="2" height="14" fill="#a5bac9" />
          </g>
          {contact && (
            <g stroke="#9ae6d3" strokeWidth="1.5" fill="none" strokeDasharray="4 3">
              <line x1="112" y1="52" x2="158" y2="214" />
            </g>
          )}
          {/* Launch pad */}
          <rect x="88" y="226" width="24" height="10" fill="#4e6070" />
          {/* Rocket */}
          <g
            className="motion-safe:transition-transform motion-safe:duration-[1600ms] motion-safe:ease-in"
            style={{ transform: `translateY(${lifted ? (inOrbit ? -320 : -120) : 0}px)` }}
          >
            <path d="M100 160 C110 175 112 200 110 226 L90 226 C88 200 90 175 100 160 Z" fill="#eaf1f5" />
            <rect x="94" y="196" width="12" height="4" fill="#8cddff" />
            <path d="M90 214 L82 228 L90 226 Z M110 214 L118 228 L110 226 Z" fill="#ffa38c" />
            {lifted && !inOrbit && <path d="M93 228 L100 252 L107 228 Z" fill="#ffcf7a" />}
          </g>
          {/* Satellite in orbit */}
          {inOrbit && (
            <g transform="translate(100 46)">
              <rect x="-7" y="-6" width="14" height="12" rx="1" fill="#d6e2ea" />
              <g
                className="motion-safe:transition-transform motion-safe:duration-700"
                style={{ transform: `scaleX(${panelsOut ? 1 : 0.15})`, transformOrigin: "0px 0px" }}
              >
                <rect x="-30" y="-4" width="22" height="8" fill="#3d7bd9" stroke="#8cddff" strokeWidth="0.6" />
                <rect x="8" y="-4" width="22" height="8" fill="#3d7bd9" stroke="#8cddff" strokeWidth="0.6" />
              </g>
            </g>
          )}
          <text x="100" y="250" textAnchor="middle" fontSize="11" fill="#eaf1f5" fontFamily="monospace">
            {shown < COUNTDOWN ? `T-${COUNTDOWN - shown}` : ""}
          </text>
        </svg>
      </div>
      <div className="min-w-0">
        <h2 id="launch-heading" className="mt-0">
          Launch
        </h2>
        <p role="status" className="font-mono text-sm text-[#fff2a5]">
          {status}
        </p>
        <ol className="m-0 grid list-none gap-3 p-0">
          {stages.map((stage, i) => {
            const state = i < stageIndex || shown >= DONE ? "done" : i === stageIndex ? "now" : "next";
            const stageEvents = events.filter((e) => e.launchStage === stage.id);
            return (
              <li key={stage.id} className={state === "next" ? "opacity-60" : undefined}>
                <p className="m-0 mb-2 text-sm font-semibold">
                  <span aria-hidden="true" className="mr-2 font-mono">
                    {state === "done" ? "✓" : state === "now" ? "▶" : "○"}
                  </span>
                  {stage.label}
                  <span className="sr-only">
                    {state === "done" ? " (complete)" : state === "now" ? " (in progress)" : " (waiting)"}
                  </span>
                </p>
                {state !== "next" && (
                  <div className="grid gap-2">
                    {stageEvents.map((e) => (
                      <StoryEventCard key={e.id} event={e} design={design} showHour={false} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="actions">
          {shown >= DONE ? (
            <button ref={startButton} className="primary" onClick={onComplete}>
              Start observing →
            </button>
          ) : (
            <button
              onClick={() => {
                setStep(DONE);
                setSkipped(true);
              }}
            >
              Skip launch
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
