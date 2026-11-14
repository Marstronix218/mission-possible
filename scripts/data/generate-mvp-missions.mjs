import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = resolve(root, "data/missions");

const configurations = [
  {
    slug: "los-angeles",
    city: "Los Angeles",
    category: "wildfire",
    objective: "Detect active wildfire cells quickly enough to support community evacuation planning.",
    bbox: [-118.95, 33.65, -117.55, 34.45],
    durationDays: 7,
    seed: 2182026,
    targetResponseHours: 6,
    cloudBase: 0.22,
    truth: (x, y) => Math.max(blob(x, y, 0.28, 0.72, 0.13), blob(x, y, 0.73, 0.3, 0.1)),
    source: {
      name: "NASA FIRMS / VIIRS (reference dataset)",
      url: "https://firms.modaps.eosdis.nasa.gov/",
      usage: "Hazard placement is an educational model inspired by FIRMS fire-detection products; cells are not current observations."
    }
  },
  {
    slug: "houston",
    city: "Houston",
    category: "flood",
    objective: "Map flooded neighborhoods through cloud cover and deliver actionable coverage within 12 hours.",
    bbox: [-96.05, 29.35, -94.95, 30.15],
    durationDays: 7,
    seed: 7132026,
    targetResponseHours: 12,
    cloudBase: 0.64,
    truth: (x, y) => Math.max(blob(x, y, 0.48, 0.46, 0.24), 0.72 - Math.abs(y - (0.35 + 0.14 * Math.sin(x * 10))) * 5),
    source: {
      name: "NASA GPM IMERG and OPERA DSWx (reference datasets)",
      url: "https://gpm.nasa.gov/data/imerg",
      usage: "Flood and cloud patterns are educational models inspired by precipitation and surface-water products; cells are not current observations."
    }
  },
  {
    slug: "phoenix",
    city: "Phoenix",
    category: "heat",
    objective: "Identify the hottest urban areas with sufficient accuracy to prioritize heat-response resources.",
    bbox: [-112.55, 33.15, -111.55, 33.85],
    durationDays: 7,
    seed: 6022026,
    targetResponseHours: 24,
    cloudBase: 0.12,
    truth: (x, y) => Math.max(blob(x, y, 0.5, 0.53, 0.3), blob(x, y, 0.72, 0.38, 0.16)),
    source: {
      name: "NASA ECOSTRESS land-surface temperature (reference dataset)",
      url: "https://ecostress.jpl.nasa.gov/",
      usage: "Heat intensity is an educational model inspired by ECOSTRESS products; cells are not current observations."
    }
  }
];

function blob(x, y, centerX, centerY, radius) {
  const distance = Math.hypot(x - centerX, y - centerY);
  return Math.max(0, 1 - distance / radius);
}

function pseudoRandom(seed, index) {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

function createMission(config) {
  const [west, south, east, north] = config.bbox;
  const grid = [];
  for (let row = 0; row < 20; row += 1) {
    for (let column = 0; column < 20; column += 1) {
      const index = row * 20 + column;
      const x = (column + 0.5) / 20;
      const y = (row + 0.5) / 20;
      const signal = config.truth(x, y);
      const noise = (pseudoRandom(config.seed, index) - 0.5) * 0.16;
      const truth = signal + noise > 0.42 ? 1 : 0;
      grid.push({
        id: `r${String(row).padStart(2, "0")}c${String(column).padStart(2, "0")}`,
        row,
        column,
        lat: round(south + (north - south) * y, 5),
        lon: round(west + (east - west) * x, 5),
        truth,
        cloudProbability: round(Math.min(0.95, Math.max(0.02, config.cloudBase + (pseudoRandom(config.seed + 17, index) - 0.5) * 0.28)), 3),
        detectability: round(0.68 + pseudoRandom(config.seed + 31, index) * 0.3, 3),
        eventDay: truth && config.category !== "wildfire"
          ? Math.floor(pseudoRandom(config.seed + 47, index) * 2)
          : 0
      });
    }
  }

  return {
    slug: config.slug,
    city: config.city,
    category: config.category,
    objective: { en: config.objective },
    bbox: config.bbox,
    defaultConstraints: { budgetM: 250, massKg: 500 },
    durationDays: config.durationDays,
    seed: config.seed,
    targetResponseHours: config.targetResponseHours,
    grid,
    sources: [{
      ...config.source,
      accessedOn: "2026-11-14",
      provenance: "educational-model"
    }]
  };
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

await mkdir(outputDirectory, { recursive: true });
const missions = configurations.map(createMission);
await Promise.all(missions.map((mission) =>
  writeFile(resolve(outputDirectory, `${mission.slug}.json`), `${JSON.stringify(mission, null, 2)}\n`)
));
await writeFile(
  resolve(outputDirectory, "index.json"),
  `${JSON.stringify(missions.map(({ grid, ...mission }) => ({ ...mission, gridCellCount: grid.length })), null, 2)}\n`,
);
