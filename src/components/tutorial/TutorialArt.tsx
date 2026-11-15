// Original SVG scenes for the How-to-Play tutorial. Each scene's resting
// (un-animated) state is the finished picture, so reduced motion shows a
// complete static illustration. Purely decorative: the text says it all.
import styles from "./tutorial.module.css";

export type SceneId = "intro" | "choose" | "build" | "plan" | "launch" | "learn";

const c = {
  deep: "#07121b",
  navy: "#0d1a25",
  ink: "#182c3b",
  steel: "#294253",
  card: "#1a2266",
  cyan: "#8ed5dc",
  lime: "#cbf36b",
  gold: "#ffd23f",
  pink: "#ff5c8a",
  orange: "#ff8a3d",
  white: "#f6f7ff",
};

const stars: [number, number, number][] = [
  [24, 22, 1.4], [62, 48, 1], [104, 18, 1.2], [168, 30, 0.9], [214, 14, 1.3],
  [262, 40, 1], [296, 20, 1.2], [282, 92, 0.9], [36, 96, 1], [300, 150, 1.1],
  [14, 160, 0.9], [240, 196, 1],
];

function Stars() {
  return (
    <g>
      {stars.map(([x, y, r], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          fill={c.white}
          className={styles.twinkle}
          style={{ animationDelay: `${(i % 5) * 0.45}s` }}
        />
      ))}
    </g>
  );
}

/** A small satellite drawn around (0,0); reused across scenes. */
function Satellite({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <rect x="-34" y="-7" width="22" height="14" rx="2" fill={c.cyan} stroke={c.deep} strokeWidth="2" />
      <rect x="12" y="-7" width="22" height="14" rx="2" fill={c.cyan} stroke={c.deep} strokeWidth="2" />
      <path d="M-27 -7v14M-20 -7v14M19 -7v14M26 -7v14" stroke={c.deep} strokeWidth="1.2" />
      <rect x="-11" y="-11" width="22" height="22" rx="4" fill={c.gold} stroke={c.deep} strokeWidth="2.5" />
      <circle cx="0" cy="0" r="4" fill={c.deep} />
    </g>
  );
}

function Intro() {
  return (
    <>
      <Stars />
      <circle cx="160" cy="128" r="62" fill={c.ink} />
      <circle cx="160" cy="128" r="54" fill="#1f5d8c" />
      <path d="M118 108c14-10 28-6 36 4s-4 20 8 26 26-4 30 8-16 22-34 18-46-20-40-56z" fill="#3fa36b" />
      <path d="M170 82c12 2 24 10 26 20-10 0-18-6-26-6z" fill="#3fa36b" />
      <ellipse cx="160" cy="128" rx="104" ry="30" fill="none" stroke={c.lime} strokeWidth="2" strokeDasharray="4 7" transform="rotate(-14 160 128)" />
      <g transform="rotate(-14 160 128)">
        <g className={styles.orbitIntro}>
          <g transform="translate(264 128) rotate(14)">
            <Satellite scale={0.8} />
          </g>
        </g>
      </g>
    </>
  );
}

const pins: [number, number, string][] = [
  [86, 92, c.orange],
  [200, 70, c.cyan],
  [236, 130, c.pink],
];

function Choose() {
  return (
    <>
      <rect x="20" y="28" width="280" height="160" rx="16" fill="#0f2a3d" stroke={c.steel} strokeWidth="2" />
      <path d="M20 80h280M20 136h280M96 28v160M172 28v160M248 28v160" stroke={c.steel} strokeWidth="1" opacity="0.6" />
      <path d="M44 70c18-16 52-14 64 2s-6 26 8 34 8 30-14 30-30-14-44-24-28-26-14-42z" fill="#2f7f57" />
      <path d="M168 52c26-8 62-4 78 10s4 22-14 24-18 16-6 28 6 30-18 28-30-26-36-44 -16-40-4-46z" fill="#2f7f57" />
      <path d="M248 150c10-6 26-4 30 6s-8 16-20 14-16-14-10-20z" fill="#2f7f57" />
      {pins.map(([x, y, color], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="16" fill="none" stroke={color} strokeWidth="2.5" className={styles.pulse} style={{ animationDelay: `${i * 0.6}s` }} />
          <path d="M0 8c-7-8-10-12-10-17a10 10 0 0 1 20 0c0 5-3 9-10 17z" fill={color} stroke={c.deep} strokeWidth="2" />
          <circle cy="-9" r="3.5" fill={c.deep} />
        </g>
      ))}
      <g className={styles.pickCard}>
        <rect x="150" y="146" width="112" height="30" rx="10" fill={c.gold} stroke={c.deep} strokeWidth="2.5" />
        <text x="206" y="166" textAnchor="middle" fontSize="13" fontWeight="800" fill={c.deep}>Help needed!</text>
      </g>
    </>
  );
}

