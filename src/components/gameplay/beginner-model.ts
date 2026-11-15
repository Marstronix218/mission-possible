import type { Mission, SatelliteDesign } from "@/types/game";
import { partsCatalog, summarizeResources } from "@/lib/sim";

export const modeKey = (slug: string) => `codeblue:mode:${slug}`;
export const sensorNames: Record<string, [string, string]> = {
  opt_hr: ["Camera", "Records detailed images in visible light."],
  tir: ["Heat sensor", "Measures thermal radiation from Earth's surface."],
  sar: ["Radar", "Uses radio waves to measure surface features."],
  pmw: ["Microwave sensor", "Measures naturally emitted microwave energy."],
  lidar: ["Laser altimeter", "Measures height using pulses of laser light."],
  grav: ["Gravity sensor", "Measures changes in Earth's gravity field."],
  pr: ["Rain radar", "Measures precipitation using radio waves."],
  msi: [
    "Multispectral camera",
    "Records reflected light in several wavelength bands.",
  ],
};
export function beginnerSensors(mission: Mission) {
  if (mission.category === "glacier") return ["opt_hr", "sar", "lidar"];
  if (mission.category === "drought") return ["msi", "pmw", "grav"];
  if (mission.category === "storm" || mission.category === "snow")
    return ["msi", "pmw", "pr"];
  return ["opt_hr", "tir", "sar"];
}
/** A supplied launch platform, not an optimal answer. All choices still use engine budgets. */
export function starterDesign(
  sensor: string,
  mission?: Mission,
): SatelliteDesign {
  const part = partsCatalog.instruments.find((p) => p.id === sensor);
  const design: SatelliteDesign = {
    instruments: part ? [sensor] : [],
    orbit: "sso_700",
    solar: (part?.powerW ?? 0) + 65 > 400 ? "solar_l" : "solar_m",
    battery: "battery_m",
    comm: "x_band",
    groundStations: 3,
    storage: "storage_128",
  };
  // Smaller mission budgets may need a lighter, cheaper supplied platform.
  // This is a real trade-off, not a change to scoring or sensor fit.
  if (
    mission &&
    summarizeResources(design, mission.defaultConstraints).costM >
      mission.defaultConstraints.budgetM
  ) {
    design.battery = "battery_s";
    design.groundStations = 1;
    design.comm = "s_band";
    if (
      summarizeResources(design, mission.defaultConstraints).costM >
      mission.defaultConstraints.budgetM
    )
      design.comm = "uhf";
  }
  return design;
}
export function constraintChecks(design: SatelliteDesign, mission: Mission) {
  const r = summarizeResources(design, mission.defaultConstraints);
  return [
    {
      label: "Power",
      good: r.powerGenW >= r.powerUseW,
      text: `${r.powerUseW} W used / ${r.powerGenW} W generated`,
      help: "A bigger solar array supplies more energy, but adds weight and cost.",
    },
    {
      label: "Weight",
      good: r.massKg <= mission.defaultConstraints.massKg,
      text: `${r.massKg} / ${mission.defaultConstraints.massKg} kg`,
      help: "The mission's rocket can only lift this much. Try a lighter part.",
    },
    {
      label: "Budget",
      good: r.costM <= mission.defaultConstraints.budgetM,
      text: `$${r.costM}M / $${mission.defaultConstraints.budgetM}M`,
      help: "Every installed part uses some of your mission budget.",
    },
    {
      label: "Data",
      good: r.dataGBPerDay <= r.downlinkGBPerDay + r.storageGB,
      text: `${r.dataGBPerDay} GB/day collected; ${r.downlinkGBPerDay} GB/day downlink; ${r.storageGB} GB storage`,
      help: "The radio sends observations during ground contact. Memory holds data between contacts.",
    },
  ];
}

export function neutralObstacle(mission: Mission) {
  if (mission.category === "wildfire")
    return "Smoke and clouds cover parts of the fire zone.";
  if (mission.category === "flood")
    return "Clouds cover parts of the flooded area.";
  if (mission.category === "heat")
    return "Some neighborhoods have hotter surfaces than others.";
  return "Choose how to observe the mission area from space.";
}
