import { findPart, partsCatalog } from "@/lib/sim/catalog";
import type { PartSlot } from "@/lib/story/parts";
import type { InstrumentPart, SatelliteDesign } from "@/types/game";
import { partCopy } from "./builder-copy";
import type { StageId } from "./builder-model";
import { AntennaArt, BatteryArt, INK, kindColor, MemoryArt, SensorArt, SolarWingArt } from "./parts-art";
import styles from "./designer.module.css";

const solarSpan: Record<string, number> = { solar_s: 40, solar_m: 62, solar_l: 86 };
const storageBars: Record<string, number> = { storage_32: 1, storage_128: 2, storage_512: 3 };
const sensorWidth = (part: InstrumentPart) => (part.id === "sar" ? 64 : part.kind === "radar" || part.kind === "gravimetry" ? 46 : 32);

/** Centre x of each sensor so wide radars never overlap their neighbours. */
function sensorPositions(parts: InstrumentPart[]): number[] {
  const gap = 8;
  const total = parts.reduce((sum, part) => sum + sensorWidth(part), 0) + gap * Math.max(0, parts.length - 1);
  let cursor = 180 - total / 2;
  return parts.map((part) => {
    const centre = cursor + sensorWidth(part) / 2;
    cursor += sensorWidth(part) + gap;
    return centre;
  });
}

interface Area { x: number; y: number; width: number; height: number }

function Socket({ area, active, label }: { area: Area; active: boolean; label: string }) {
  return (
    <g aria-hidden="true">
      <rect {...area} rx={8} fill={active ? "rgba(45,226,230,0.12)" : "none"}
        stroke={active ? "#2de2e6" : "#4b55a8"} strokeWidth={active ? 2.5 : 2}
        className={active ? styles.socket : undefined} strokeDasharray={active ? undefined : "5 4"} />
      <text x={area.x + area.width / 2} y={area.y + area.height / 2 + 5} textAnchor="middle" fontSize={14} fontWeight={700}
        fill={active ? "#2de2e6" : "#7d86c9"} style={{ fontFamily: "var(--font-display)" }}>{label}</text>
    </g>
  );
}

function FixRing({ area }: { area: Area }) {
  const pad = 6;
  return (
    <g aria-hidden="true" className={styles.fixRing}>
      <rect x={area.x - pad} y={area.y - pad} width={area.width + pad * 2} height={area.height + pad * 2} rx={12}
        fill="none" stroke="#ff5c8a" strokeWidth={3} strokeDasharray="7 5" />
      <circle cx={area.x + area.width + pad} cy={area.y - pad} r={9} fill="#ff5c8a" stroke={INK} strokeWidth={2} />
      <text x={area.x + area.width + pad} y={area.y - pad + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK}>!</text>
    </g>
  );
}

/**
 * Live drawing of the satellite. Every element comes from the selected catalog
 * parts. New parts snap on with a bounce (keyed by part id); empty sockets for
 * the current step march so the player sees where the next part goes.
 */
