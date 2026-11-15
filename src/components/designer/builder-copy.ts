// Short, plain-language copy for the visual satellite builder and the briefing.
// Pure data. Scientific names live behind a "?" so the first read is the plain name.
// Copy describes consequences (what blocks a sensor, what it senses) and never
// says which part is "right" for a mission.
import type { Category } from "@/types/game";

export interface Consequence {
  /** "+" = a strength, "-" = a limit. Rendered as a symbol and a word, not color alone. */
  sign: "+" | "-";
  text: string;
}

export interface PartCopy {
  /** Plain name shown first, e.g. "RADAR". */
  name: string;
  /** What it does, in a few words. */
  tag: string;
  /** Scientific / catalog name, revealed on demand. */
  science: string;
  /** One sentence of how it works, revealed on demand. */
  more: string;
  /** Real-world consequences the player connects to the scene. */
  chips?: Consequence[];
}

export const partCopy: Record<string, PartCopy> = {
  // Sensors
  opt_hr: {
    name: "CAMERA", tag: "Sharp photos", science: "High-resolution optical camera",
    more: "Records sunlight bouncing off the ground, like a phone camera from space.",
    chips: [{ sign: "+", text: "Very sharp detail" }, { sign: "-", text: "Smoke & clouds block it" }, { sign: "-", text: "Needs daylight" }],
  },
  msi: {
    name: "COLOR VISION", tag: "See colors eyes can't", science: "Multispectral imager",
    more: "Splits reflected sunlight into many color bands, including infrared, to tell water, snow and plants apart.",
    chips: [{ sign: "+", text: "Tells water, snow & plants apart" }, { sign: "-", text: "Clouds block it" }, { sign: "-", text: "Needs daylight" }],
  },
  tir: {
    name: "HEAT VISION", tag: "Feel the heat", science: "Thermal infrared sensor",
    more: "Measures the infrared glow every warm surface gives off, so hot spots stand out.",
    chips: [{ sign: "+", text: "Senses surface heat" }, { sign: "+", text: "Day or night" }, { sign: "-", text: "Thick clouds block it" }],
  },
  pmw: {
    name: "MICROWAVE SENSE", tag: "Feel moisture", science: "Passive microwave radiometer",
    more: "Listens to faint natural microwaves from Earth. Water, rain and snow change the signal.",
    chips: [{ sign: "+", text: "Senses rain, soil water & snow" }, { sign: "+", text: "Works through clouds" }, { sign: "-", text: "Very blurry view" }],
  },
  sar: {
    name: "RADAR", tag: "See through clouds", science: "Synthetic aperture radar (SAR)",
    more: "Sends its own microwave pulses and builds a picture from the echoes. Calm water reflects pulses away, so it looks dark.",
    chips: [{ sign: "+", text: "Maps the ground through clouds" }, { sign: "+", text: "Day or night" }, { sign: "-", text: "Not a heat sensor" }, { sign: "-", text: "Power-hungry" }],
  },
  pr: {
    name: "RAIN RADAR", tag: "Look inside storms", science: "Precipitation radar",
    more: "Radar tuned to bounce off raindrops, so it measures how hard it rains inside clouds.",
    chips: [{ sign: "+", text: "Measures rain inside clouds" }, { sign: "+", text: "Day or night" }, { sign: "-", text: "Poor at mapping the ground" }],
  },
  lidar: {
    name: "LASER RULER", tag: "Measure height", science: "Laser altimeter (lidar)",
    more: "Times laser pulses to the surface and back to measure height very precisely.",
    chips: [{ sign: "+", text: "Precise height measurements" }, { sign: "-", text: "Clouds block it" }, { sign: "-", text: "Sees only a thin line" }],
  },
  grav: {
    name: "GRAVITY SCALE", tag: "Weigh hidden water", science: "Gravity mission package (gravimetry)",
    more: "Senses tiny changes in Earth's gravity as large amounts of water move, even underground.",
    chips: [{ sign: "+", text: "Senses water underground" }, { sign: "+", text: "Clouds don't matter" }, { sign: "-", text: "Extremely blurry" }],
  },
  // Orbits
  leo_400: {
    name: "LOW & CLOSE", tag: "Sharpest view", science: "Low Earth orbit (about 400 km up)",
    more: "Close to the ground, so details are sharp, but each pass sees a narrow strip.",
  },
  sso_700: {
    name: "SAME SUN TIME", tag: "Consistent lighting", science: "Sun-synchronous orbit (about 700 km up)",
    more: "Keeps a similar local Sun time on each pass, so lighting stays consistent.",
  },
  meo_tilt: {
    name: "HIGH & TILTED", tag: "Wide view", science: "Inclined orbit (about 1,200 km up)",
    more: "Higher up, so each pass sees more ground, with less detail and longer waits between passes.",
  },
  geo: {
    name: "PARKED FAR AWAY", tag: "Always watching", science: "Geostationary orbit (about 35,786 km up)",
    more: "Circles once a day, matching Earth's spin, so it hovers over one spot. From that far, images are blurry.",
  },
  // Radios
  uhf: { name: "WHISPER", tag: "Slow & cheap", science: "UHF radio (0.1 Gbps)", more: "A simple radio. Data trickles home slowly." },
  s_band: { name: "CHAT", tag: "Steady & reliable", science: "S-band radio (0.5 Gbps)", more: "A dependable radio used by many satellites for commands and small files." },
  x_band: { name: "FAST LINK", tag: "Fast downloads", science: "X-band radio (2 Gbps)", more: "The radio most Earth-observing satellites use to send images home." },
  ka_band: { name: "FIREHOSE", tag: "Huge downloads", science: "Ka-band radio (8 Gbps)", more: "A very high-frequency radio that moves huge files, but needs more power." },
  // Solar
  solar_s: { name: "SMALL WINGS", tag: "Light & cheap", science: "Small solar array (150 W)", more: "Solar cells turn sunlight into electricity." },
  solar_m: { name: "MEDIUM WINGS", tag: "Solid power", science: "Medium solar array (400 W)", more: "Solar cells turn sunlight into electricity." },
  solar_l: { name: "BIG WINGS", tag: "Lots of power", science: "Large solar array (800 W)", more: "Solar cells turn sunlight into electricity." },
  // Batteries
  battery_s: { name: "SMALL BATTERY", tag: "Often naps in shadow", science: "Small battery", more: "Part of every orbit is in Earth's shadow, where panels make no power." },
  battery_m: { name: "MEDIUM BATTERY", tag: "Mostly awake in shadow", science: "Medium battery", more: "Part of every orbit is in Earth's shadow, where panels make no power." },
  battery_l: { name: "BIG BATTERY", tag: "Awake in shadow", science: "Large battery", more: "Part of every orbit is in Earth's shadow, where panels make no power." },
  // Storage
  storage_32: { name: "POCKET", tag: "Small memory", science: "32 GB onboard storage", more: "Holds data until an antenna on Earth is in view." },
  storage_128: { name: "BACKPACK", tag: "Medium memory", science: "128 GB onboard storage", more: "Holds data until an antenna on Earth is in view." },
  storage_512: { name: "VAULT", tag: "Huge memory", science: "512 GB onboard storage", more: "Holds data until an antenna on Earth is in view." },
};

export const stationCopy: Record<1 | 3 | 5, { name: string; tag: string }> = {
  1: { name: "1 DISH", tag: "Short daily chats" },
  3: { name: "3 DISHES", tag: "Several chats a day" },
  5: { name: "5 DISHES", tag: "Frequent chats" },
};

/** The one-line challenge on the briefing, changed by the hazard. */
export const challengeLine: Record<Category, string> = {
  wildfire: "Find the fire through the smoke.",
  flood: "Map the water hiding under the clouds.",
  heat: "Pinpoint the hottest city blocks.",
  snow: "Track where the snow piled up.",
  drought: "Find where the water has gone.",
  storm: "Look inside the storm.",
  glacier: "Measure how fast the ice is shrinking.",
  volcano: "Watch the volcano through the ash.",
};

export const hazardEmoji: Record<Category, string> = {
  wildfire: "🔥", flood: "🌊", heat: "🌡️", snow: "❄️", drought: "🏜️", storm: "🌀", glacier: "🧊", volcano: "🌋",
};
