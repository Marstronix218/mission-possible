// UI-only fixtures. Replace with Ryohei's mission data after the contract is agreed.
export const categories = [
  "wildfire",
  "heat",
  "flood",
  "snow",
  "drought",
  "storm",
  "glacier",
  "volcano",
] as const;
export type Category = (typeof categories)[number];
export type MissionPreview = {
  slug: string;
  city: string;
  category: Category;
  coordinates: [number, number];
  objective: string;
  ready: boolean;
};
const rows: [string, Category, number, number][] = [
  ["Los Angeles", "wildfire", -118.24, 34.05],
  ["San Francisco", "heat", -122.42, 37.77],
  ["Phoenix", "heat", -112.07, 33.45],
  ["Chicago", "heat", -87.63, 41.88],
  ["Seattle", "flood", -122.33, 47.61],
  ["Houston", "flood", -95.37, 29.76],
  ["St. Louis", "flood", -90.2, 38.63],
  ["Atlanta", "flood", -84.39, 33.75],
  ["New York City", "flood", -74.01, 40.71],
  ["Denver", "snow", -104.99, 39.74],
  ["Minneapolis", "snow", -93.27, 44.98],
  ["Boston", "snow", -71.06, 42.36],
  ["Salt Lake City", "drought", -111.89, 40.76],
  ["Oklahoma City", "storm", -97.52, 35.47],
  ["Miami", "storm", -80.19, 25.76],
  ["New Orleans", "storm", -90.07, 29.95],
  ["Anchorage", "glacier", -149.9, 61.22],
  ["Hilo", "volcano", -155.09, 19.73],
];
const objectives: Record<Category, string> = {
  wildfire: "Detect active fires and deliver early warnings to communities.",
  heat: "Map extreme surface heat and find vulnerable neighborhoods.",
  flood: "Observe flood extent through clouds and deliver timely maps.",
  snow: "Measure snow cover to support winter hazard response.",
  drought: "Track changes in soil moisture over repeated observations.",
  storm: "Observe precipitation and help communities prepare for storms.",
  glacier: "Monitor glacier changes with precise observations.",
  volcano: "Detect thermal changes and monitor volcanic activity.",
};
export const missions: MissionPreview[] = rows.map(
  ([city, category, lon, lat]) => ({
    slug: city.toLowerCase().replaceAll(".", "").replaceAll(" ", "-"),
    city,
    category,
    coordinates: [lon, lat],
    objective: objectives[category],
    ready: ["Los Angeles", "Houston", "Phoenix"].includes(city),
  }),
);
export const categoryColors: Record<Category, string> = {
  wildfire: "#fb986f",
  heat: "#f6d879",
  flood: "#70c6fc",
  snow: "#d6e9f7",
  drought: "#c6ba80",
  storm: "#b6a0ff",
  glacier: "#77dfcf",
  volcano: "#f398bc",
};
