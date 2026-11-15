import type { ComponentType } from "react";
import type { Category } from "@/types/game";
import { hazardCopy } from "./hazard-copy";
import styles from "./designer.module.css";

function Skyline() {
  const buildings = [
    [222, 30], [236, 46], [252, 24], [266, 58], [284, 38], [298, 50], [312, 28], [326, 42],
  ];
  return (
    <g>
      {buildings.map(([x, height]) => (
        <rect key={x} x={x} y={150 - height} width={12} height={height} className="fill-muted stroke-border" strokeWidth={1} />
      ))}
      {buildings.map(([x, height]) => (
        <rect key={`w${x}`} x={x + 4} y={150 - height + 6} width={4} height={4} fill="#fde68a" opacity={0.8} />
      ))}
      <text x={276} y={168} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={700}>Homes</text>
    </g>
  );
}

function Satellite() {
  return (
    <g>
      <rect x={160} y={14} width={18} height={12} rx={2} className="fill-muted stroke-primary" strokeWidth={1.5} />
      <rect x={140} y={16} width={16} height={8} fill="#1e3a8a" className="stroke-primary" strokeWidth={1} />
      <rect x={182} y={16} width={16} height={8} fill="#1e3a8a" className="stroke-primary" strokeWidth={1} />
      <line x1={169} y1={28} x2={110} y2={92} className="stroke-primary" strokeDasharray="4 4" strokeWidth={1.5} />
      <text x={204} y={24} className="fill-primary" fontSize={10}>Your satellite?</text>
    </g>
  );
}

function Fire() {
  return (
    <g>
      <path d="M 0 150 Q 60 110 120 130 L 200 150 Z" className="fill-muted" />
      {[40, 70, 100].map((x, index) => (
        <path key={x} className={styles.flicker} d={`M ${x - 12} 146 Q ${x - 14} 120 ${x} ${104 - index * 6} Q ${x + 14} 122 ${x + 12} 146 Z`} fill="#f97316" />
      ))}
      {[40, 70, 100].map((x) => (
        <path key={`c${x}`} d={`M ${x - 6} 146 Q ${x - 6} 132 ${x} 122 Q ${x + 6} 132 ${x + 6} 146 Z`} fill="#fde047" />
      ))}
      {[[50, 70, 26], [90, 60, 32], [130, 76, 24]].map(([cx, cy, r]) => (
        <circle key={cx} cx={cx} cy={cy} r={r} fill="#64748b" opacity={0.8} />
      ))}
      <text x={86} y={66} textAnchor="middle" fill="#f8fafc" fontSize={10} fontWeight={700}>SMOKE</text>
      <path d="M 140 134 L 196 134" stroke="#f97316" strokeWidth={3} markerEnd="url(#hazard-arrow)" />
      <text x={168} y={126} textAnchor="middle" fill="#fdba74" fontSize={9}>wind</text>
    </g>
  );
}

function Flood() {
  return (
    <g>
      {[[60, 46, 30], [110, 40, 34], [160, 50, 28]].map(([cx, cy, r]) => (
        <circle key={cx} cx={cx} cy={cy} r={r} fill="#64748b" opacity={0.85} />
      ))}
      <text x={110} y={46} textAnchor="middle" fill="#f8fafc" fontSize={10} fontWeight={700}>STORM CLOUDS</text>
      {[50, 80, 110, 140, 170].map((x) => (
        <line key={x} x1={x} y1={80} x2={x - 8} y2={100} stroke="#93c5fd" strokeWidth={2} />
      ))}
      <path className={styles.pulse} d="M 0 136 Q 30 128 60 136 T 120 136 T 180 136 T 240 136 T 300 136 T 360 136 L 360 160 L 0 160 Z" fill="#3b82f6" opacity={0.75} />
      <text x={70} y={154} textAnchor="middle" fill="#eff6ff" fontSize={10} fontWeight={700}>FLOOD WATER</text>
    </g>
  );
}

function Heat() {
  return (
    <g>
      <circle cx={70} cy={70} r={30} fill="#facc15" className={styles.pulse} />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4;
        return (
          <line key={index} x1={70 + Math.cos(angle) * 38} y1={70 + Math.sin(angle) * 38}
            x2={70 + Math.cos(angle) * 50} y2={70 + Math.sin(angle) * 50} stroke="#facc15" strokeWidth={3} />
        );
      })}
      {[130, 160, 190].map((x) => (
        <path key={x} d={`M ${x} 140 q 6 -10 0 -20 q -6 -10 0 -20`} fill="none" stroke="#f87171" strokeWidth={2.5} />
      ))}
      <text x={160} y={156} textAnchor="middle" fill="#fca5a5" fontSize={10} fontWeight={700}>HEAT</text>
    </g>
  );
}

function Snow() {
  return (
    <g>
      <polygon points="0,150 46,82 82,124 120,70 176,150" fill="#334155" />
      <polygon points="46,82 34,100 44,96 52,104 58,96" fill="#f1f5f9" />
      <polygon points="120,70 104,94 116,88 124,98 134,90" fill="#f1f5f9" />
      <path d="M 0 150 Q 50 138 100 146 T 200 146 L 200 150 Z" fill="#e2e8f0" />
      <g className={styles.drift}>
        {[[20, 40], [60, 28], [96, 48], [140, 36], [180, 58], [36, 70], [150, 80], [196, 96]].map(([x, y]) => (
          <g key={`${x}-${y}`} stroke="#f8fafc" strokeWidth={1.5} strokeLinecap="round">
            <line x1={x - 4} y1={y} x2={x + 4} y2={y} />
            <line x1={x - 2} y1={y - 3.5} x2={x + 2} y2={y + 3.5} />
            <line x1={x + 2} y1={y - 3.5} x2={x - 2} y2={y + 3.5} />
          </g>
        ))}
      </g>
      <text x={86} y={140} textAnchor="middle" fill="#0f172a" fontSize={10} fontWeight={700}>SNOW COVER</text>
    </g>
  );
}

