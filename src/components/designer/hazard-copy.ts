import type { Category, InstrumentKind } from "@/types/game";
import type { FitVerdict } from "@/lib/story/parts";

export interface HazardCopy {
  /** Short name used in labels ("wildfire", "volcanic eruption"). */
  label: string;
  /** What the sensor is looking for, used when a mission story has none. */
  noun: string;
  /** Fit badge text for each verdict. */
  fit: Record<FitVerdict, string>;
  /** Replaces the "great" badge for sensor kinds that see the hazard a different way. */
  greatByKind?: Partial<Record<InstrumentKind, string>>;
  /** What blocks the view in the preview. */
  veil: string;
  /** Hazard color on the preview map. */
  color: string;
}

export const hazardCopy: Record<Category, HazardCopy> = {
  wildfire: {
    label: "wildfire", noun: "active fire", veil: "smoke or clouds", color: "#fb923c",
    fit: { great: "Sees the fire's heat", partial: "Partly sees the fire", blind: "Can't see the fire" },
  },
  flood: {
    label: "flood", noun: "flood water", veil: "storm clouds", color: "#60a5fa",
    fit: { great: "Maps flood water", partial: "Partly maps flood water", blind: "Can't map the flooding" },
  },
  heat: {
    label: "extreme heat", noun: "extreme heat", veil: "clouds", color: "#f87171",
    fit: { great: "Measures street heat", partial: "Roughly measures heat", blind: "Can't measure the heat" },
  },
  snow: {
    label: "snowstorm", noun: "snow cover", veil: "clouds", color: "#7dd3fc",
    fit: { great: "Sees snow cover", partial: "Partly sees snow cover", blind: "Can't see the snow" },
  },
  drought: {
    label: "drought", noun: "dry ground", veil: "clouds", color: "#d97706",
    fit: { great: "Senses missing water", partial: "Partly senses dry ground", blind: "Can't sense the drought" },
  },
  storm: {
    label: "storm", noun: "heavy rain", veil: "thick storm clouds", color: "#a78bfa",
    fit: { great: "Sees inside the storm", partial: "Partly sees the storm", blind: "Can't see inside the storm" },
  },
  glacier: {
    label: "melting glacier", noun: "ice loss", veil: "clouds", color: "#67e8f9",
    fit: { great: "Measures the ice", partial: "Partly measures the ice", blind: "Can't measure the ice" },
  },
  volcano: {
    label: "volcanic eruption", noun: "volcanic activity", veil: "ash and clouds", color: "#ef4444",
    fit: { great: "Sees lava heat", partial: "Partly sees the eruption", blind: "Can't see the eruption" },
    greatByKind: { radar: "Sees the volcano's ground move" },
  },
};
