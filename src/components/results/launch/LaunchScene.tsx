import type { CSSProperties } from "react";
import type { SatelliteDesign } from "@/types/game";
import { INK } from "@/components/designer/parts-art";
import type { SceneState } from "./launch-timeline";
import {
  LaunchSatellite,
  SATELLITE_HEIGHT,
  stowedWidth,
} from "./LaunchSatellite";
import styles from "./launch.module.css";

// Scene units: viewBox 0 0 400 440. The rocket stands on the pad at y = 392.
const PAD_Y = 392;
/** Where the satellite sits inside the fairing, relative to the rocket base. */
const BAY_Y = -236;
/** Free-flight poses in scene coordinates, on the dashed orbit arc once in orbit. */
const SEP_LIFT = 26;
const PANELS_POS = { x: 200, y: 92, scale: 0.55 };
const ORBIT_POS = { x: 200, y: 122, scale: 0.7 };
const TARGET_POS = { x: 228, y: 125, scale: 0.7 };
const EARTH_CENTRE = "200px 830px";

const stars = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 97 + 13) % 400,
  y: (i * 53 + 29) % 330,
  r: i % 5 === 0 ? 1.6 : 0.9,
}));
const clouds = [
  { x: 70, y: -260, w: 70 },
  { x: 310, y: -190, w: 90 },
  { x: 150, y: -110, w: 60 },
  { x: 330, y: -30, w: 55 },
  { x: 60, y: 30, w: 80 },
];
const smoke = [
  { x: -46, r: 16, d: 0 },
  { x: -26, r: 20, d: 120 },
  { x: 0, r: 22, d: 60 },
  { x: 26, r: 20, d: 180 },
  { x: 48, r: 15, d: 40 },
  { x: -64, r: 12, d: 220 },
  { x: 66, r: 12, d: 260 },
];

const t = (value: string): CSSProperties => ({ transform: value });

