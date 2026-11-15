import { findPart, partsCatalog } from "@/lib/sim/catalog";
import type { OrbitPart } from "@/types/game";
import { partCopy } from "./builder-copy";
import { INK } from "./parts-art";
import { useReducedMotion } from "./useReducedMotion";

interface RingShape { rx: number; ry: number; tilt: number; seconds: number }

/** Drawing scale per orbit: higher orbits get bigger rings and slower laps. */
const rings: Record<string, RingShape> = {
  leo_400: { rx: 80, ry: 80, tilt: 0, seconds: 5 },
  sso_700: { rx: 96, ry: 96, tilt: 0, seconds: 7 },
  meo_tilt: { rx: 124, ry: 74, tilt: -28, seconds: 12 },
  geo: { rx: 134, ry: 134, tilt: 0, seconds: 0 },
};

const EARTH = 60;
const CX = 180;
const CY = 158;

/** Ellipse path starting at the top and running clockwise, around (0, 0). */
const ringPath = ({ rx, ry }: RingShape) => `M 0 ${-ry} A ${rx} ${ry} 0 1 1 0 ${ry} A ${rx} ${ry} 0 1 1 0 ${-ry}`;

function Earth({ hazardColor }: { hazardColor: string }) {
  return (
    <g aria-hidden="true">
      <circle cx={CX} cy={CY} r={EARTH} fill="#1f4fd1" stroke={INK} strokeWidth={4} />
      <path d={`M ${CX - 44} ${CY - 22} q 18 -20 40 -8 q 14 10 4 24 q -16 14 -30 4 q -20 -6 -14 -20 Z`} fill="#3fbf6f" stroke={INK} strokeWidth={2.5} />
      <path d={`M ${CX + 12} ${CY + 14} q 22 -10 34 6 q 4 16 -14 22 q -22 2 -20 -28 Z`} fill="#3fbf6f" stroke={INK} strokeWidth={2.5} />
      <circle cx={CX} cy={CY - EARTH} r={6} fill={hazardColor} stroke={INK} strokeWidth={2.5} />
    </g>
  );
}

function Sprite({ swathFactor, reach }: { swathFactor: number; reach: number }) {
  const half = 7 + 9 * swathFactor;
  return (
    <g>
      <polygon points={`-4,6 4,6 ${half},${reach} ${-half},${reach}`} fill="#ffd23f" opacity={0.35} />
      <rect x={-20} y={-5} width={12} height={10} rx={2} fill="#2b3fd6" stroke={INK} strokeWidth={2} />
      <rect x={8} y={-5} width={12} height={10} rx={2} fill="#2b3fd6" stroke={INK} strokeWidth={2} />
      <rect x={-8} y={-8} width={16} height={16} rx={3} fill="#e8ecff" stroke={INK} strokeWidth={2.5} />
    </g>
  );
}

/**
 * Earth with every orbit drawn faintly and the chosen one bright. The satellite
 * laps faster on low orbits; on geostationary it stays over the same spot.
 * Its yellow beam widens with the catalog swath factor.
 */
export function OrbitPreview({ orbitId, hazardColor = "#2de2e6" }: { orbitId: string; hazardColor?: string }) {
  const reduced = useReducedMotion();
  const orbit = findPart(partsCatalog.orbits, orbitId);
  const shape = orbit ? rings[orbit.id] : undefined;
  const copy = orbit ? partCopy[orbit.id] : undefined;
  return (
    <svg viewBox="0 0 360 300" role="img" className="block h-full w-full"
      aria-label={orbit ? `Orbit preview: ${copy?.name ?? orbit.name}, ${copy?.tag ?? ""}.` : "Orbit preview: no orbit chosen yet."}>
      {partsCatalog.orbits.map((item) => rings[item.id] && (
        <g key={item.id} transform={`translate(${CX} ${CY}) rotate(${rings[item.id].tilt})`} aria-hidden="true">
          <path d={ringPath(rings[item.id])} fill="none" stroke="#4b55a8" strokeWidth={2} strokeDasharray="3 6" />
        </g>
      ))}
      <Earth hazardColor={hazardColor} />
      {orbit && shape && (
        <g key={orbit.id} transform={`translate(${CX} ${CY}) rotate(${shape.tilt})`} aria-hidden="true">
          <path d={ringPath(shape)} fill="none" stroke="#2de2e6" strokeWidth={4} strokeLinecap="round" />
          <SpriteOnRing orbit={orbit} shape={shape} reduced={reduced} />
        </g>
      )}
      {!orbit && (
        <text x={CX} y={CY + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="#f6f7ff"
          style={{ fontFamily: "var(--font-display)" }} aria-hidden="true">Pick a path</text>
      )}
    </svg>
  );
}

function SpriteOnRing({ orbit, shape, reduced }: { orbit: OrbitPart; shape: RingShape; reduced: boolean }) {
  const reach = Math.min(shape.rx, shape.ry) - EARTH + 4;
  if (!shape.seconds || reduced) {
    return <g transform={`translate(0 ${-shape.ry})`}><Sprite swathFactor={orbit.swathFactor} reach={reach} /></g>;
  }
  return (
    <g>
      <Sprite swathFactor={orbit.swathFactor} reach={reach} />
      {/* rotate="auto" keeps local +x on the direction of travel, so the beam (+y) points at Earth. */}
      <animateMotion dur={`${shape.seconds}s`} repeatCount="indefinite" rotate="auto" path={ringPath(shape)} />
    </g>
  );
}

/** Tiny orbit icon for the orbit cards. */
export function OrbitIcon({ orbitId }: { orbitId: string }) {
  const shape = rings[orbitId];
  if (!shape) return null;
  const scale = 0.27;
  const ry = shape.ry * scale;
  return (
    <svg viewBox="-40 -40 80 80" className="block h-full w-full" aria-hidden="true">
      <circle r={15} fill="#1f4fd1" stroke={INK} strokeWidth={2.5} />
      <path d="M -10 -4 q 5 -7 12 -3 q 3 5 -3 8 q -7 2 -9 -5 Z" fill="#3fbf6f" />
      <g transform={`rotate(${shape.tilt})`}>
        <ellipse rx={shape.rx * scale} ry={ry} fill="none" stroke="#2de2e6" strokeWidth={2.5} />
        <rect x={-4} y={-ry - 4} width={8} height={8} rx={2} fill="#ffd23f" stroke={INK} strokeWidth={1.5} />
      </g>
    </svg>
  );
}
