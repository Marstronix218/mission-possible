import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SatelliteDesign } from "@/types/game";

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
        skipHydration: true,
      },
    ),
  );
}
