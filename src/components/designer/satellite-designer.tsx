"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { partsCatalog } from "@/lib/sim/catalog";
import { summarizeResources } from "@/lib/sim/resources";
import { createDesignStore } from "@/stores/design";
import { draftKey } from "@/components/results/session";
import type { Mission, SatelliteDesign } from "@/types/game";

type Part = { id: string; name: string; costM: number; massKg: number };

function PartOptions<T extends Part>({ label, parts, selected, onSelect, specs, multiple = false }: {
  label: string;
  parts: T[];
  selected: string[];
  onSelect: (id: string) => void;
  specs: (part: T) => string;
  multiple?: boolean;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-3 font-semibold">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {parts.map((part) => (
          <label key={part.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-card">
            <input className="mt-1 accent-primary" type={multiple ? "checkbox" : "radio"} name={name}
              checked={selected.includes(part.id)} onChange={() => onSelect(part.id)}
              disabled={multiple && selected.length >= 3 && !selected.includes(part.id)} />
            <span>
              <span className="block font-semibold">{part.name}</span>
              <span className="block text-sm text-muted-foreground">${part.costM}M · {part.massKg} kg</span>
              <span className="block text-sm text-muted-foreground">{specs(part)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Gauge({ label, value, limit, detail, exceeded = value > limit }: {
  label: string; value: number; limit: number; detail: string; exceeded?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label className="font-semibold" htmlFor={id}>{label}</label>
      <meter id={id} className="block w-full accent-primary" min={0} max={Math.max(1, limit)} value={Math.min(value, limit)} />
      <p className={exceeded ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {detail}{exceeded && " · Limit exceeded"}
      </p>
    </div>
  );
}

export function SatelliteDesigner({ mission }: { mission: Mission }) {
  const router = useRouter();
  const [store] = useState(() => createDesignStore(mission.slug));
  const [ready, setReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const { design, update } = useStore(store);
  const constraints = mission.defaultConstraints;
  const resources = summarizeResources(design, constraints);
  const battery = partsCatalog.batteries.find((part) => part.id === design.battery);
  const dataLimit = resources.downlinkGBPerDay + resources.storageGB;

  useEffect(() => {
    async function restoreDraft() {
      try {
        await store.persist?.rehydrate();
      } catch {
        setError("The saved draft could not be loaded.");
      } finally {
        setReady(true);
      }
    }
    void restoreDraft();
  }, [store]);

  function select(field: "orbit" | "solar" | "battery" | "comm" | "storage") {
    return (id: string) => update({ [field]: id });
  }

  function launch() {
    if (launching || !ready || resources.violations.length) return;
    setLaunching(true);
    setError("");
    try {
      localStorage.setItem(draftKey(mission.slug), JSON.stringify(design));
      router.push(`/mission/${mission.slug}/run`);
    } catch {
      setError("Your draft could not be prepared for launch. Enable browser storage and try again.");
      setLaunching(false);
    }
  }

  return (
    <div>
      <Link className="text-primary underline" href={`/mission/${mission.slug}/brief`}>Mission briefing</Link>
      <h1 className="mt-4 text-4xl font-bold">{mission.city} satellite designer</h1>
      <p className="mt-2 text-muted-foreground">{mission.objective.en}</p>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <fieldset disabled={!ready || launching} className="min-w-0 space-y-8">
          <PartOptions label={`Instruments (${design.instruments.length}/3)`} parts={partsCatalog.instruments}
            selected={design.instruments} multiple specs={(part) => `${part.powerW} W · ${part.dataGBPerDay} GB/day`}
            onSelect={(id) => update({ instruments: design.instruments.includes(id)
              ? design.instruments.filter((instrument) => instrument !== id) : [...design.instruments, id] })} />
          <PartOptions label="Orbit" parts={partsCatalog.orbits} selected={[design.orbit]} onSelect={select("orbit")}
            specs={(part) => `Revisit factor ×${part.revisitFactor} · Swath factor ×${part.swathFactor}`} />
          <section className="space-y-4" aria-labelledby="power-heading">
            <h2 id="power-heading" className="text-xl font-bold">Power</h2>
            <PartOptions label="Solar array" parts={partsCatalog.solar} selected={[design.solar]} onSelect={select("solar")}
              specs={(part) => `${part.generationW} W generated`} />
            <PartOptions label="Battery" parts={partsCatalog.batteries} selected={[design.battery]} onSelect={select("battery")}
              specs={(part) => `${Math.round(part.eclipseContinuity * 100)}% eclipse continuity`} />
          </section>
          <section className="space-y-4" aria-labelledby="communication-heading">
            <h2 id="communication-heading" className="text-xl font-bold">Communication</h2>
            <PartOptions label="Transmitter" parts={partsCatalog.communications} selected={[design.comm]} onSelect={select("comm")}
              specs={(part) => `${part.powerW} W · ${part.rateGbps} Gbps`} />
            <label className="block font-semibold">Ground stations
              <select className="mt-2 block max-w-full rounded-md border border-border bg-card p-2" value={design.groundStations}
                onChange={(event) => update({ groundStations: Number(event.target.value) as SatelliteDesign["groundStations"] })}>
                {([1, 3, 5] as const).map((count) => (
                  <option key={count} value={count}>{count} · ${partsCatalog.groundStations[count].costM}M · {partsCatalog.groundStations[count].accessMinutesPerDay} min/day</option>
                ))}
              </select>
            </label>
          </section>
          <PartOptions label="Storage" parts={partsCatalog.storage} selected={[design.storage]} onSelect={select("storage")}
            specs={(part) => `${part.capacityGB} GB onboard`} />
        </fieldset>
        <aside aria-labelledby="resources" className="space-y-4 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-4">
          <h2 id="resources" className="text-xl font-bold">Resources</h2>
          <Gauge label="Budget" value={resources.costM} limit={constraints.budgetM} detail={`$${resources.costM}M / $${constraints.budgetM}M`} />
          <Gauge label="Mass" value={resources.massKg} limit={constraints.massKg} detail={`${resources.massKg} / ${constraints.massKg} kg`} />
          <Gauge label="Power" value={resources.powerUseW} limit={resources.powerGenW}
            detail={`${resources.powerUseW} W used / ${resources.powerGenW} W generated`} />
          {battery && <p className="text-sm text-muted-foreground">Battery: {Math.round(battery.eclipseContinuity * 100)}% eclipse continuity</p>}
          <Gauge label="Data" value={resources.dataGBPerDay} limit={dataLimit}
            detail={`${resources.dataGBPerDay} GB/day generated · ${resources.downlinkGBPerDay} GB/day downlink · ${resources.storageGB} GB onboard`} />
          <Gauge label="Estimated coverage" value={resources.coverageEstimate} limit={100} detail={`${resources.coverageEstimate}%`} />
          <div aria-live="polite">
            {ready && resources.violations.length > 0 && <>
              <p className="font-semibold text-destructive">Required before launch</p>
              <ul className="list-disc pl-5 text-sm">{resources.violations.map((message) => <li key={message}>{message}</li>)}</ul>
            </>}
          </div>
          {resources.warnings.length > 0 && <ul className="list-disc pl-5 text-sm">{resources.warnings.map((message) => <li key={message}>Warning: {message}</li>)}</ul>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <Button className="w-full" onClick={launch} disabled={!ready || launching || resources.violations.length > 0}>
            {launching ? "Launching…" : "Launch"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
