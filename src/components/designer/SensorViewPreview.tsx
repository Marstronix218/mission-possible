import { useId, type ReactNode } from "react";
import { categoryRules, findPart, partsCatalog } from "@/lib/sim/catalog";
import type { InstrumentPart, Mission, SatelliteDesign } from "@/types/game";
import { hazardCopy } from "./hazard-copy";

interface Block {
  key: string;
  x: number;
  y: number;
  size: number;
  truth: number;
  cloud: number;
  inSwath: boolean;
}

/** Group the mission grid into square blocks; coarse sensors see bigger, blurrier blocks. */
function toBlocks(mission: Mission, blockSize: number, swathStart: number, swathEnd: number): Block[] {
  const columns = Math.max(...mission.grid.map((cell) => cell.column)) + 1;
  const rows = Math.max(...mission.grid.map((cell) => cell.row)) + 1;
  const blocks: Block[] = [];
  for (let row = 0; row < rows; row += blockSize) {
    for (let column = 0; column < columns; column += blockSize) {
      const cells = mission.grid.filter((cell) =>
        cell.row >= row && cell.row < row + blockSize && cell.column >= column && cell.column < column + blockSize);
      if (!cells.length) continue;
      const centre = (column + Math.min(blockSize, columns - column) / 2) / columns;
      blocks.push({
        key: `${row}-${column}`,
        x: column,
        y: rows - row - Math.min(blockSize, rows - row),
        size: Math.min(blockSize, columns - column, rows - row),
        truth: Math.max(...cells.map((cell) => cell.truth)) * 0.6 + (cells.reduce((sum, cell) => sum + cell.truth, 0) / cells.length) * 0.4,
        cloud: cells.reduce((sum, cell) => sum + cell.cloudProbability, 0) / cells.length,
        inSwath: centre >= swathStart && centre <= swathEnd,
      });
    }
  }
  return blocks;
}

function MapFrame({ title, columns, children }: { title: string; columns: number; children: ReactNode }) {
  return (
    <figure className="m-0 min-w-0">
      <svg viewBox={`0 0 ${columns} ${columns}`} className="block h-auto w-full rounded-md border border-border bg-muted" aria-hidden="true">
        {children}
      </svg>
      <figcaption className="mt-1 text-center text-xs text-muted-foreground">{title}</figcaption>
    </figure>
  );
}

/**
 * Schematic of the mission area as the selected sensors would see it. Derived
 * only from catalog fields (category fit, cloud penetration, resolution) and the
 * mission grid; it is an illustration, not a simulation result.
 */