function Build() {
  return (
    <>
      <Stars />
      <rect x="40" y="168" width="240" height="14" rx="7" fill={c.steel} />
      <g transform="translate(160 104)">
        <g className={styles.snapLeft}>
          <rect x="-104" y="-16" width="62" height="32" rx="4" fill={c.cyan} stroke={c.deep} strokeWidth="2.5" />
          <path d="M-88 -16v32M-73 -16v32M-58 -16v32" stroke={c.deep} strokeWidth="1.6" />
          <rect x="-42" y="-3" width="10" height="6" fill={c.steel} />
        </g>
        <g className={styles.snapRight}>
          <rect x="42" y="-16" width="62" height="32" rx="4" fill={c.cyan} stroke={c.deep} strokeWidth="2.5" />
          <path d="M58 -16v32M73 -16v32M88 -16v32" stroke={c.deep} strokeWidth="1.6" />
          <rect x="32" y="-3" width="10" height="6" fill={c.steel} />
        </g>
        <g className={styles.snapTop}>
          <path d="M0 -34v-18" stroke={c.white} strokeWidth="3" strokeLinecap="round" />
          <circle cy="-56" r="6" fill={c.pink} stroke={c.deep} strokeWidth="2" />
        </g>
        <g className={styles.snapBottom}>
          <rect x="-12" y="32" width="24" height="16" rx="3" fill={c.lime} stroke={c.deep} strokeWidth="2.5" />
          <circle cy="52" r="5" fill={c.deep} stroke={c.lime} strokeWidth="2" />
        </g>
        <rect x="-32" y="-34" width="64" height="68" rx="10" fill={c.gold} stroke={c.deep} strokeWidth="3" />
        <rect x="-20" y="-20" width="40" height="22" rx="5" fill={c.deep} />
        <circle cx="-8" cy="-9" r="3" fill={c.cyan} />
        <circle cx="8" cy="-9" r="3" fill={c.cyan} />
        <path d="M-16 16h32" stroke={c.deep} strokeWidth="3" strokeLinecap="round" />
        <circle r="44" fill="none" stroke={c.lime} strokeWidth="3" className={styles.snapFlash} />
      </g>
    </>
  );
}

const bars: [string, string, number][] = [
  ["BUDGET", c.gold, 0.72],
  ["POWER", c.lime, 0.58],
  ["MASS", c.cyan, 0.84],
];

function Plan() {
  return (
    <>
      <Stars />
      <circle cx="100" cy="112" r="34" fill="#1f5d8c" stroke={c.deep} strokeWidth="2" />
      <path d="M78 100c10-8 22-4 26 4s-2 14 6 18-6 14-18 10-20-20-14-32z" fill="#3fa36b" />
      <g transform="translate(100 112) rotate(-18) scale(1 0.42)">
        <circle r="74" fill="none" stroke={c.lime} strokeWidth="4.5" strokeDasharray="6 9" />
        <g className={styles.spin}>
          <circle cx="74" r="11" fill={c.gold} stroke={c.deep} strokeWidth="4" />
        </g>
      </g>
      {bars.map(([label, color, value], i) => (
        <g key={label} transform={`translate(196 ${68 + i * 40})`}>
          <text y="-6" fontSize="11" fontWeight="800" letterSpacing="1.2" fill={c.white}>{label}</text>
          <rect width="100" height="14" rx="7" fill={c.ink} stroke={c.steel} strokeWidth="1.5" />
          <rect
            width={100 * value}
            height="14"
            rx="7"
            fill={color}
            className={styles.grow}
            style={{ animationDelay: `${i * 0.35}s` }}
          />
          <path d="M80 -2v18" stroke={c.white} strokeWidth="2" strokeDasharray="2 2" opacity="0.7" />
        </g>
      ))}
    </>
  );
}