export function SatelliteVisual({ design, activeStage, fixSlots = [], hazardColor = "#2de2e6" }: {
  design: SatelliteDesign;
  activeStage?: StageId;
  fixSlots?: PartSlot[];
  hazardColor?: string;
}) {
  const instruments = design.instruments
    .map((id) => findPart(partsCatalog.instruments, id))
    .filter((part): part is InstrumentPart => part !== undefined);
  const orbit = findPart(partsCatalog.orbits, design.orbit);
  const solar = findPart(partsCatalog.solar, design.solar);
  const battery = findPart(partsCatalog.batteries, design.battery);
  const comm = findPart(partsCatalog.communications, design.comm);
  const storage = findPart(partsCatalog.storage, design.storage);
  const span = solar ? (solarSpan[solar.id] ?? 60) : 0;
  const xs = sensorPositions(instruments);
  const fix = new Set(fixSlots);

  const sensorArea: Area = instruments.length
    ? { x: Math.min(...xs.map((x, i) => x - sensorWidth(instruments[i]) / 2)) - 4, y: 178, width: 0, height: 38 }
    : { x: 150, y: 182, width: 60, height: 34 };
  if (instruments.length) {
    const right = Math.max(...xs.map((x, i) => x + sensorWidth(instruments[i]) / 2)) + 4;
    sensorArea.width = right - sensorArea.x;
  }
  const commArea: Area = { x: 162, y: 78, width: 36, height: 38 };
  const solarLeft: Area = solar ? { x: 144 - 8 - span - 2, y: 124, width: span + 4, height: 50 } : { x: 74, y: 126, width: 62, height: 46 };
  const solarRight: Area = solar ? { x: 216 + 6, y: 124, width: span + 4, height: 50 } : { x: 224, y: 126, width: 62, height: 46 };
  const batteryArea: Area = { x: 150, y: 140, width: 32, height: 24 };
  const storageArea: Area = { x: 185, y: 138, width: 28, height: 28 };

  const summary = [
    instruments.length ? `Sensors: ${instruments.map((part) => partCopy[part.id]?.name ?? part.name).join(", ")}` : "No sensors yet",
    orbit ? `Orbit: ${partCopy[orbit.id]?.name ?? orbit.name}` : "No orbit yet",
    comm ? `Radio: ${partCopy[comm.id]?.name ?? comm.name}` : "No radio yet",
    solar ? `Solar: ${partCopy[solar.id]?.name ?? solar.name}` : "No solar wings yet",
    battery ? partCopy[battery.id]?.name ?? battery.name : "No battery yet",
    storage ? `Memory: ${partCopy[storage.id]?.name ?? storage.name}` : "No memory yet",
  ].join(". ");

  return (
    <svg viewBox="36 62 288 228" role="img" aria-label={`Your satellite. ${summary}.`} className="block h-full w-full">
      <defs>
        <radialGradient id="sat-earth-glow" cx="50%" cy="0%" r="60%">
          <stop offset="0" stopColor={hazardColor} stopOpacity={0.55} />
          <stop offset="1" stopColor={hazardColor} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Earth below, with the mission area glowing in the hazard color */}
      <g aria-hidden="true">
        <ellipse cx={180} cy={560} rx={330} ry={300} fill="#1f4fd1" stroke={INK} strokeWidth={4} />
        <path d="M 40 300 Q 70 272 120 278 Q 150 284 170 270 Q 200 262 240 274 Q 290 286 330 300 Z" fill="#3fbf6f" opacity={0.8} />
        <ellipse cx={180} cy={268} rx={70} ry={14} fill="url(#sat-earth-glow)" />
        <circle cx={180} cy={268} r={5} fill={hazardColor} stroke={INK} strokeWidth={2} />
      </g>

      {/* Sensor beams */}
      {instruments.map((part, index) => (
        <polygon key={`beam-${part.id}`} className={styles.beam} aria-hidden="true"
          points={`${xs[index] - 6},214 ${xs[index] + 6},214 ${180 + (xs[index] - 180) * 0.4 + 26},266 ${180 + (xs[index] - 180) * 0.4 - 26},266`}
          fill={kindColor[part.kind]} opacity={0.35} />
      ))}

      <g className={styles.idle}>
        <g style={{ filter: "drop-shadow(0 5px 0 rgba(0,0,0,0.35))" }}>
          {/* Solar wings */}
          {solar ? (
            <g key={solar.id} className={styles.snap}>
              <g transform="translate(144 149)"><SolarWingArt side={-1} span={span} /></g>
              <g transform="translate(216 149)"><SolarWingArt side={1} span={span} /></g>
            </g>
          ) : (
            <>
              <Socket area={solarLeft} active={activeStage === "power"} label="+" />
              <Socket area={solarRight} active={activeStage === "power"} label="+" />
            </>
          )}

          {/* Antenna */}
          {comm ? (
            <g key={comm.id} className={styles.snap}><g transform="translate(180 120)"><AntennaArt id={comm.id} /></g></g>
          ) : (
            <Socket area={commArea} active={activeStage === "radio"} label="+" />
          )}

          {/* Bus */}
          <rect x={144} y={120} width={72} height={58} rx={8} fill="#e8ecff" stroke={INK} strokeWidth={3.5} />
          <rect x={146} y={122} width={68} height={10} rx={4} fill="#ffd23f" />
          <line x1={144} y1={133} x2={216} y2={133} stroke={INK} strokeWidth={2.5} />

          {battery ? (
            <g key={battery.id} className={styles.snap}><g transform="translate(166 152)"><BatteryArt level={battery.eclipseContinuity} /></g></g>
          ) : (
            <Socket area={batteryArea} active={activeStage === "power"} label="+" />
          )}
          {storage ? (
            <g key={storage.id} className={styles.snap}><g transform="translate(199 152)"><MemoryArt bars={storageBars[storage.id] ?? 1} /></g></g>
          ) : (
            <Socket area={storageArea} active={activeStage === "power"} label="+" />
          )}

          {/* Sensors */}
          {instruments.length > 0 && (
            <rect x={sensorArea.x + 2} y={176} width={sensorArea.width - 4} height={6} rx={3} fill="#c3c8f5" stroke={INK} strokeWidth={2.5} />
          )}
          {instruments.length
            ? instruments.map((part, index) => (
                <g key={part.id} className={styles.snap}>
                  <g transform={`translate(${xs[index]} 182)`}><SensorArt id={part.id} kind={part.kind} /></g>
                </g>
              ))
            : <Socket area={sensorArea} active={activeStage === "eyes" || activeStage === undefined} label="+ eyes" />}
        </g>

        {fix.has("instruments") && <FixRing area={sensorArea} />}
        {fix.has("comm") && <FixRing area={commArea} />}
        {fix.has("solar") && <FixRing area={solarRight} />}
        {fix.has("battery") && <FixRing area={batteryArea} />}
        {fix.has("storage") && <FixRing area={storageArea} />}
      </g>
    </svg>
  );
}
