import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = resolve(root, "data/missions");
const observedDirectory = resolve(root, "scripts/data/observed");

const configurations = [
  {
    slug: "los-angeles",
    city: "Los Angeles",
    category: "wildfire",
    objective: "Detect active wildfire cells quickly enough to support community evacuation planning.",
    bbox: [-118.95, 33.65, -117.55, 34.45],
    defaultConstraints: { budgetM: 220, massKg: 450 },
    durationDays: 6,
    seed: 2182026,
    targetResponseHours: 8,
    cloudBase: 0.12,
    smokeNearObservedFire: true,
    truth: (x, y) => Math.max(blob(x, y, 0.28, 0.72, 0.13), blob(x, y, 0.73, 0.3, 0.1)),
    source: {
      name: "NASA FIRMS / VIIRS (reference dataset)",
      url: "https://firms.modaps.eosdis.nasa.gov/",
      usage: "Hazard placement is an educational model inspired by FIRMS fire-detection products; cells are not current observations."
    },
    observedSources: [{
      name: "NASA FIRMS VIIRS 375 m active fire detections, Suomi NPP and NOAA-20 (via NASA GIBS)",
      url: "https://firms.modaps.eosdis.nasa.gov/",
      usage: "Fire cells and their first-detection day come from VIIRS 375 m thermal anomaly detections, 7-13 Jan 2025 (Palisades, Eaton, Hurst and Kenneth fires). The mission runs 8-13 Jan UTC (day 0 = 8 Jan); cells already burning on 7 Jan start on day 0. Persistent industrial heat sources are masked with a Nov 2024 baseline. Smoke/cloud blocking and sensor detectability are modelled."
    }]
  },
  {
    slug: "houston",
    city: "Houston",
    category: "flood",
    objective: "Map flooded neighborhoods through cloud cover and deliver actionable coverage within 12 hours.",
    bbox: [-96.05, 29.35, -94.95, 30.15],
    defaultConstraints: { budgetM: 320, massKg: 650 },
    durationDays: 7,
    seed: 7132026,
    targetResponseHours: 12,
    cloudBase: 0.64,
    truth: (x, y) => Math.max(blob(x, y, 0.48, 0.46, 0.24), 0.72 - Math.abs(y - (0.35 + 0.14 * Math.sin(x * 10))) * 5),
    source: {
      name: "NASA GPM IMERG and OPERA DSWx (reference datasets)",
      url: "https://gpm.nasa.gov/data/imerg",
      usage: "Flood and cloud patterns are educational models inspired by precipitation and surface-water products; cells are not current observations. The MODIS flood product for Hurricane Beryl (Jul 2024) was checked but is almost entirely cloud-obscured, so it is not used."
    }
  },
  {
    slug: "phoenix",
    city: "Phoenix",
    category: "heat",
    objective: "Identify the hottest urban areas with sufficient accuracy to prioritize heat-response resources.",
    bbox: [-112.55, 33.15, -111.55, 33.85],
    defaultConstraints: { budgetM: 180, massKg: 380 },
    durationDays: 10,
    seed: 6022026,
    targetResponseHours: 24,
    cloudBase: 0.12,
    truth: (x, y) => Math.max(blob(x, y, 0.5, 0.53, 0.3), blob(x, y, 0.72, 0.38, 0.16)),
    source: {
      name: "NASA ECOSTRESS land-surface temperature (reference dataset)",
      url: "https://ecostress.jpl.nasa.gov/",
      usage: "Heat intensity is an educational model inspired by ECOSTRESS products; cells are not current observations."
    },
    observedSources: [{
      name: "NASA MODIS Aqua 8-day daytime land-surface temperature (via NASA GIBS)",
      url: "https://www.earthdata.nasa.gov/data/catalog/lpcloud-myd11a2-061",
      usage: "Heat cells are the hottest 40% of populated cells by observed daytime land-surface temperature, 11-18 Jul 2024. Cloud blocking and sensor detectability are modelled."
    }, {
      name: "NASA SEDAC Gridded Population of the World v4, 2020 density (via NASA GIBS)",
      url: "https://www.earthdata.nasa.gov/data/projects/gpw",
      usage: "Cells with at least 500 people per square kilometre count as populated neighbourhoods."
    }]
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

async function loadObserved(slug) {
  try {
    const observed = JSON.parse(await readFile(resolve(observedDirectory, `${slug}.json`), "utf8"));
    if (!observed.usable) return null;
    return new Map(observed.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function createMission(config, observed) {
  const [west, south, east, north] = config.bbox;
  const grid = [];
  for (let row = 0; row < 20; row += 1) {
    for (let column = 0; column < 20; column += 1) {
      const index = row * 20 + column;
      const x = (column + 0.5) / 20;
      const y = (row + 0.5) / 20;
      const observedCell = observed?.get(`${row}:${column}`);
      const signal = config.truth(x, y);
      const noise = (pseudoRandom(config.seed, index) - 0.5) * 0.16;
      const truth = observedCell ? observedCell.truth : signal + noise > 0.42 ? 1 : 0;
      grid.push({
        id: `r${String(row).padStart(2, "0")}c${String(column).padStart(2, "0")}`,
        row,
        column,
        lat: round(south + (north - south) * y, 5),
        lon: round(west + (east - west) * x, 5),
        truth,
        cloudProbability: round(Math.min(0.95, Math.max(0.02, config.cloudBase + (pseudoRandom(config.seed + 17, index) - 0.5) * 0.28)), 3),
        detectability: round(0.68 + pseudoRandom(config.seed + 31, index) * 0.3, 3),
        eventDay: observedCell
          ? observedCell.eventDay
          : truth && config.category !== "wildfire"
            ? Math.floor(pseudoRandom(config.seed + 47, index) * 2)
            : 0
      });
    }
  }
  if (observed && config.smokeNearObservedFire) addModelledSmoke(grid);

  return {
    slug: config.slug,
    city: config.city,
    category: config.category,
    objective: { en: config.objective },
    bbox: config.bbox,
    defaultConstraints: config.defaultConstraints,
    durationDays: config.durationDays,
    seed: config.seed,
    targetResponseHours: config.targetResponseHours,
    grid,
    sources: observed
      ? config.observedSources.map((source) => ({ ...source, accessedOn: "2026-11-14", provenance: "nasa-observed" }))
      : [{ ...config.source, accessedOn: "2026-11-14", provenance: "educational-model" }]
  };
}

// Modelled, not observed: smoke raises the chance that a look is blocked next to
// observed fire cells (+SMOKE_NEAR within one cell, +SMOKE_FAR within two cells),
// and active fires are strong thermal targets (detectability >= FIRE_DETECTABILITY).
const SMOKE_NEAR = 0.15;
const SMOKE_FAR = 0.08;
const FIRE_DETECTABILITY = 0.9;
function addModelledSmoke(grid) {
  const fires = grid.filter((cell) => cell.truth > 0.5);
  for (const cell of grid) {
    const distance = Math.min(...fires.map((fire) =>
      Math.max(Math.abs(fire.row - cell.row), Math.abs(fire.column - cell.column))));
    const smoke = distance === 0 ? 0 : distance <= 1 ? SMOKE_NEAR : distance <= 2 ? SMOKE_FAR : 0;
    cell.cloudProbability = round(Math.min(0.95, cell.cloudProbability + smoke), 3);
    if (distance === 0) cell.detectability = Math.max(cell.detectability, FIRE_DETECTABILITY);
  }
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

await mkdir(outputDirectory, { recursive: true });
const missions = await Promise.all(configurations.map(async (config) =>
  createMission(config, await loadObserved(config.slug))));
await Promise.all(missions.map((mission) =>
  writeFile(resolve(outputDirectory, `${mission.slug}.json`), `${JSON.stringify(mission, null, 2)}\n`)
));

// index.json is shared with other mission generators: replace only our entries.
const indexPath = resolve(outputDirectory, "index.json");
const existingIndex = await readFile(indexPath, "utf8").then(JSON.parse, () => []);
const summaries = new Map(missions.map(({ grid, ...mission }) => [mission.slug, { ...mission, gridCellCount: grid.length }]));
const index = existingIndex.map((entry) => summaries.get(entry.slug) ?? entry);
for (const [slug, summary] of summaries) {
  if (!existingIndex.some((entry) => entry.slug === slug)) index.push(summary);
}
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