function Drought() {
  return (
    <g>
      <circle cx={52} cy={52} r={24} fill="#f59e0b" className={styles.pulse} />
      <polygon points="0,150 0,124 200,118 200,150" fill="#92400e" />
      <path d="M 20 126 L 34 136 L 28 148 M 34 136 L 52 132 M 80 122 L 92 134 L 86 148 M 92 134 L 112 138 M 140 120 L 150 132 L 168 128 M 150 132 L 146 148"
        fill="none" stroke="#451a03" strokeWidth={2} strokeLinecap="round" />
      <path d="M 120 120 L 120 98 M 120 104 Q 108 100 104 108 M 120 100 Q 132 94 136 104" fill="none" stroke="#a16207" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M 160 118 Q 172 112 184 118" fill="none" stroke="#38bdf8" strokeWidth={2} strokeDasharray="3 3" opacity={0.6} />
      <text x={100} y={146} textAnchor="middle" fill="#fde68a" fontSize={10} fontWeight={700}>DRY GROUND</text>
    </g>
  );
}

function Storm() {
  return (
    <g>
      <g className={styles.spin} style={{ transformOrigin: "90px 78px" }}>
        <path d="M 90 78 m -6 0 a 6 6 0 1 1 12 0 M 90 78 q 30 -42 70 -10 M 90 78 q -30 42 -70 10 M 90 78 q 42 30 10 64 M 90 78 q -42 -30 -10 -64"
          fill="none" stroke="#cbd5e1" strokeWidth={10} strokeLinecap="round" opacity={0.75} />
      </g>
      <circle cx={90} cy={78} r={6} fill="#0d1b2e" />
      <polygon points="168,62 156,92 166,92 158,118 182,84 170,84 178,62" fill="#fde047" />
      {[130, 146, 190, 206].map((x) => (
        <line key={x} x1={x} y1={100} x2={x - 8} y2={124} stroke="#93c5fd" strokeWidth={2} />
      ))}
      <text x={90} y={146} textAnchor="middle" fill="#e2e8f0" fontSize={10} fontWeight={700}>STORM</text>
    </g>
  );
}

function Glacier() {
  return (
    <g>
      <polygon points="0,40 0,150 40,150 70,120 110,128 150,112 170,150 200,150 200,90 140,70 80,50" fill="#cffafe" />
      <path d="M 30 70 L 46 100 M 80 72 L 92 104 M 130 88 L 136 110" fill="none" stroke="#67e8f9" strokeWidth={2} />
      <path d="M 0 150 L 200 150 L 200 140 Q 150 134 100 140 T 0 140 Z" fill="#1d4ed8" opacity={0.8} />
      <g className={styles.drift}>
        <polygon points="176,138 186,126 196,138" fill="#e0f2fe" />
        <polygon points="150,140 156,132 164,140" fill="#e0f2fe" />
      </g>
      <text x={74} y={96} textAnchor="middle" fill="#0e7490" fontSize={10} fontWeight={700}>MELTING ICE</text>
    </g>
  );
}

function Volcano() {
  return (
    <g>
      {[[96, 52, 18], [80, 34, 22], [112, 26, 20], [96, 12, 16]].map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#475569" opacity={0.85} className={styles.drift} />
      ))}
      <text x={96} y={36} textAnchor="middle" fill="#f8fafc" fontSize={10} fontWeight={700}>ASH</text>
      <polygon points="20,150 82,72 110,72 176,150" fill="#44403c" />
      <path className={styles.flicker} d="M 86 72 Q 82 100 64 120 Q 58 136 52 150 L 62 150 Q 74 124 92 100 Z" fill="#f97316" />
      <path className={styles.flicker} d="M 104 72 Q 112 104 132 128 L 140 150 L 148 150 Q 136 118 110 72 Z" fill="#ef4444" />
      <ellipse cx={96} cy={72} rx={14} ry={4} fill="#fb923c" />
      <text x={150} y={110} fill="#fdba74" fontSize={10} fontWeight={700}>LAVA</text>
    </g>
  );
}

const scenes: Record<Category, ComponentType> = {
  wildfire: Fire,
  flood: Flood,
  heat: Heat,
  snow: Snow,
  drought: Drought,
  storm: Storm,
  glacier: Glacier,
  volcano: Volcano,
};

/** Stylised illustration of the hazard threatening the city. Decorative; the story text carries the meaning. */
export function HazardScene({ category, city }: { category: Category; city: string }) {
  const Scene = scenes[category];
  return (
    <svg viewBox="0 0 360 175" className="h-auto w-full rounded-xl border border-border bg-[#0d1b2e]" role="img"
      aria-label={`Illustration: ${hazardCopy[category].label} threatening homes in ${city}, with a satellite overhead.`}>
      <defs>
        <marker id="hazard-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#f97316" />
        </marker>
      </defs>
      {Scene && <Scene />}
      <Skyline />
      <Satellite />
      <line x1={0} y1={150} x2={360} y2={150} className="stroke-border" strokeWidth={1} />
    </svg>
  );
}
