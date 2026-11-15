import Link from "next/link";
import { categoryLabel } from "@/lib/story/missions";
import type { Category } from "@/types/game";
import {
  categoryColors,
  categorySymbols,
  categoryTagline,
  type MapMission,
} from "./missions";
import styles from "./MissionMap.module.css";

const sceneHazard: Record<Category, string> = {
  wildfire: "a wildfire burning toward houses under smoke",
  heat: "a blazing sun over hot rooftops",
  flood: "flood water rising around houses",
  snow: "heavy snow falling on houses",
  drought: "dry, cracked land near houses",
  storm: "storm clouds and lightning over houses",
  glacier: "glacier ice above a town",
  volcano: "a glowing volcano near houses",
};

function HazardLayer({ category }: { category: Category }) {
  switch (category) {
    case "wildfire":
    case "volcano":
      return (
        <>
          {category === "volcano" && (
            <path d="M110 150 L150 92 h20 L210 150Z" fill="#3a2a2e" />
          )}
          <g className={styles.flicker}>
            <path
              d={
                category === "volcano"
                  ? "M146 96 q6 -22 14 -6 q6 -18 12 6 Z"
                  : "M150 150 q8 -26 16 -6 q6 -20 14 -2 q6 -14 12 8 Z"
              }
              fill="url(#hero-flame)"
            />
          </g>
          {category === "wildfire" && (
            <g className={styles.flicker}>
              <path
                d="M110 146 q6 -18 12 -4 q5 -14 10 2 Z"
                fill="url(#hero-flame)"
              />
            </g>
          )}
          <g className={styles.drift} fill="#8a8f99" opacity="0.55">
            <ellipse cx="160" cy="112" rx="40" ry="14" />
            <ellipse cx="128" cy="100" rx="30" ry="11" />
            <ellipse cx="196" cy="98" rx="26" ry="10" />
          </g>
        </>
      );
    case "heat":
    case "drought":
      return (
        <g className={styles.pulse}>
          <circle cx="90" cy="70" r="22" fill="#f6d879" />
          <path
            d={
              category === "drought"
                ? "M60 168 l20 -6 l14 8 l22 -10 M120 172 l18 -8 l16 6"
                : "M60 120 q6 -8 0 -16 M80 120 q6 -8 0 -16 M100 120 q6 -8 0 -16"
            }
            stroke={category === "drought" ? "#c6ba80" : "#fb986f"}
            strokeWidth="2"
            fill="none"
          />
        </g>
      );
    case "flood":
    case "storm":
      return (
        <>
          <g className={styles.drift} fill="#5b6777" opacity="0.8">
            <ellipse cx="120" cy="80" rx="46" ry="16" />
            <ellipse cx="170" cy="72" rx="36" ry="14" />
          </g>
          {category === "storm" && (
            <path
              className={styles.pulse}
              d="M140 90 l-10 22 h10 l-8 22 l22 -30 h-10 l8 -14Z"
              fill="#fff2a5"
            />
          )}
          <path
            className={styles.drift}
            d="M0 168 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V200 H0Z"
            fill="#70c6fc"
            opacity="0.75"
          />
        </>
      );
    case "snow":
    case "glacier":
      return (
        <>
          {category === "glacier" && (
            <path
              d="M40 150 L90 96 L130 130 L170 90 L220 150Z"
              fill="#cfeff0"
              opacity="0.85"
            />
          )}
          <g className={styles.drift} fill="#f2f6ff">
            {[30, 70, 110, 150, 190, 250, 290].map((x, i) => (
              <circle key={x} cx={x} cy={80 + (i % 3) * 22} r="2" />
            ))}
          </g>
        </>
      );
  }
}

