import { afterEach, describe, expect, it, vi } from "vitest";
import type { SatelliteDesign } from "@/types/game";
import { createDesignStore } from "./design";

const full: SatelliteDesign = {
  instruments: ["tir"], orbit: "sso_700", solar: "solar_m", battery: "battery_m",
  comm: "x_band", groundStations: 3, storage: "storage_128",
  decisions: { focus: "hazard", downlink: "fast", retask: { day: 2, quadrant: "nw" } },
};
const key = "mission-possible:design:los-angeles";

function memoryStorage(design: unknown) {
  const items = new Map([[key, JSON.stringify({ state: { design }, version: 0 })]]);
  vi.stubGlobal("localStorage", {
    getItem: (name: string) => items.get(name) ?? null,
    setItem: (name: string, value: string) => items.set(name, value),
    removeItem: (name: string) => items.delete(name),
  });
  return items;
}

afterEach(() => vi.unstubAllGlobals());

describe("designer draft persistence", () => {
  it("restores the complete retry design, including mission decisions", async () => {
    memoryStorage(full);
    const store = createDesignStore("los-angeles");
    await store.persist.rehydrate();
    expect(store.getState().design).toEqual(full);
    store.getState().update({ comm: "s_band" });
    expect(store.getState().design.decisions).toEqual(full.decisions);
  });

  it("restores an unfinished draft without filling in choices for the player", async () => {
    const draft = { instruments: [], orbit: "", solar: "solar_s", battery: "", comm: "", groundStations: 1, storage: "" };
    memoryStorage(draft);
    const store = createDesignStore("los-angeles");
    await store.persist.rehydrate();
    expect(store.getState().design).toEqual(draft);
  });

  it.each([
    null,
    { ...full, instruments: "tir" },
    { ...full, instruments: ["retired_sensor"] },
    { ...full, instruments: ["tir", "tir"] },
    { ...full, orbit: "retired_orbit" },
    { ...full, decisions: { downlink: "invented-mode" } },
  ])("keeps a safe empty design when a saved draft is malformed or obsolete", async (draft) => {
    memoryStorage(draft);
    const store = createDesignStore("los-angeles");
    const initial = store.getState().design;
    await store.persist.rehydrate();
    expect(store.getState().design).toEqual(initial);
    expect(typeof store.getState().update).toBe("function");
  });
});
