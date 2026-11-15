import styles from "./mission.module.css";

/**
 * Lightweight orbit schematic driven by the same daily observation-window
 * model used by the simulation playback. It is intentionally explanatory,
 * not a claim of precise orbital geometry.
 */
export function MissionOrbit({
  city,
  windowHours,
  hour,
  span,
  stations,
  transmitting,
  geo,
  animate,
}: {
  city: string;
  windowHours: number;
  hour: number;
  span: number;
  stations: 1 | 3 | 5;
  transmitting: boolean;
  geo: boolean;
  animate: boolean;
}) {
  const into = hour % 24;
  const inWindow = windowHours > 0 && into < windowHours && hour < span;
  let angle = 0;
  if (!geo) {
    angle = inWindow
      ? -20 + (into / windowHours) * 40
      : 20 + ((into - windowHours) / Math.max(0.1, 24 - windowHours)) * 320;
  }
  const rad = ((angle - 90) * Math.PI) / 180;
  const sx = 80 + Math.cos(rad) * 62;
  const sy = 80 + Math.sin(rad) * 62;
  const stationAngles = {
    1: [180],
    3: [120, 180, 240],
    5: [100, 140, 180, 220, 260],
  }[stations];
  const stationPts = stationAngles.map((a) => {
    const r = ((a - 90) * Math.PI) / 180;
    return [80 + Math.cos(r) * 40, 80 + Math.sin(r) * 40] as const;
  });
  const nearest = stationPts.reduce(
    (best, point) => {
      const distance = Math.hypot(point[0] - sx, point[1] - sy);
      return distance < best.distance ? { point, distance } : best;
    },
    { point: stationPts[0], distance: Infinity },
  );

  const status = inWindow
    ? `Satellite is over ${city} inside its modeled observation window.`
    : transmitting
      ? "Satellite is outside the observation window and has data waiting for ground contact."
      : "Satellite is outside the observation window.";

  return (
    <svg
      viewBox="0 0 160 160"
      className={styles.orbitGraphic}
      role="img"
      aria-label={status}
    >
      <defs>
        <radialGradient id="earth-glow" cx="45%" cy="38%">
          <stop offset="0" stopColor="#4c9ae8" />
          <stop offset="0.72" stopColor="#1f5fbf" />
          <stop offset="1" stopColor="#0a2b67" />
        </radialGradient>
      </defs>
      <circle
        cx="80"
        cy="80"
        r="62"
        fill="none"
        stroke="var(--space-700)"
        strokeWidth="2"
        strokeDasharray="4 5"
      />
      <path
        d="M 58.8 21.7 A 62 62 0 0 1 101.2 21.7"
        fill="none"
        stroke="var(--pop-cyan)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity={inWindow ? 1 : 0.35}
      />
      <circle
        cx="80"
        cy="80"
        r="40"
        fill="url(#earth-glow)"
        stroke="#070a24"
        strokeWidth="3"
      />
      <path
        d="M58 70 q10 -14 24 -6 q8 6 18 -2 q4 12 -6 18 q-10 6 -20 0 q-12 -2 -16 -10 z"
        fill="#3fbf7a"
        opacity="0.9"
      />
      <circle
        cx="80"
        cy="40"
        r="5"
        fill="var(--pop-yellow)"
        stroke="#070a24"
        strokeWidth="2"
      />
      {stationPts.map(([x, y], index) => (
        <g key={index} transform={`translate(${x} ${y})`}>
          <path
            d="M-5 2 Q0 -6 5 2 Z"
            fill="#e8ecff"
            stroke="#070a24"
            strokeWidth="1.5"
          />
        </g>
      ))}
      {transmitting && nearest.distance < 70 && (
        <line
          x1={sx}
          y1={sy}
          x2={nearest.point[0]}
          y2={nearest.point[1]}
          stroke="var(--pop-lime)"
          strokeWidth="2.5"
          strokeDasharray="5 3"
          className={animate ? styles.beam : undefined}
        />
      )}
      {inWindow && (
        <polygon
          points={`${sx},${sy} ${80 - 9},44 ${80 + 9},44`}
          fill="var(--pop-cyan)"
          opacity="0.35"
        />
      )}
      <g transform={`translate(${sx} ${sy}) rotate(${angle})`}>
        <rect
          x="-14"
          y="-3"
          width="9"
          height="6"
          fill="var(--pop-cyan)"
          stroke="#070a24"
          strokeWidth="1.2"
        />
        <rect
          x="5"
          y="-3"
          width="9"
          height="6"
          fill="var(--pop-cyan)"
          stroke="#070a24"
          strokeWidth="1.2"
        />
        <rect
          x="-5"
          y="-5"
          width="10"
          height="10"
          rx="2"
          fill="#e8ecff"
          stroke="#070a24"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}