/** Illustrative launch scene. Decorative: all meaning is also given in text beside it. */
export function LaunchScene({
  design,
  scene,
  city,
  countdown,
}: {
  design: SatelliteDesign;
  scene: SceneState;
  city: string;
  countdown?: number;
}) {
  const fit = Math.min(0.42, 46 / stowedWidth(design), 66 / SATELLITE_HEIGHT);
  const rocketY = PAD_Y + scene.rocketY;
  // Satellite pose in the stack's local coordinates (x = 0 is the rocket axis).
  const local = (p: { x: number; y: number; scale: number }) => ({
    x: p.x - 200,
    y: p.y - rocketY,
    scale: p.scale,
  });
  const sat = scene.onTarget
    ? local(TARGET_POS)
    : scene.inOrbit
      ? local(ORBIT_POS)
      : scene.panelsOpen
        ? local(PANELS_POS)
        : scene.satelliteFree
          ? { x: 0, y: BAY_Y - SEP_LIFT, scale: fit }
          : scene.satelliteLoaded
            ? { x: 0, y: BAY_Y, scale: fit }
            : local({ x: 200, y: 58, scale: 0.6 });
  const inBay =
    scene.satellite === "enclosing" || scene.satellite === "inside-reveal";
  const beamX = scene.onTarget ? TARGET_POS.x : ORBIT_POS.x;
  const fairingState = scene.satelliteFree
    ? "gone"
    : scene.fairingSeparated
      ? "sep"
      : scene.fairingClosed
        ? "closed"
        : "open";
  return (
    <svg
      viewBox="0 0 400 440"
      className={styles.scene}
      aria-hidden="true"
      focusable="false"
      data-engines={scene.engines}
      data-ground={scene.groundGone ? "gone" : "here"}
    >
      <defs>
        <linearGradient id="launch-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f7fd0" />
          <stop offset="1" stopColor="#a8e2f5" />
        </linearGradient>
        <linearGradient id="launch-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#02040d" />
          <stop offset="1" stopColor="#0d1d44" />
        </linearGradient>
        <linearGradient id="launch-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c3c8f5" />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="1" stopColor="#b2b9e8" />
        </linearGradient>
        <linearGradient id="launch-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.3" stopColor="#ffd23f" />
          <stop offset="0.7" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#ff5c8a" stopOpacity="0" />
        </linearGradient>
        {/* Inside of the closed fairing, in the stack's coordinates */}
        <clipPath id="launch-bay" clipPathUnits="userSpaceOnUse">
          <rect x="-26" y="-900" width="52" height="696" />
        </clipPath>
        <radialGradient id="launch-limb" cx="50%" cy="50%" r="50%">
          <stop offset="0.9" stopColor="#8ed5dc" stopOpacity="0" />
          <stop offset="0.97" stopColor="#8ed5dc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8ed5dc" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky: day blue fades to black with altitude */}
      <rect width="400" height="440" fill="url(#launch-day)" />
      <rect
        width="400"
        height="440"
        fill="url(#launch-night)"
        className={styles.fade}
        style={{ opacity: scene.altitude }}
      />
      <g className={styles.fade} style={{ opacity: scene.altitude >= 1 ? 1 : scene.altitude * 0.4 }}>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e8f3ff" />
        ))}
      </g>

      {/* Earth and its atmosphere rise into view once in space */}
      <g
        className={styles.earth}
        style={{
          ...t(
            `translate(0px, ${scene.altitude >= 1 ? 0 : 180}px) rotate(${scene.onTarget ? 0 : 20}deg)`,
          ),
          transformOrigin: EARTH_CENTRE,
          opacity: scene.altitude >= 1 ? 1 : 0,
        }}
      >
        <circle cx="200" cy="830" r="492" fill="url(#launch-limb)" />
        <circle cx="200" cy="830" r="476" fill="#1f4fd1" stroke={INK} strokeWidth="4" />
        <path
          d="M 110 372 Q 150 352 196 360 Q 236 366 262 356 Q 300 346 330 372 Q 290 392 240 388 Q 180 396 110 372 Z"
          fill="#3fbf6f"
          opacity="0.85"
        />
        <path d="M 360 400 Q 400 380 440 404 Q 400 420 360 400 Z" fill="#3fbf6f" opacity="0.85" />
        <path d="M -20 420 Q 20 396 60 410 Q 30 428 -20 420 Z" fill="#3fbf6f" opacity="0.85" />
        {/* Target region marker; Earth turns to bring it under the satellite */}
        <g className={styles.target} data-on={scene.onTarget}>
          <circle cx="200" cy="358" r="13" fill="none" stroke="#ffd23f" strokeWidth="3" className={styles.ping} />
          <circle cx="200" cy="358" r="5" fill="#ffd23f" stroke={INK} strokeWidth="2" />
        </g>
      </g>

      {/* Orbit path */}
      <path
        d="M -30 330 Q 200 -86 430 330"
        fill="none"
        stroke="#8ed5dc"
        strokeWidth="2.5"
        strokeDasharray="7 7"
        className={`${styles.fade} ${styles.orbitPath}`}
        style={{ opacity: scene.inOrbit ? 0.85 : 0 }}
      />

      {/* Camera follows the rocket: clouds and the ground slide away below */}
      <g className={styles.clouds} style={t(`translate(0px, ${scene.groundGone ? 800 : 0}px)`)}>
        {clouds.map((c) => (
          <g key={c.x + ":" + c.y} fill="#ffffff" opacity="0.9">
            <ellipse cx={c.x} cy={c.y} rx={c.w / 2} ry={c.w / 6} />
            <ellipse cx={c.x - c.w / 6} cy={c.y - c.w / 8} rx={c.w / 4} ry={c.w / 6} />
            <ellipse cx={c.x + c.w / 7} cy={c.y - c.w / 7} rx={c.w / 5} ry={c.w / 6} />
          </g>
        ))}
      </g>
      <g className={styles.ground} style={t(`translate(0px, ${scene.groundGone ? 300 : 0}px)`)}>
        <path d="M 0 408 Q 90 392 170 404 L 230 404 Q 310 392 400 406 L 400 440 L 0 440 Z" fill="#3fbf6f" stroke={INK} strokeWidth="3" />
        <rect x="0" y="420" width="400" height="20" fill="#2b9a57" />
        {/* Launch tower with umbilical arms */}
        <g>
          <rect x="132" y="150" width="20" height="252" fill="none" stroke="#ff5c8a" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d={`M 132 ${150 + i * 21} L 152 ${171 + i * 21} M 152 ${150 + i * 21} L 132 ${171 + i * 21}`}
              stroke="#ff5c8a"
              strokeWidth="1.5"
            />
          ))}
          <g className={styles.arms} data-retracted={scene.engines !== "off"}>
            <rect x="152" y="220" width="34" height="5" fill="#ff5c8a" stroke={INK} strokeWidth="1.5" />
            <rect x="152" y="300" width="34" height="5" fill="#ff5c8a" stroke={INK} strokeWidth="1.5" />
          </g>
        </g>
        <rect x="158" y="396" width="84" height="10" rx="2" fill="#5d6aa8" stroke={INK} strokeWidth="2.5" />
        {/* Exhaust smoke billows from the flame trench */}
        <g className={styles.smoke}>
          {smoke.map((s) => (
            <circle
              key={s.x}
              cx={200 + s.x}
              cy={398}
              r={s.r}
              fill="#eef1ff"
              stroke="#c3c8f5"
              strokeWidth="2"
              style={{ animationDelay: `${s.d}ms` }}
            />
          ))}
        </g>
      </g>

      {/*
        One stack, one transform: the rocket body, the satellite and the fairing
        share this group, so the payload can never lag or lead the rocket.
      */}
      <g className={styles.rocket} style={t(`translate(200px, ${rocketY}px)`)}>
        <g className={styles.body} data-stage={scene.stage}>
          <g className={styles.flame}>
            <path d="M -12 6 C -11 34 -4 58 0 86 C 4 58 11 34 12 6 Z" fill="url(#launch-flame)" />
            <path d="M -6 6 C -5 22 -2 34 0 46 C 2 34 5 22 6 6 Z" fill="#fffbe0" />
          </g>
          <path d="M -11 7 L 11 7 L 7 -4 L -7 -4 Z" fill="#5d6aa8" stroke={INK} strokeWidth="2.5" />
          <path d="M -16 -44 L -32 -2 L -16 -10 Z M 16 -44 L 32 -2 L 16 -10 Z" fill="#ff5c8a" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="-16" y="-152" width="32" height="148" rx="4" fill="url(#launch-body)" stroke={INK} strokeWidth="3" />
          <rect x="-16" y="-120" width="32" height="9" fill="#ffd23f" />
          <text x="0" y="-60" fontSize="9" fontWeight="800" fill={INK} textAnchor="middle" transform="rotate(-90 0 -60)" letterSpacing="1.5">
            CODE BLUE
          </text>
          <rect x="-16" y="-164" width="32" height="12" fill="#5d6aa8" stroke={INK} strokeWidth="2.5" />
          <rect x="-16" y="-202" width="32" height="38" rx="2" fill="url(#launch-body)" stroke={INK} strokeWidth="3" />
          {/* Payload adapter the satellite is bolted to until separation */}
          <path d="M -12 -202 L -8 -208 L 8 -208 L 12 -202 Z" fill="#5d6aa8" stroke={INK} strokeWidth="2" />
        </g>

        {/* The player's satellite. Not drawn at all while sealed in the fairing. */}
        {scene.satellite !== "hidden" && (
          <g clipPath={inBay ? "url(#launch-bay)" : undefined}>
            <g
              className={styles.satellite}
              data-vis={scene.satellite}
              style={t(`translate(${sat.x}px, ${sat.y}px) scale(${sat.scale})`)}
            >
              <g className={scene.inOrbit ? styles.drift : undefined}>
                <LaunchSatellite
                  design={design}
                  panelsOpen={scene.panelsOpen}
                  cable={scene.satellite === "crane" || scene.satellite === "integrating"}
                />
              </g>
            </g>
          </g>
        )}

        {/* Payload fairing: opens on the pad, closes for launch, splits in space */}
        <path
          className={styles.fairingL}
          data-state={fairingState}
          d="M 0 -292 C -16 -286 -27 -266 -27 -246 L -27 -212 L -16 -202 L 0 -202 Z"
          fill="url(#launch-body)"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          className={styles.fairingR}
          data-state={fairingState}
          d="M 0 -292 C 16 -286 27 -266 27 -246 L 27 -212 L 16 -202 L 0 -202 Z"
          fill="url(#launch-body)"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>

      {/* Downlook beam toward the target region */}
      <polygon
        points={`${beamX - 10},170 ${beamX + 10},170 236,354 164,354`}
        fill="#ffd23f"
        className={`${styles.fade} ${styles.beam}`}
        style={{ opacity: scene.onTarget ? 0.28 : 0 }}
      />
      <g className={styles.fade} style={{ opacity: scene.onTarget ? 1 : 0 }}>
        <rect x="140" y="384" width="120" height="24" rx="12" fill={INK} stroke="#ffd23f" strokeWidth="2" />
        <text x="200" y="400" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffd23f" letterSpacing="1">
          {city.toUpperCase().slice(0, 16)}
        </text>
      </g>

      {countdown ? (
        <text key={countdown} x="320" y="96" textAnchor="middle" className={styles.countdown}>
          {countdown}
        </text>
      ) : null}
    </svg>
  );
}
