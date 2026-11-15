import type { ReactNode } from "react";
import { findPart, partsCatalog } from "@/lib/sim/catalog";
import type { InstrumentKind, InstrumentPart, SatelliteDesign } from "@/types/game";
import styles from "./designer.module.css";

/** Orbits ordered from lowest (sharpest view) to highest, using the catalog resolution factor. */
const orbitsByAltitude = [...partsCatalog.orbits].sort((a, b) => b.resolutionFactor - a.resolutionFactor);

const solarSpan: Record<string, number> = { solar_s: 34, solar_m: 56, solar_l: 80 };
const storageBars: Record<string, number> = { storage_32: 1, storage_128: 2, storage_512: 3 };

function Sensor({ part, x }: { part: InstrumentPart; x: number }) {
  const kind: InstrumentKind = part.kind;
  const common = "fill-card stroke-primary";
  const shapes: Record<InstrumentKind, ReactNode> = {
    optical: (
      <>
        <rect x={x - 8} y={128} width={16} height={14} rx={2} className={common} strokeWidth={2} />
        <circle cx={x} cy={146} r={6} className="fill-primary" />
        <circle cx={x} cy={146} r={2.5} className="fill-background" />
      </>
    ),
    multispectral: (
      <>
        <rect x={x - 10} y={128} width={20} height={18} rx={2} className={common} strokeWidth={2} />
        {[0, 1, 2].map((band) => (
          <rect key={band} x={x - 7 + band * 5} y={132} width={3.5} height={11} fill={["#7dd3fc", "#86efac", "#fca5a5"][band]} />
        ))}
      </>
    ),
    thermal: (
      <>
        <polygon points={`${x},126 ${x + 10},132 ${x + 10},144 ${x},150 ${x - 10},144 ${x - 10},132`} className={common} strokeWidth={2} />
        <circle cx={x} cy={138} r={5} fill="#fb923c" />
      </>
    ),
    microwave: (
      <>
        <rect x={x - 4} y={128} width={8} height={8} className={common} strokeWidth={2} />
        <polygon points={`${x - 4},136 ${x + 4},136 ${x + 11},150 ${x - 11},150`} className={common} strokeWidth={2} />
      </>
    ),
    radar: (
      <>
        <rect x={x - 3} y={128} width={6} height={8} className="fill-primary" />
        <rect x={x - 22} y={136} width={44} height={7} rx={1} className={common} strokeWidth={2} />
        {[-15, -5, 5, 15].map((offset) => (
          <line key={offset} x1={x + offset} y1={137} x2={x + offset} y2={142} className="stroke-primary" strokeWidth={1} />
        ))}
      </>
    ),
    lidar: (
      <>
        <rect x={x - 5} y={128} width={10} height={20} rx={4} className={common} strokeWidth={2} />
        <circle cx={x} cy={148} r={2.5} fill="#86efac" />
      </>
    ),
    gravimetry: (
      <>
        <circle cx={x} cy={139} r={10} className={common} strokeWidth={2} />
        <circle cx={x} cy={139} r={4} className="fill-primary" />
      </>
    ),
  };
  return <g className={styles.install}>{shapes[kind]}</g>;
}

function Antenna({ commId }: { commId: string }) {
  if (commId === "uhf") {
    return (
      <g className={styles.install}>
        <line x1={160} y1={84} x2={160} y2={54} className="stroke-primary" strokeWidth={2} />
        <circle cx={160} cy={52} r={3} className="fill-primary" />
      </g>
    );
  }
  const radius = commId === "ka_band" ? 22 : commId === "x_band" ? 16 : 11;
  return (
    <g className={styles.install}>
      <line x1={160} y1={84} x2={160} y2={76} className="stroke-primary" strokeWidth={3} />
      <path d={`M ${160 - radius} ${76 - radius * 0.55} Q 160 ${76 + radius * 0.35} ${160 + radius} ${76 - radius * 0.55} Z`}
        className="fill-card stroke-primary" strokeWidth={2} />
      <line x1={160} y1={76} x2={160} y2={76 - radius * 0.7} className="stroke-primary" strokeWidth={1.5} />
      <circle cx={160} cy={76 - radius * 0.7} r={2} className="fill-primary" />
    </g>
  );
}

