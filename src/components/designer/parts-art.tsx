// Sticker-style SVG art for satellite parts, shared by the live satellite and the
// part cards. Every shape is drawn around (0, 0) so callers can place it freely.
import type { InstrumentKind } from "@/types/game";

export const INK = "#06123a";

export const kindColor: Record<InstrumentKind, string> = {
  optical: "#2de2e6",
  multispectral: "#a98bff",
  thermal: "#ff8a3d",
  microwave: "#8bf05a",
  radar: "#ffd23f",
  lidar: "#ff5c8a",
  gravimetry: "#a98bff",
};

/** A sensor hanging below the bus: its top edge is at y = 0. */
export function SensorArt({ id, kind }: { id: string; kind: InstrumentKind }) {
  const color = kindColor[kind];
  const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const };
  switch (kind) {
    case "optical":
      return (
        <g>
          <rect x={-12} y={0} width={24} height={16} rx={3} fill="#e8ecff" {...stroke} />
          <circle cx={0} cy={20} r={10} fill={INK} />
          <circle cx={0} cy={20} r={6} fill={color} />
          <circle cx={-2} cy={18} r={2} fill="#fff" />
        </g>
      );
    case "multispectral":
      return (
        <g>
          <rect x={-15} y={0} width={30} height={24} rx={4} fill={color} {...stroke} />
          {["#2de2e6", "#8bf05a", "#ff5c8a"].map((band, index) => (
            <rect key={band} x={-10 + index * 7} y={6} width={5} height={13} rx={1.5} fill={band} stroke={INK} strokeWidth={1.5} />
          ))}
        </g>
      );
    case "thermal":
      return (
        <g>
          <polygon points="0,-1 14,7 14,23 0,31 -14,23 -14,7" fill={color} {...stroke} />
          <circle cx={0} cy={15} r={6} fill="#ffd23f" stroke={INK} strokeWidth={2} />
        </g>
      );
    case "microwave":
      return (
        <g>
          <rect x={-5} y={0} width={10} height={9} fill="#e8ecff" {...stroke} />
          <polygon points="-6,9 6,9 18,28 -18,28" fill={color} {...stroke} />
        </g>
      );
    case "radar":
      return id === "pr" ? (
        <g>
          <rect x={-4} y={0} width={8} height={9} fill="#e8ecff" {...stroke} />
          <rect x={-22} y={9} width={44} height={11} rx={3} fill={color} {...stroke} />
          <path d="M 0 23 Q -6 31 0 35 Q 6 31 0 23 Z" fill="#2de2e6" stroke={INK} strokeWidth={2} />
        </g>
      ) : (
        <g>
          <rect x={-4} y={0} width={8} height={9} fill="#e8ecff" {...stroke} />
          <rect x={-32} y={9} width={64} height={12} rx={3} fill={color} {...stroke} />
          {[-20, -10, 0, 10, 20].map((offset) => (
            <line key={offset} x1={offset} y1={11} x2={offset} y2={19} stroke={INK} strokeWidth={1.5} />
          ))}
        </g>
      );
    case "lidar":
      return (
        <g>
          <rect x={-8} y={0} width={16} height={28} rx={8} fill={color} {...stroke} />
          <circle cx={0} cy={22} r={3.5} fill="#8bf05a" stroke={INK} strokeWidth={1.5} />
        </g>
      );
    case "gravimetry":
      return (
        <g>
          <circle cx={0} cy={15} r={14} fill={color} {...stroke} />
          <ellipse cx={0} cy={15} rx={22} ry={6} fill="none" stroke={INK} strokeWidth={2.5} />
          <circle cx={-4} cy={10} r={3} fill="#fff" opacity={0.8} />
        </g>
      );
  }
}

