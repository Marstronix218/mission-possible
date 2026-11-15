import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LaunchSequence } from "@/components/results/LaunchSequence";
import { LaunchScene } from "./LaunchScene";
import type { SatelliteDesign } from "@/types/game";
import {
  LAUNCH_PHASES,
  autoAdvanceDelay,
  buildLaunchSteps,
  deploymentConditions,
  orbitLabel,
  satelliteVisibility,
  phaseStates,
  sceneState,
  totalDurationMs,
} from "./launch-timeline";

const steps = buildLaunchSteps({ orbit: "sso_700", city: "Los Angeles" });
const indexOf = (id: string) => steps.findIndex((s) => s.id === id);

describe("launch timeline", () => {
  it("runs the four stages in order and every stage has steps", () => {
    const order = steps.map((s) => LAUNCH_PHASES.findIndex((p) => p.id === s.phase));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const phase of LAUNCH_PHASES)
      expect(steps.some((s) => s.phase === phase.id)).toBe(true);
  });

  it("counts down 3, 2, 1 before ignition and liftoff", () => {
    const countdown = steps.filter((s) => s.countdown).map((s) => s.countdown);
    expect(countdown).toEqual([3, 2, 1]);
    expect(indexOf("t1")).toBeLessThan(indexOf("ignition"));
    expect(indexOf("ignition")).toBeLessThan(indexOf("liftoff"));
  });

  it("names the player's orbit and target city", () => {
    expect(orbitLabel("sso_700")).toMatch(/Sun-synchronous orbit/);
    expect(steps[indexOf("orbit")].caption).toMatch(/sun-synchronous orbit/);
    expect(steps.at(-1)?.caption).toMatch(/Los Angeles/);
    expect(orbitLabel("unknown-orbit")).toBe("its planned orbit");
  });

  it("autoplays in a short, bounded time and never under reduced motion", () => {
    const total = totalDurationMs(steps);
    expect(total).toBeGreaterThan(12_000);
    expect(total).toBeLessThan(26_000);
    steps.forEach((s, i) => {
      expect(s.durationMs).toBeGreaterThan(0);
      expect(autoAdvanceDelay(steps, i, false)).toBe(s.durationMs);
      expect(autoAdvanceDelay(steps, i, true)).toBeNull();
    });
    expect(autoAdvanceDelay(steps, steps.length, false)).toBeNull();
  });

  it("marks stage progress as done, current and upcoming", () => {
    expect(phaseStates(steps, -1)).toEqual(["upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(phaseStates(steps, indexOf("liftoff"))).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(phaseStates(steps, steps.length - 1)).toEqual(["done", "done", "done", "current"]);
  });

  it("derives a physically ordered scene", () => {
    const ready = sceneState(steps, -1);
    expect(ready).toMatchObject({ satelliteLoaded: false, fairingClosed: false, engines: "off", rocketY: 0 });
    expect(sceneState(steps, indexOf("pad"))).toMatchObject({ satelliteLoaded: true, fairingClosed: true });
    expect(sceneState(steps, indexOf("ignition")).engines).toBe("ignite");
    expect(sceneState(steps, indexOf("liftoff")).rocketY).toBeLessThan(0);
    expect(sceneState(steps, indexOf("ascent")).altitude).toBeGreaterThan(0);
    expect(sceneState(steps, indexOf("ascent")).altitude).toBeLessThan(1);
    const fairing = sceneState(steps, indexOf("fairing-sep"));
    expect(fairing).toMatchObject({ fairingSeparated: true, fairingClosed: false, satelliteFree: false, engines: "off" });
    expect(sceneState(steps, indexOf("sat-sep")).panelsOpen).toBe(false);
    expect(sceneState(steps, indexOf("panels")).panelsOpen).toBe(true);
    expect(sceneState(steps, indexOf("target"))).toMatchObject({ inOrbit: true, onTarget: true, altitude: 1 });
  });
});

describe("satellite visibility", () => {
  const between = (from: string, to: string) =>
    steps.slice(indexOf(from) + 1, indexOf(to));

  it("is seen before launch only during integration on the pad", () => {
    expect(satelliteVisibility(null)).toBe("crane");
    expect(satelliteVisibility("load")).toBe("integrating");
    expect(satelliteVisibility("encapsulate")).toBe("enclosing");
  });

  it("is hidden for every step from fairing closed until fairing separation", () => {
    const sealed = between("encapsulate", "fairing-sep");
    expect(sealed.map((s) => s.id)).toEqual([
      "pad", "t3", "t2", "t1", "ignition", "liftoff", "ascent", "space",
    ]);
    for (const s of sealed) {
      expect(satelliteVisibility(s.id)).toBe("hidden");
      expect(sceneState(steps, indexOf(s.id)).satellite).toBe("hidden");
    }
  });

  it("is revealed inside the stage at fairing separation, then flies free", () => {
    expect(satelliteVisibility("fairing-sep")).toBe("inside-reveal");
    for (const s of steps.slice(indexOf("sat-sep")))
      expect(satelliteVisibility(s.id)).toBe("free");
  });

  it("separates the fairing only once the sky is black", () => {
    expect(sceneState(steps, indexOf("fairing-sep") - 1).altitude).toBe(1);
    expect(indexOf("space")).toBeLessThan(indexOf("fairing-sep"));
  });

  it("deploys in order: separation, then panels, then orbit, then the target", () => {
    const order = ["fairing-sep", "sat-sep", "panels", "orbit", "target"].map(indexOf);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(sceneState(steps, indexOf("fairing-sep")).stage).toBe("attached");
    expect(sceneState(steps, indexOf("sat-sep"))).toMatchObject({ stage: "separating", panelsOpen: false });
    expect(sceneState(steps, indexOf("panels"))).toMatchObject({ stage: "gone", panelsOpen: true });
  });

  it("names the deployment conditions from the player's orbit", () => {
    expect(deploymentConditions("leo_400")).toMatch(/about 400 km up/);
    expect(steps[indexOf("sat-sep")].caption).toContain(deploymentConditions("sso_700"));
    expect(steps[indexOf("sat-sep")].caption).toMatch(/about 700 km up/);
  });

  it("does not draw the satellite in the scene while it is sealed", () => {
    const design: SatelliteDesign = {
      instruments: ["tir"], orbit: "sso_700", solar: "solar_m", battery: "battery_m",
      comm: "x_band", groundStations: 3, storage: "storage_128",
    };
    const draw = (id: string) =>
      renderToStaticMarkup(
        createElement(LaunchScene, { design, scene: sceneState(steps, indexOf(id)), city: "Los Angeles" }),
      );
    for (const id of ["pad", "t1", "liftoff", "ascent", "space"]) expect(draw(id)).not.toContain("data-vis");
    expect(draw("load")).toContain('data-vis="integrating"');
    expect(draw("fairing-sep")).toContain('data-vis="inside-reveal"');
    expect(draw("panels")).toContain('data-vis="free"');
  });
});

describe("LaunchSequence markup", () => {
  const design: SatelliteDesign = {
    instruments: ["tir"],
    orbit: "sso_700",
    solar: "solar_m",
    battery: "battery_m",
    comm: "x_band",
    groundStations: 3,
    storage: "storage_128",
  };
  const render = (blocker?: string) =>
    renderToStaticMarkup(
      createElement(LaunchSequence, {
        events: [],
        design,
        reducedMotion: false,
        onComplete: () => {},
        city: "Los Angeles",
        responseHours: 8,
        blocker,
      }),
    );

  it("labels every stage in text, names the orbit and keeps the scene decorative", () => {
    const html = render();
    for (const phase of LAUNCH_PHASES) expect(html).toContain(phase.label);
    expect(html).toContain("not started");
    expect(html).toContain("Sun-synchronous orbit");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("LAUNCH SATELLITE");
  });

  it("replaces the launch command with the blocker", () => {
    const html = render("Over budget.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("LAUNCH SATELLITE");
  });
});
