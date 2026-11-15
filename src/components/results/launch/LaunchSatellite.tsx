import { findPart, partsCatalog } from "@/lib/sim/catalog";
import type { InstrumentPart, SatelliteDesign } from "@/types/game";
import {
  AntennaArt,
  BatteryArt,
  INK,
  MemoryArt,
  SensorArt,
  SolarWingArt,
} from "@/components/designer/parts-art";
import styles from "./launch.module.css";

// Same proportions as the designer's live satellite so the player recognises it.
const solarSpan: Record<string, number> = { solar_s: 40, solar_m: 62, solar_l: 86 };
const storageBars: Record<string, number> = { storage_32: 1, storage_128: 2, storage_512: 3 };
const sensorWidth = (part: InstrumentPart) =>
  part.id === "sar" ? 64 : part.kind === "radar" || part.kind === "gravimetry" ? 46 : 32;
const SENSOR_GAP = 8;
/** Horizontal scale of a stowed solar wing. */
export const FOLDED = 0.12;
const BUS_W = 72;
const BUS_H = 58;
/** Approximate drawn height (antenna tip to sensor bottom). */
export const SATELLITE_HEIGHT = 136;

function instrumentsOf(design: SatelliteDesign): InstrumentPart[] {
  return design.instruments
    .map((id) => findPart(partsCatalog.instruments, id))
    .filter((part): part is InstrumentPart => part !== undefined);
}

/** Centre x of each sensor, packed side by side around x = 0. */
function sensorLayout(parts: InstrumentPart[]): { total: number; xs: number[] } {
  const widths = parts.map(sensorWidth);
  const total =
    widths.reduce((sum, w) => sum + w, 0) +
    SENSOR_GAP * Math.max(0, parts.length - 1);
  const xs = widths.map(
    (w, i) =>
      -total / 2 +
      widths.slice(0, i).reduce((sum, prev) => sum + prev + SENSOR_GAP, 0) +
      w / 2,
  );
  return { total, xs };
}

/** Width of the satellite with wings stowed, used to fit it inside the fairing. */
export function stowedWidth(design: SatelliteDesign): number {
  const sensors = sensorLayout(instrumentsOf(design)).total;
  const span = solarSpan[design.solar] ?? 0;
  return Math.max(BUS_W + 2 * (8 + span) * FOLDED, sensors);
}

/**
 * The player's satellite drawn from their design, centred on its bus at (0, 0).
 * Built from the designer's part art; solar wings fold for launch.
 */
export function LaunchSatellite({
  design,
  panelsOpen,
  cable,
}: {
  design: SatelliteDesign;
  panelsOpen: boolean;
  cable: boolean;
}) {
  const parts = instrumentsOf(design);
  const solar = findPart(partsCatalog.solar, design.solar);
  const battery = findPart(partsCatalog.batteries, design.battery);
  const comm = findPart(partsCatalog.communications, design.comm);
  const storage = findPart(partsCatalog.storage, design.storage);
  const span = solar ? (solarSpan[solar.id] ?? 60) : 0;
  const { total, xs } = sensorLayout(parts);
  const wing = { transform: `scale(${panelsOpen ? 1 : FOLDED}, 1)` };
  const top = -BUS_H / 2;
  return (
    <g>
      <g className={styles.cable} data-on={cable}>
        <line x1={0} y1={top - 44} x2={0} y2={-900} stroke="#c9d3ff" strokeWidth={3} />
        <path
          d={`M -9 ${top - 30} Q 0 ${top - 50} 9 ${top - 30}`}
          fill="none"
          stroke="#c9d3ff"
          strokeWidth={3}
        />
      </g>
      {solar && (
        <>
          <g transform={`translate(${-BUS_W / 2} 0)`}>
            <g className={styles.wing} style={wing}>
              <SolarWingArt side={-1} span={span} />
            </g>
          </g>
          <g transform={`translate(${BUS_W / 2} 0)`}>
            <g className={styles.wing} style={wing}>
              <SolarWingArt side={1} span={span} />
            </g>
          </g>
        </>
      )}
      {comm && (
        <g transform={`translate(0 ${top})`}>
          <AntennaArt id={comm.id} />
        </g>
      )}
      <rect
        x={-BUS_W / 2}
        y={top}
        width={BUS_W}
        height={BUS_H}
        rx={8}
        fill="#e8ecff"
        stroke={INK}
        strokeWidth={3.5}
      />
      <rect x={-BUS_W / 2 + 2} y={top + 2} width={BUS_W - 4} height={10} rx={4} fill="#ffd23f" />
      <line x1={-BUS_W / 2} y1={top + 13} x2={BUS_W / 2} y2={top + 13} stroke={INK} strokeWidth={2.5} />
      {battery && (
        <g transform="translate(-14 3)">
          <BatteryArt level={battery.eclipseContinuity} />
        </g>
      )}
      {storage && (
        <g transform="translate(19 3)">
          <MemoryArt bars={storageBars[storage.id] ?? 1} />
        </g>
      )}
      {parts.length > 0 && (
        <rect
          x={-total / 2 - 2}
          y={BUS_H / 2 - 2}
          width={total + 4}
          height={6}
          rx={3}
          fill="#c3c8f5"
          stroke={INK}
          strokeWidth={2.5}
        />
      )}
      {parts.map((part, index) => (
        <g key={part.id} transform={`translate(${xs[index]} ${BUS_H / 2 + 4})`}>
          <SensorArt id={part.id} kind={part.kind} />
        </g>
      ))}
    </g>
  );
}