/** Radio antenna standing on the bus: its base is at y = 0. */
export function AntennaArt({ id }: { id: string }) {
  if (id === "uhf") {
    return (
      <g>
        <line x1={0} y1={0} x2={0} y2={-38} stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <line x1={0} y1={0} x2={0} y2={-38} stroke="#ffd23f" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={0} cy={-40} r={5} fill="#ff5c8a" stroke={INK} strokeWidth={2.5} />
      </g>
    );
  }
  const radius = id === "ka_band" ? 24 : id === "x_band" ? 19 : 13;
  const base = -10;
  return (
    <g>
      <rect x={-4} y={base} width={8} height={10} fill="#e8ecff" stroke={INK} strokeWidth={2.5} />
      <path d={`M ${-radius} ${base - radius * 0.6} Q 0 ${base + radius * 0.45} ${radius} ${base - radius * 0.6} Z`}
        fill="#e8ecff" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <line x1={0} y1={base - 2} x2={0} y2={base - radius * 0.85} stroke={INK} strokeWidth={2.5} />
      <circle cx={0} cy={base - radius * 0.85} r={3.5} fill="#ff5c8a" stroke={INK} strokeWidth={2} />
    </g>
  );
}

/** One solar wing growing away from x = 0 in the given direction. */
export function SolarWingArt({ side, span, height = 46 }: { side: -1 | 1; span: number; height?: number }) {
  const start = side === -1 ? -span - 8 : 8;
  const cells = Math.max(2, Math.round(span / 16));
  return (
    <g>
      <line x1={0} y1={0} x2={side * 10} y2={0} stroke={INK} strokeWidth={4} />
      <rect x={start} y={-height / 2} width={span} height={height} rx={4} fill="#2b3fd6" stroke={INK} strokeWidth={3} />
      {Array.from({ length: cells - 1 }, (_, index) => (
        <line key={index} x1={start + ((index + 1) * span) / cells} y1={-height / 2 + 3} x2={start + ((index + 1) * span) / cells}
          y2={height / 2 - 3} stroke="#2de2e6" strokeOpacity={0.7} strokeWidth={1.5} />
      ))}
      <line x1={start + 3} y1={0} x2={start + span - 3} y2={0} stroke="#2de2e6" strokeOpacity={0.7} strokeWidth={1.5} />
      <rect x={start + 4} y={-height / 2 + 4} width={Math.min(14, span / 4)} height={5} rx={2} fill="#fff" opacity={0.35} />
    </g>
  );
}

/** Battery pack; `level` is 0..1. Centred on (0, 0). */
export function BatteryArt({ level }: { level: number }) {
  return (
    <g>
      <rect x={-16} y={-9} width={30} height={18} rx={3} fill="#e8ecff" stroke={INK} strokeWidth={2.5} />
      <rect x={14} y={-4} width={4} height={8} rx={1} fill={INK} />
      <rect x={-13} y={-6} width={24 * level} height={12} rx={1.5} fill="#8bf05a" />
      <path d="M -1 -6 L -6 1 L -1 1 L -3 7 L 4 -1 L -1 -1 Z" fill={INK} />
    </g>
  );
}

/** Memory chip with 1–3 lit bars. Centred on (0, 0). */
export function MemoryArt({ bars }: { bars: number }) {
  return (
    <g>
      {[-10, -3, 4, 11].map((x) => (
        <g key={x}>
          <line x1={x} y1={-12} x2={x} y2={-9} stroke={INK} strokeWidth={2} />
          <line x1={x} y1={9} x2={x} y2={12} stroke={INK} strokeWidth={2} />
        </g>
      ))}
      <rect x={-15} y={-9} width={30} height={18} rx={3} fill="#a98bff" stroke={INK} strokeWidth={2.5} />
      {[0, 1, 2].map((index) => (
        <rect key={index} x={-10 + index * 7} y={-5} width={5} height={10} rx={1}
          fill={index < bars ? "#ffd23f" : "none"} stroke={INK} strokeWidth={1.5} />
      ))}
    </g>
  );
}

/** Ground dish on a little hill. Centred on (0, 0). */
export function DishArt() {
  return (
    <g>
      <path d="M -14 14 Q 0 6 14 14 Z" fill="#8bf05a" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <line x1={0} y1={10} x2={0} y2={0} stroke={INK} strokeWidth={3} />
      <path d="M -11 -8 Q 0 8 11 -8 Z" fill="#e8ecff" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={0} cy={-6} r={2.5} fill="#ff5c8a" stroke={INK} strokeWidth={1.5} />
    </g>
  );
}