function HazardScene({ category }: { category: Category }) {
  return (
    <svg
      viewBox="0 0 320 200"
      className="h-auto w-full"
      role="img"
      aria-labelledby="hero-scene-title"
    >
      <title id="hero-scene-title">
        {`Illustration: a satellite watching ${sceneHazard[category]}.`}
      </title>
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101b2c" />
          <stop offset="1" stopColor="#4a2219" />
        </linearGradient>
        <linearGradient id="hero-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff6a3d" />
          <stop offset="1" stopColor="#ffd27a" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="10" fill="url(#hero-sky)" />
      <g fill="#f2f6ff" opacity="0.7">
        <circle cx="40" cy="24" r="1" />
        <circle cx="120" cy="14" r="1" />
        <circle cx="280" cy="30" r="1" />
        <circle cx="200" cy="10" r="1" />
      </g>
      {/* Satellite with downlink beam */}
      <polygon
        className={styles.beam}
        points="226,52 150,150 200,150"
        fill="#8cddff"
        opacity="0.35"
      />
      <g transform="translate(226 44)">
        <rect x="-26" y="-5" width="18" height="10" fill="#8cddff" />
        <rect x="8" y="-5" width="18" height="10" fill="#8cddff" />
        <rect x="-8" y="-8" width="16" height="16" rx="2" fill="#eaf1f5" />
        <circle cx="0" cy="10" r="3" fill="#fff2a5" />
      </g>
      {/* Hills */}
      <path
        d="M0 150 Q60 110 120 140 T240 130 T320 140 V200 H0Z"
        fill="#2a1d22"
      />
      <HazardLayer category={category} />
      {/* Homes */}
      <g fill="#d6e9f7">
        <path d="M232 170 l10 -9 l10 9 v12 h-20Z" />
        <path d="M258 172 l9 -8 l9 8 v10 h-18Z" />
        <path d="M282 168 l10 -9 l10 9 v14 h-20Z" />
      </g>
      <path d="M0 182 H320 V200 H0Z" fill="#1b1418" />
    </svg>
  );
}

export default function EmergencyHero({
  mission: m,
  onNext,
}: {
  mission: MapMission;
  onNext?: () => void;
}) {
  return (
    <section
      aria-labelledby="hero-heading"
      className={
        styles.hero + " overflow-hidden rounded-xl border-2 p-5 sm:p-8"
      }
      style={{ borderColor: categoryColors[m.category] }}
    >
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-bold tracking-widest uppercase">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[#10141c]"
          style={{ background: categoryColors[m.category] }}
          aria-live="polite"
        >
          <span aria-hidden="true" className={styles.pulse}>
            ●
          </span>
          {m.alert}
        </span>
        <span className="rounded-full border border-[#617a9a] px-3 py-1 text-[#b2c5df]">
          Training scenario · not live data
        </span>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <h1 id="hero-heading" className="mb-4 text-[clamp(30px,5vw,56px)]">
            {m.headline}
            <br />
            <em>{categoryTagline[m.category]}</em>
          </h1>
          {m.situation.length > 0 && (
            <p className="mb-5 max-w-xl text-base">
              {m.situation.slice(0, 2).join(" ")}
            </p>
          )}
          <div className="mb-6 rounded-lg border border-[#8cddff66] bg-[#0b1722cc] p-4">
            <div className="mb-1 text-xs font-bold tracking-widest text-[#8cddff] uppercase">
              <span aria-hidden="true">◎ </span>Your goal
            </div>
            <p className="m-0 text-base text-[#eaf1f5]">{m.goal}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              className="primary w-full justify-center text-base sm:w-auto"
              href={"/mission/" + m.slug + "/brief"}
            >
              Start the mission <span aria-hidden="true">→</span>
            </Link>
            <span className="text-sm text-[#b2c5df]">
              {m.dependents} are waiting on your data.
            </span>
            {onNext && (
              <button type="button" onClick={onNext}>
                <span aria-hidden="true">↻ </span>Show another emergency
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <HazardScene category={m.category} />
          <div
            className="absolute -bottom-4 left-3 rounded-lg border-2 bg-[#0b1722f2] px-4 py-2 shadow-lg sm:left-4"
            style={{ borderColor: categoryColors[m.category] }}
          >
            <div className="text-[10px] font-bold tracking-widest text-[#f2f6ff] uppercase">
              <span aria-hidden="true">⏱ </span>Deadline
            </div>
            <div className="font-mono text-3xl leading-none font-bold text-[#f2f6ff] sm:text-4xl">
              {String(m.deadlineHours).padStart(2, "0")}:00:00
            </div>
            <div className="text-xs text-[#b2c5df]">
              {m.deadlineHours}-hour window ·{" "}
              <span aria-hidden="true">{categorySymbols[m.category]} </span>
              {categoryLabel[m.category]}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-10 mb-0 max-w-2xl text-sm">
        <strong className="text-[#eaf1f5]">Why the clock matters:</strong>{" "}
        {m.deadlineReason}
      </p>
    </section>
  );
}
