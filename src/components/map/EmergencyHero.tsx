"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { categoryLabel } from "@/lib/story/missions";
import type { Category } from "@/types/game";
import { useReducedMotion } from "../results/use-reduced-motion";
import HazardIcon from "./HazardIcon";
import { briefHref, categoryColors, type MapMission } from "./missions";
import { useInView } from "./useInView";
import styles from "./MissionMap.module.css";

const INK = "#070a24";
/** Earth center and radius inside the 500×460 scene. */
const CX = 250;
const CY = 236;
const R = 138;
const ORBIT = `M${CX - 222} ${CY} a222 62 0 1 0 444 0 a222 62 0 1 0 -444 0`;
const ORBIT_SECONDS = 11;

/** Hazard beacons pinned to the globe. Each has its own icon + color. */
const beacons: { category: Category; x: number; y: number; delay: number }[] = [
  { category: "wildfire", x: 196, y: 196, delay: 0 },
  { category: "flood", x: 312, y: 258, delay: 0.7 },
  { category: "heat", x: 236, y: 306, delay: 1.3 },
];

function Satellite() {
  return (
    <g>
      <g transform="translate(0 -2)">
        <rect
          x="-33"
          y="-9"
          width="21"
          height="16"
          rx="2.5"
          fill="#2de2e6"
          stroke={INK}
          strokeWidth="2.5"
        />
        <path
          d="M-26 -9v16M-19 -9v16"
          stroke={INK}
          strokeWidth="1.4"
          opacity="0.5"
        />
        <rect
          x="12"
          y="-9"
          width="21"
          height="16"
          rx="2.5"
          fill="#2de2e6"
          stroke={INK}
          strokeWidth="2.5"
        />
        <path
          d="M19 -9v16M26 -9v16"
          stroke={INK}
          strokeWidth="1.4"
          opacity="0.5"
        />
        <path d="M-12 -1h4M8 -1h4" stroke={INK} strokeWidth="2.5" />
        <rect
          x="-9"
          y="-13"
          width="18"
          height="23"
          rx="5"
          fill="#ffd23f"
          stroke={INK}
          strokeWidth="2.5"
        />
        <circle
          cx="0"
          cy="-2"
          r="3.2"
          fill="#fff"
          stroke={INK}
          strokeWidth="1.8"
        />
        <path
          d="M0 10v5"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx="0"
          cy="17"
          r="3"
          fill="#ff5c8a"
          stroke={INK}
          strokeWidth="1.8"
          className={styles.blink}
        />
      </g>
    </g>
  );
}

function Continents({ dx }: { dx: number }) {
  return (
    <g
      transform={`translate(${dx} 0)`}
      fill="#8bf05a"
      stroke="#3f9c2d"
      strokeWidth="3"
      strokeLinejoin="round"
    >
      <path d="M120 150c20-22 62-26 84-10 14 10 8 30 22 40 16 12 4 34-16 36-18 2-22 18-38 22-20 4-30-14-46-22-18-10-30-44-6-66Z" />
      <path d="M190 262c18-6 36 4 40 22 4 16-6 30-2 46 4 18-10 30-24 24-14-6-18-24-26-38-10-18-8-48 12-54Z" />
      <path d="M300 140c26-12 64-6 78 14 10 14-2 28 8 42 12 16-4 34-24 30-16-4-26 8-42 2-18-6-14-26-28-36-16-12-12-42 8-52Z" />
      <path d="M330 250c16-4 34 6 36 22 2 14-12 22-24 22-14 0-24-10-26-22-2-10 4-20 14-22Z" />
      <path d="M420 190c18-10 44-6 52 10 6 14-6 26-20 30-16 4-36-2-40-16-2-10 0-18 8-24Z" />
    </g>
  );
}

