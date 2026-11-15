// Plain-language explanations of every satellite part. Pure data + helpers.
// Numeric specs come from data/parts.json via the sim catalog; this module
// only explains what each part *does* for the player.
import type { Category, InstrumentPart } from "@/types/game";

export type PartSlot = "instruments" | "orbit" | "solar" | "battery" | "comm" | "storage" | "groundStations";

export interface PartExplainer {
  /** What the part does, in one short sentence a 12-year-old can follow. */
  does: string;
  /** The main upside. */
  good: string;
  /** The main downside / trade-off. */
  bad: string;
}

export interface SlotExplainer {
  /** Friendly name for the slot ("Eyes", "Path", ...). */
  title: string;
  /** Question the player answers in this step. */
  question: string;
  /** Why this slot matters, in one sentence. */
  why: string;
  /** What goes wrong in the mission if this slot is under-built. */
  ifWeak: string;
}

export const slotExplainers: Record<PartSlot, SlotExplainer> = {
  instruments: {
    title: "Sensors (the eyes)",
    question: "What should your satellite look with?",
    why: "Each sensor sees a different kind of signal. Only some of them can see the hazard in this mission.",
    ifWeak: "The satellite flies over the hazard but can't tell it is there.",
  },
  orbit: {
    title: "Orbit (the path)",
    question: "How should your satellite circle the Earth?",
    why: "The orbit sets how often you pass over the city, how wide a strip you see, and how sharp the view is.",
    ifWeak: "Long gaps between passes, so the hazard spreads before you look again.",
  },
  solar: {
    title: "Solar array (power in)",
    question: "How much power should you collect?",
    why: "Every sensor and radio uses power. If they need more than the panels make, nothing turns on.",
    ifWeak: "Sensors switch off to save power and observations are skipped.",
  },
  battery: {
    title: "Battery (power at night)",
    question: "How well should the satellite keep working in Earth's shadow?",
    why: "Part of every orbit is in shadow. The battery keeps instruments running there.",
    ifWeak: "Observations pause in the shadow and some passes are lost.",
  },
  comm: {
    title: "Radio (the voice)",
    question: "How fast should data come home?",
    why: "Finding the hazard is only half the job. The data has to reach the ground before the deadline.",
    ifWeak: "The satellite sees the hazard, but the data arrives too late to help.",
  },
  groundStations: {
    title: "Ground stations (the ears)",
    question: "How many antennas on Earth can listen?",
    why: "More stations mean more chances each day to send data down.",
    ifWeak: "Data waits on board for hours until the next station comes into view.",
  },
  storage: {
    title: "Storage (the memory)",
    question: "How much data can wait on board?",
    why: "When no station is in view, observations are stored until the next contact.",
    ifWeak: "Storage fills up and new observations are thrown away.",
  },
};

export const partExplainers: Record<string, PartExplainer> = {
  // Instruments
  opt_hr: { does: "Takes sharp color photos, like a phone camera from space.", good: "Very detailed images.", bad: "Blind through smoke, clouds and darkness. Lots of data to send." },
  msi: { does: "Sees colors people can't see, like plant health and water.", good: "Good for snow, water and land changes.", bad: "Blocked by clouds." },
  tir: { does: "Measures heat. Fires and hot pavement glow brightly.", good: "Spots fires and heat through smoke, day or night.", bad: "Thick clouds still block it." },
  pmw: { does: "Listens to faint natural microwave signals from Earth.", good: "Works through clouds. Tracks rain, soil moisture and snow.", bad: "Blurry: can't see small details." },
  sar: { does: "Bounces radar pulses off the ground and makes an image from the echoes.", good: "Sees through clouds, day or night. Great for floods.", bad: "Heavy, expensive and needs a lot of power." },
  pr: { does: "Radar that measures rain inside storm clouds.", good: "Sees inside storms.", bad: "Heavy and power-hungry. Poor at mapping the ground." },
  lidar: { does: "Fires laser pulses to measure height very precisely.", good: "Measures ice and terrain height to centimeters.", bad: "Blocked by clouds. Only sees a narrow line." },
  grav: { does: "Senses tiny changes in Earth's gravity caused by moving water.", good: "Tracks underground water loss in droughts.", bad: "Very blurry and very heavy." },
  // Orbits
  leo_400: { does: "Flies low and fast, close to the ground.", good: "The sharpest view.", bad: "Sees a narrow strip and wears out sooner." },
  sso_700: { does: "Passes over at the same local time every day.", good: "Balanced: a good view, a wide strip and reliable.", bad: "A middle choice that isn't best at anything." },
  meo_tilt: { does: "Flies higher on a tilted path.", good: "Sees a wide area.", bad: "Less detail, and it returns less often." },
  geo: { does: "Hovers over one spot, very far away.", good: "Watches the same place constantly.", bad: "Far away, so images are very blurry. Very expensive." },
  // Power
  solar_s: { does: "Small panels.", good: "Cheap and light.", bad: "Only enough power for a small sensor." },
  solar_m: { does: "Medium panels.", good: "Enough power for most sensor setups.", bad: "Not enough for radar." },
  solar_l: { does: "Large panels.", good: "Can power even radar.", bad: "Heavy and expensive." },
  battery_s: { does: "A small battery.", good: "Light and cheap.", bad: "Sensors often pause in Earth's shadow." },
  battery_m: { does: "A medium battery.", good: "Keeps most passes running.", bad: "A few passes are still lost in shadow." },
  battery_l: { does: "A large battery.", good: "Keeps running almost all the time.", bad: "Heavy." },
  // Comms
  uhf: { does: "A slow, simple radio.", good: "Cheap and uses little power.", bad: "Data trickles home very slowly." },
  s_band: { does: "A moderate radio.", good: "Reliable and affordable.", bad: "Too slow for big image files." },
  x_band: { does: "A fast radio used by most Earth-observing satellites.", good: "Fast enough for most missions.", bad: "Uses more power." },
  ka_band: { does: "A very fast radio.", good: "Sends huge amounts of data quickly.", bad: "Expensive and power-hungry." },
  // Storage
  storage_32: { does: "Small memory.", good: "Cheap.", bad: "Fills up fast when stations are out of view." },
  storage_128: { does: "Medium memory.", good: "Holds about a day of typical data.", bad: "Can overflow with radar or high-res cameras." },
  storage_512: { does: "Large memory.", good: "Almost never fills up.", bad: "Costs more." },
};

export const groundStationExplainers: Record<1 | 3 | 5, PartExplainer> = {
  1: { does: "One antenna on Earth.", good: "Cheapest.", bad: "Only a few minutes of contact per day." },
  3: { does: "Three antennas around the world.", good: "Several contacts per day.", bad: "Costs more." },
  5: { does: "Five antennas around the world.", good: "Frequent contact, so data comes home fast.", bad: "The most expensive option." },
};

export type FitVerdict = "great" | "partial" | "blind";

/** How well an instrument can see a hazard category, from the real catalog fit values. */
export function instrumentFit(part: InstrumentPart, category: Category): { verdict: FitVerdict; label: string; fit: number } {
  const fit = part.categoryFit[category] ?? 0;
  if (fit >= 0.85) return { verdict: "great", label: "Sees this hazard clearly", fit };
  if (fit >= 0.5) return { verdict: "partial", label: "Partly sees this hazard", fit };
  return { verdict: "blind", label: "Can't see this hazard", fit };
}