function SolarWing({ side, span }: { side: -1 | 1; span: number }) {
  const start = side === -1 ? 128 - 6 - span : 192 + 6;
  const cells = Math.max(2, Math.round(span / 14));
  return (
    <g className={styles.install}>
      <line x1={side === -1 ? 128 : 192} y1={106} x2={side === -1 ? start + span : start} y2={106} className="stroke-primary" strokeWidth={2} />
      <rect x={start} y={90} width={span} height={32} rx={2} fill="#1e3a8a" className="stroke-primary" strokeWidth={1.5} />
      {Array.from({ length: cells - 1 }, (_, index) => (
        <line key={index} x1={start + ((index + 1) * span) / cells} y1={90} x2={start + ((index + 1) * span) / cells} y2={122}
          className="stroke-primary" strokeOpacity={0.5} strokeWidth={1} />
      ))}
      <line x1={start} y1={106} x2={start + span} y2={106} className="stroke-primary" strokeOpacity={0.5} strokeWidth={1} />
    </g>
  );
}

function EmptySlot({ x, y, width, height, label }: { x: number; y: number; width: number; height: number; label: string }) {
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={width} height={height} rx={3} fill="none" className="stroke-muted-foreground" strokeDasharray="4 3" strokeWidth={1.5} />
      <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>{label}</text>
    </g>
  );
}

/**
 * Live drawing of the satellite. Every element is derived from the selected
 * catalog parts; empty slots are drawn as dashed outlines.
 */