export function SensorViewPreview({ mission, design, hazardNoun, obstacle }: {
  mission: Mission;
  design: SatelliteDesign;
  hazardNoun: string;
  obstacle: string;
}) {
  const patternId = useId().replace(/:/g, "");
  const instruments = design.instruments
    .map((id) => findPart(partsCatalog.instruments, id))
    .filter((part): part is InstrumentPart => part !== undefined);
  const orbit = findPart(partsCatalog.orbits, design.orbit);
  const fitOf = (part: InstrumentPart) => part.categoryFit[mission.category] ?? 0;
  const best = instruments.reduce<InstrumentPart | undefined>(
    (current, part) => (!current || fitOf(part) * part.resolutionScore > fitOf(current) * current.resolutionScore ? part : current),
    undefined,
  );
  const fit = best ? fitOf(best) : 0;
  const canSee = fit >= 0.5;
  const penetrating = instruments.some((part) => part.cloudPenetrating && fitOf(part) >= 0.5);
  const cloudImpact = categoryRules[mission.category]?.cloudImpact ?? 1;
  const detail = best ? best.resolutionScore * (orbit?.resolutionFactor ?? 1) : 1;
  const blockSize = detail >= 0.7 ? 1 : detail >= 0.35 ? 2 : 4;
  const swath = orbit ? Math.min(1, 0.25 + 0.375 * orbit.swathFactor) : 1;
  const swathStart = (1 - swath) / 2;
  const swathEnd = 1 - swathStart;
  const columns = Math.max(...mission.grid.map((cell) => cell.column)) + 1;
  const truthBlocks = toBlocks(mission, 1, 0, 1);
  const seenBlocks = toBlocks(mission, blockSize, swathStart, swathEnd);
  const copy = hazardCopy[mission.category];
  const color = copy?.color ?? "#fbbf24";
  const veilName = copy?.veil ?? "clouds";

  const veilOf = (block: Block) => block.cloud * (penetrating ? 0.08 : cloudImpact);
  const strengthOf = (block: Block) => (canSee ? block.truth * fit * (1 - veilOf(block)) : 0);
  const hazardTotal = truthBlocks.filter((block) => block.truth > 0.5).length;
  const visibleTotal = canSee
    ? truthBlocks.filter((block) => {
        const centre = (block.x + 0.5) / columns;
        return block.truth > 0.5 && centre >= swathStart && centre <= swathEnd && block.truth * fit * (1 - veilOf(block)) > 0.3;
      }).length
    : 0;
  const averageVeil = truthBlocks.reduce((sum, block) => sum + veilOf(block), 0) / Math.max(1, truthBlocks.length);

  let verdict: string;
  if (!best) verdict = "No sensor installed yet. Your satellite can't see anything.";
  else if (!canSee) verdict = `${best.name} can't detect the ${hazardNoun}. ${obstacle}`;
  else verdict = `${best.name} finds about ${visibleTotal} of the ${hazardTotal} areas with ${hazardNoun} in one pass.`;

  const notes: string[] = [];
  if (best && canSee && blockSize > 1) notes.push("Low detail: small spots blur together.");
  if (best && canSee && !penetrating && averageVeil > 0.2) notes.push(`${veilName[0].toUpperCase() + veilName.slice(1)} hide part of the area from this sensor.`);
  if (best && penetrating) notes.push(`Sees through ${veilName}.`);
  if (orbit && swath < 1) notes.push(`${orbit.name} sees a strip about ${Math.round(swath * 100)}% of the area wide per pass.`);
  if (!orbit) notes.push("Choose an orbit to see how wide a strip you cover.");

  return (
    <section aria-labelledby={`${patternId}-heading`} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${patternId}-heading`} className="text-lg font-bold">What your satellite can see</h2>
        <span className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">Preview, not a simulation result</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MapFrame title="Modeled situation" columns={columns}>
          {truthBlocks.map((block) => block.truth > 0.15 && (
            <rect key={block.key} x={block.x} y={block.y} width={1} height={1} fill={color} opacity={Math.min(1, 0.25 + block.truth)} />
          ))}
          {truthBlocks.map((block) => block.truth > 0.5 && (
            <circle key={`m-${block.key}`} cx={block.x + 0.5} cy={block.y + 0.5} r={0.18} fill="#0b1422" />
          ))}
        </MapFrame>
        <MapFrame title="Your satellite's view" columns={columns}>
          <defs>
            <pattern id={patternId} width={1.2} height={1.2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={1.2} stroke="#f2f6ff" strokeOpacity={0.55} strokeWidth={0.3} />
            </pattern>
          </defs>
          {seenBlocks.map((block) => {
            const strength = strengthOf(block);
            const veil = veilOf(block);
            return (
              <g key={block.key} opacity={block.inSwath ? 1 : 0.25}>
                {strength > 0.12 && (
                  <rect x={block.x} y={block.y} width={block.size} height={block.size} fill={color} opacity={Math.min(1, 0.2 + strength)} />
                )}
                {strength > 0.3 && (
                  <circle cx={block.x + block.size / 2} cy={block.y + block.size / 2} r={0.18 * block.size} fill="#0b1422" />
                )}
                {veil > 0.15 && (
                  <rect x={block.x} y={block.y} width={block.size} height={block.size} fill="#cbd5e1" opacity={Math.min(0.85, veil)} />
                )}
                {veil > 0.35 && (
                  <rect x={block.x} y={block.y} width={block.size} height={block.size} fill={`url(#${patternId})`} />
                )}
              </g>
            );
          })}
          {!best && (
            <text x={columns / 2} y={columns / 2 + 1.5} textAnchor="middle" fontSize={4} className="fill-muted-foreground">?</text>
          )}
          {orbit && swath < 1 && (
            <>
              <line x1={swathStart * columns} y1={0} x2={swathStart * columns} y2={columns} stroke="#f2f6ff" strokeWidth={0.15} strokeDasharray="0.6 0.4" />
              <line x1={swathEnd * columns} y1={0} x2={swathEnd * columns} y2={columns} stroke="#f2f6ff" strokeWidth={0.15} strokeDasharray="0.6 0.4" />
            </>
          )}
        </MapFrame>
      </div>
      <p aria-live="polite" className="text-sm font-semibold">{verdict}</p>
      {notes.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {notes.map((note) => <li key={note}>• {note}</li>)}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Key: colored squares with a dark dot = {hazardNoun}; grey striped squares = {veilName} blocking the view; faded area = outside the strip seen in one pass.
      </p>
    </section>
  );
}