function Clouds({ dx }: { dx: number }) {
  return (
    <g transform={`translate(${dx} 0)`} fill="#fff" opacity="0.85">
      <path d="M140 230h44a10 10 0 0 0-6-18 14 14 0 0 0-26-2 10 10 0 0 0-12 20Z" />
      <path d="M260 180h52a11 11 0 0 0-6-20 15 15 0 0 0-29-3 11 11 0 0 0-17 23Z" />
      <path d="M350 320h40a9 9 0 0 0-5-16 12 12 0 0 0-23-2 9 9 0 0 0-12 18Z" />
      <path d="M220 340h30a7 7 0 0 0-4-12 9 9 0 0 0-17-1 7 7 0 0 0-9 13Z" />
    </g>
  );
}

function EarthScene({
  svgRef,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 500 460"
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label="Cartoon Earth with three disaster alerts flashing — a wildfire, a flood and a heat wave — while a satellite circles the planet."
    >
      <defs>
        <radialGradient id="hero-ocean" cx="0.36" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#5fb0ff" />
          <stop offset="0.55" stopColor="#2a6cf0" />
          <stop offset="1" stopColor="#1b3aa8" />
        </radialGradient>
        <radialGradient id="hero-shade" cx="0.3" cy="0.28" r="0.85">
          <stop offset="0.55" stopColor={INK} stopOpacity="0" />
          <stop offset="1" stopColor={INK} stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id="hero-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.6" stopColor="#2de2e6" stopOpacity="0.35" />
          <stop offset="1" stopColor="#2de2e6" stopOpacity="0" />
        </radialGradient>
        <clipPath id="hero-earth">
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
        <clipPath id="hero-front" clipPathUnits="userSpaceOnUse">
          <rect x="-40" y={CY} width="580" height="300" />
        </clipPath>
        <path id="hero-orbit" d={ORBIT} />
      </defs>

      {/* Sparkles */}
      <g fill="#ffd23f">
        <path
          className={styles.twinkle}
          d="M60 70l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"
        />
        <path
          className={styles.twinkle}
          style={{ animationDelay: "1.1s" }}
          d="M440 60l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"
          fill="#2de2e6"
        />
        <path
          className={styles.twinkle}
          style={{ animationDelay: "0.5s" }}
          d="M455 380l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"
          fill="#ff5c8a"
        />
        <path
          className={styles.twinkle}
          style={{ animationDelay: "1.7s" }}
          d="M40 360l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z"
        />
      </g>

      <circle cx={CX} cy={CY} r={R + 46} fill="url(#hero-glow)" />

      <g transform={`rotate(-16 ${CX} ${CY})`}>
        {/* Back half of the orbit + satellite (hidden behind Earth) */}
        <use
          href="#hero-orbit"
          fill="none"
          stroke="#2de2e6"
          strokeWidth="2.5"
          strokeDasharray="2 10"
          strokeLinecap="round"
          opacity="0.6"
        />
        <g>
          <animateMotion dur={`${ORBIT_SECONDS}s`} repeatCount="indefinite">
            <mpath href="#hero-orbit" />
          </animateMotion>
          <Satellite />
        </g>
      </g>

      {/* Earth */}
      <g clipPath="url(#hero-earth)">
        <circle cx={CX} cy={CY} r={R} fill="url(#hero-ocean)" />
        <g className={styles.spinSlow}>
          <Continents dx={0} />
          <Continents dx={480} />
        </g>
        <ellipse cx={CX} cy={CY - R + 6} rx="70" ry="22" fill="#eaf6ff" />
        <ellipse cx={CX} cy={CY + R - 4} rx="80" ry="20" fill="#eaf6ff" />
        <g className={styles.spinFast}>
          <Clouds dx={0} />
          <Clouds dx={480} />
        </g>
        <circle cx={CX} cy={CY} r={R} fill="url(#hero-shade)" />
        <ellipse
          cx={CX - 52}
          cy={CY - 70}
          rx="34"
          ry="18"
          fill="#fff"
          opacity="0.22"
          transform={`rotate(-30 ${CX - 52} ${CY - 70})`}
        />
      </g>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={INK} strokeWidth="5" />

      {/* Disaster beacons */}
      {beacons.map((b) => (
        <g key={b.category} transform={`translate(${b.x} ${b.y})`}>
          <circle
            r="16"
            fill="none"
            stroke={categoryColors[b.category]}
            strokeWidth="4"
            className="anim-ring"
            style={{ animationDelay: `${b.delay}s` }}
          />
          <circle
            r="16"
            fill="none"
            stroke={categoryColors[b.category]}
            strokeWidth="3"
            className="anim-ring"
            style={{ animationDelay: `${b.delay + 1}s` }}
          />
          <circle
            r="17"
            fill={categoryColors[b.category]}
            stroke={INK}
            strokeWidth="3.5"
          />
          <g transform="translate(-12 -12)" style={{ color: INK }}>
            <HazardIcon category={b.category} size={24} />
          </g>
        </g>
      ))}

      {/* SOS tag */}
      <g className={styles.bob}>
        <g transform="translate(118 132) rotate(-8)">
          <rect
            x="-30"
            y="-17"
            width="60"
            height="32"
            rx="12"
            fill="#ff5c8a"
            stroke={INK}
            strokeWidth="3.5"
          />
          <path
            d="M14 13l12 14-20-10Z"
            fill="#ff5c8a"
            stroke={INK}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <rect x="-27" y="-14" width="54" height="26" rx="10" fill="#ff5c8a" />
          <text
            x="0"
            y="7"
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontWeight="700"
            fontSize="20"
            fill="#fff"
          >
            SOS!
          </text>
        </g>
      </g>

      {/* Front half of the orbit + satellite (drawn over Earth) */}
      <g transform={`rotate(-16 ${CX} ${CY})`}>
        <g clipPath="url(#hero-front)">
          <use
            href="#hero-orbit"
            fill="none"
            stroke="#2de2e6"
            strokeWidth="3"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
          <g>
            <animateMotion dur={`${ORBIT_SECONDS}s`} repeatCount="indefinite">
              <mpath href="#hero-orbit" />
            </animateMotion>
            <Satellite />
          </g>
        </g>
      </g>
    </svg>
  );
}