function Launch() {
  return (
    <>
      <Stars />
      <path d="M0 196c40-16 80-18 120-8s90 10 120-2 60-8 80 2v32H0z" fill={c.ink} />
      <rect x="138" y="184" width="44" height="8" rx="2" fill={c.steel} />
      <g className={styles.smoke}>
        <circle cx="140" cy="188" r="12" fill={c.steel} opacity="0.8" />
        <circle cx="180" cy="188" r="14" fill={c.steel} opacity="0.8" />
        <circle cx="160" cy="194" r="12" fill={c.steel} opacity="0.7" />
      </g>
      <g className={styles.rocket}>
        <g className={styles.flame}>
          <path d="M152 170c0 14 8 24 8 24s8-10 8-24z" fill={c.orange} />
          <path d="M156 170c0 9 4 15 4 15s4-6 4-15z" fill={c.gold} />
        </g>
        <path d="M160 70c14 14 20 34 20 60v40h-40v-40c0-26 6-46 20-60z" fill={c.white} stroke={c.deep} strokeWidth="3" />
        <path d="M160 70c8 8 13 18 16 30h-32c3-12 8-22 16-30z" fill={c.pink} stroke={c.deep} strokeWidth="3" />
        <circle cx="160" cy="124" r="9" fill={c.cyan} stroke={c.deep} strokeWidth="3" />
        <path d="M140 146l-14 24h14zM180 146l14 24h-14z" fill={c.gold} stroke={c.deep} strokeWidth="3" strokeLinejoin="round" />
      </g>
    </>
  );
}

const axes = 5;
const point = (i: number, r: number) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
};
const ring = (r: number) => Array.from({ length: axes }, (_, i) => point(i, r)).join(" ");
const shape = [0.9, 0.7, 0.85, 0.6, 0.78];

function Learn() {
  return (
    <>
      <Stars />
      <g transform="translate(116 114)">
        {[24, 48, 72].map((r) => (
          <polygon key={r} points={ring(r)} fill="none" stroke={c.steel} strokeWidth="1.5" />
        ))}
        {Array.from({ length: axes }, (_, i) => (
          <line key={i} x1="0" y1="0" x2={point(i, 72).split(",")[0]} y2={point(i, 72).split(",")[1]} stroke={c.steel} strokeWidth="1" />
        ))}
        <polygon points={shape.map((v, i) => point(i, 72 * v * 0.55)).join(" ")} fill={c.pink} opacity="0.35" />
        <polygon
          points={shape.map((v, i) => point(i, 72 * v)).join(" ")}
          fill="rgba(203,243,107,0.35)"
          stroke={c.lime}
          strokeWidth="3"
          strokeLinejoin="round"
          className={styles.radarGrow}
        />
      </g>
      <g transform="translate(212 70)">
        <rect width="88" height="96" rx="14" fill={c.card} stroke={c.gold} strokeWidth="2.5" />
        <text x="44" y="26" textAnchor="middle" fontSize="11" fontWeight="800" letterSpacing="1.2" fill={c.cyan}>SCORE</text>
        {[18, 44, 70].map((x, i) => (
          <path
            key={x}
            d={`M${x} 40l4.7 9.5 10.5 1.5-7.6 7.4 1.8 10.4-9.4-4.9-9.4 4.9 1.8-10.4-7.6-7.4 10.5-1.5z`}
            fill={i < 2 ? c.gold : c.steel}
            stroke={c.deep}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ))}
        <path
          d="M70 40l4.7 9.5 10.5 1.5-7.6 7.4 1.8 10.4-9.4-4.9-9.4 4.9 1.8-10.4-7.6-7.4 10.5-1.5z"
          fill={c.gold}
          stroke={c.deep}
          strokeWidth="1.5"
          strokeLinejoin="round"
          className={styles.starEarn}
        />
        <g className={styles.scoreUp}>
          <text x="44" y="88" textAnchor="middle" fontSize="12" fontWeight="900" letterSpacing="1" fill={c.lime}>▲ BETTER</text>
        </g>
      </g>
    </>
  );
}

const scenes: Record<SceneId, () => React.ReactElement> = {
  intro: Intro,
  choose: Choose,
  build: Build,
  plan: Plan,
  launch: Launch,
  learn: Learn,
};

export function TutorialArt({ scene, still }: { scene: SceneId; still: boolean }) {
  const Scene = scenes[scene];
  return (
    <svg
      viewBox="0 0 320 220"
      className={styles.art}
      data-still={still ? "true" : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <Scene />
    </svg>
  );
}
