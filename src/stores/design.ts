import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import { designSchema } from "@/components/results/contracts";
import { partsCatalog } from "@/lib/sim/catalog";
import type { SatelliteDesign } from "@/types/game";

// Drafts may be incomplete, but they must still have a safe shape and known parts.
const knownOrEmpty = (parts: { id: string }[]) => (id: string) =>
  id === "" || parts.some((part) => part.id === id);
const draftSchema = designSchema.extend({
  instruments: designSchema.shape.instruments.element.array().max(3).refine(
    (ids) => new Set(ids).size === ids.length &&
      ids.every((id) => partsCatalog.instruments.some((part) => part.id === id)),
  ),
  orbit: designSchema.shape.orbit.refine(knownOrEmpty(partsCatalog.orbits)),
  solar: designSchema.shape.solar.refine(knownOrEmpty(partsCatalog.solar)),
  battery: designSchema.shape.battery.refine(knownOrEmpty(partsCatalog.batteries)),
  comm: designSchema.shape.comm.refine(knownOrEmpty(partsCatalog.communications)),
  storage: designSchema.shape.storage.refine(knownOrEmpty(partsCatalog.storage)),
});

interface DesignState {
  design: SatelliteDesign;
  update: (changes: Partial<SatelliteDesign>) => void;
}

export function createDesignStore(slug: string) {
  return createStore<DesignState>()(
    persist(
      (set) => ({
        design: {
          instruments: [],
          orbit: "",
          solar: "",
          battery: "",
          comm: "",
          groundStations: 1,
          storage: "",
        },
        update: (changes) => set(({ design }) => ({ design: { ...design, ...changes } })),
      }),
      {
        name: `mission-possible:design:${slug}`,
        storage: createJSONStorage(() => localStorage),
        partialize: ({ design }) => ({ design }),
        merge: (persisted, current) => {
          const raw = persisted && typeof persisted === "object"
            ? (persisted as { design?: unknown }).design
            : undefined;
          const parsed = draftSchema.safeParse(raw);
          return parsed.success ? { ...current, design: parsed.data } : current;
        },
        skipHydration: true,
      },
    ),
  );
}