export default function EmergencyHero({ mission: m }: { mission: MapMission }) {
  const [sectionRef, inView] = useInView<HTMLElement>();
  const reducedMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const paused = !inView || reducedMotion;

  // SMIL orbit is not covered by CSS animation rules: drive it directly.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof svg.pauseAnimations !== "function") return;
    if (paused) {
      if (reducedMotion) svg.setCurrentTime(2);
      svg.pauseAnimations();
    } else {
      svg.unpauseAnimations();
    }
  }, [paused, reducedMotion]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-heading"
      data-paused={paused ? "true" : "false"}
      className="relative grid items-center gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10"
    >
      <div className="mx-auto w-full max-w-[300px] sm:max-w-[400px] lg:order-last lg:max-w-[560px]">
        <EarthScene svgRef={svgRef} />
      </div>
      <div className="text-center lg:text-left">
        <p className="m-0 mb-4">
          <span
            className="chip chip--solid text-base"
            style={{ "--hz": "var(--pop-pink)" } as React.CSSProperties}
          >
            <span aria-hidden="true" className="anim-pulse inline-block">
              ●
            </span>
            Disaster detected!
          </span>
        </p>
        <h1
          id="hero-heading"
          className="mb-6 text-[clamp(42px,7vw,84px)] leading-[0.98]"
        >
          Build a satellite.
          <br />
          <span className={styles.highlight}>Save the day!</span>
        </h1>
        <div className="flex flex-col items-center gap-4 sm:flex-row lg:items-center">
          <Link
            className="btn-pop btn-pop--lg"
            href={briefHref(m.slug)}
            aria-label={`Start mission: ${m.city} ${categoryLabel[m.category].toLowerCase()}`}
          >
            Start mission <span aria-hidden="true">▶</span>
          </Link>
          <span className={"chip hz-" + m.category + " min-h-11 text-sm"}>
            <span style={{ color: categoryColors[m.category] }}>
              <HazardIcon category={m.category} size={20} />
            </span>
            {m.city} · {m.deadlineHours}h
          </span>
        </div>
      </div>
    </section>
  );
}