export function SatelliteVisual({ design }: { design: SatelliteDesign }) {
  const instruments = design.instruments
    .map((id) => findPart(partsCatalog.instruments, id))
    .filter((part): part is InstrumentPart => part !== undefined);
  const orbit = findPart(partsCatalog.orbits, design.orbit);
  const solar = findPart(partsCatalog.solar, design.solar);
  const battery = findPart(partsCatalog.batteries, design.battery);
  const comm = findPart(partsCatalog.communications, design.comm);
  const storage = findPart(partsCatalog.storage, design.storage);
  const span = solar ? (solarSpan[solar.id] ?? 50) : 0;
  const bars = storage ? (storageBars[storage.id] ?? 1) : 0;
  const altitudeLevel = orbit ? orbitsByAltitude.findIndex((item) => item.id === orbit.id) : -1;
  const markerY = altitudeLevel < 0 ? null : 196 - altitudeLevel * 42;
  const sensorXs = instruments.length === 1 ? [160] : instruments.length === 2 ? [143, 177] : [136, 160, 184];

  const summary = [
    instruments.length ? `Sensors: ${instruments.map((part) => part.name).join(", ")}` : "No sensors",
    orbit ? `Orbit: ${orbit.name}` : "No orbit",
    solar ? `${solar.name} (${solar.generationW} W)` : "No solar array",
    battery ? battery.name : "No battery",
    comm ? `${comm.name} radio` : "No radio",
    storage ? storage.name : "No storage",
  ].join(". ");

  return (
    <figure className="m-0">
      <svg viewBox="0 0 320 230" role="img" aria-label={`Your satellite. ${summary}.`} className="h-auto w-full">
        {/* Altitude strip */}
        <g aria-hidden="true">
          <text x={10} y={16} className="fill-muted-foreground" fontSize={9}>Altitude</text>
          <line x1={22} y1={28} x2={22} y2={200} className="stroke-border" strokeWidth={1} />
          {orbitsByAltitude.map((item, index) => (
            <g key={item.id}>
              <line x1={18} y1={196 - index * 42} x2={26} y2={196 - index * 42} className="stroke-border" />
            </g>
          ))}
          <path d="M 0 222 Q 40 204 80 222" className="fill-primary" fillOpacity={0.25} />
          <text x={8} y={219} className="fill-muted-foreground" fontSize={8}>Earth</text>
          {markerY !== null && orbit && (
            <g key={orbit.id} className={styles.install}>
              <circle cx={22} cy={markerY} r={5} className="fill-primary" />
              <text x={32} y={markerY + 3} className="fill-foreground" fontSize={9}>{orbit.name}</text>
            </g>
          )}
        </g>

        {/* Sensor beams */}
        {instruments.map((part, index) => (
          <polygon key={`beam-${part.id}`} className={styles.beam}
            points={`${sensorXs[index] - 4},150 ${sensorXs[index] + 4},150 ${sensorXs[index] + 22},226 ${sensorXs[index] - 22},226`}
            fill={part.kind === "thermal" ? "#fb923c" : part.kind === "radar" ? "#c4b5fd" : "#8cddff"} opacity={0.3} />
        ))}

        {/* Solar wings */}
        {solar ? (
          <g key={solar.id}>
            <SolarWing side={-1} span={span} />
            <SolarWing side={1} span={span} />
          </g>
        ) : (
          <>
            <EmptySlot x={72} y={90} width={50} height={32} label="+ solar" />
            <EmptySlot x={198} y={90} width={50} height={32} label="+ solar" />
          </>
        )}

        {/* Bus */}
        <rect x={128} y={84} width={64} height={44} rx={4} className="fill-muted stroke-primary" strokeWidth={2} />
        <rect x={128} y={84} width={64} height={6} fill="#d4af37" opacity={0.7} />

        {/* Battery gauge on the bus */}
        {battery ? (
          <g key={battery.id} className={styles.install}>
            <rect x={136} y={96} width={22} height={11} rx={1.5} fill="none" className="stroke-foreground" strokeWidth={1.2} />
            <rect x={158} y={99} width={2} height={5} className="fill-foreground" />
            <rect x={137.5} y={97.5} width={19 * battery.eclipseContinuity} height={8} fill="#86efac" />
          </g>
        ) : (
          <EmptySlot x={134} y={94} width={26} height={14} label="+" />
        )}

        {/* Storage bars on the bus */}
        {storage ? (
          <g key={storage.id} className={styles.install}>
            {Array.from({ length: 3 }, (_, index) => (
              <rect key={index} x={166 + index * 7} y={96} width={5} height={11} rx={1}
                className={index < bars ? "fill-primary" : "fill-none stroke-border"} strokeWidth={1} />
            ))}
          </g>
        ) : (
          <EmptySlot x={164} y={94} width={22} height={14} label="+" />
        )}
        <text x={160} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={7} aria-hidden="true">BUS</text>

        {/* Antenna */}
        {comm ? <Antenna key={comm.id} commId={comm.id} /> : <EmptySlot x={146} y={56} width={28} height={24} label="+" />}

        {/* Sensors */}
        {instruments.length
          ? instruments.map((part, index) => <Sensor key={part.id} part={part} x={sensorXs[index]} />)
          : <EmptySlot x={140} y={130} width={40} height={20} label="+ eyes" />}
      </svg>
      <figcaption className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Sensors: <b className="text-foreground">{instruments.length}/3</b></span>
        <span>Panels: <b className="text-foreground">{solar ? `${solar.generationW} W` : "—"}</b></span>
        <span>Battery: <b className="text-foreground">{battery ? `${Math.round(battery.eclipseContinuity * 100)}% in shadow` : "—"}</b></span>
        <span>Radio: <b className="text-foreground">{comm ? `${comm.rateGbps} Gbps` : "—"}</b></span>
        <span>Memory: <b className="text-foreground">{storage ? `${storage.capacityGB} GB` : "—"}</b></span>
        <span>Orbit: <b className="text-foreground">{orbit ? orbit.name : "—"}</b></span>
      </figcaption>
    </figure>
  );
}
