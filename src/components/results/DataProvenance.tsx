"use client";
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import type { Mission } from "@/types/game";

interface NasaImageMeta {
  source?: string;
  observedOn?: string;
  usage?: string;
  url?: string;
}

function formatDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  return new Date(value.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    dateStyle: "long",
  });
}

/** One sentence on where the hazard map comes from, driven by mission.sources[].provenance. */
export function hazardProvenance(mission: Mission) {
  const observed = mission.sources.filter((s) => s.provenance === "nasa-observed");
  if (observed.length)
    return `The hazard map is based on NASA observations: ${observed
      .map((s) => `${s.name} (accessed ${formatDate(s.accessedOn)})`)
      .join("; ")}. Everything your satellite sees is simulated.`;
  const names = mission.sources.map((s) => s.name).join("; ");
  return `The hazard map is an educational model${names ? ` inspired by ${names}` : ""}, not a NASA observation. Everything your satellite sees is simulated.`;
}

/** NASA-observed image (left) vs what your simulated satellite saw (right). */
export function NasaVsSimulated({ mission, children }: { mission: Mission; children: ReactNode }) {
  const [meta, setMeta] = useState<NasaImageMeta | null>(null);
  const [metaError, setMetaError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/nasa/" + mission.slug + ".json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: unknown) => {
        if (!active) return;
        const d = (data ?? {}) as Record<string, unknown>;
        const text = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
        setMeta({ source: text("source"), observedOn: text("observedOn"), usage: text("usage"), url: text("url") });
      })
      .catch(() => {
        if (active) setMetaError(true);
      });
    return () => {
      active = false;
    };
  }, [mission.slug]);
  const observedOn = formatDate(meta?.observedOn);
  return (
    <section className="two-column" aria-label="NASA observed data compared with your simulated results">
      <div className="panel">
        <p className="eyebrow">NASA observed</p>
        <h2>Real satellite imagery</h2>
        <Image
          width={512}
          height={512}
          className="nasa-image"
          src={"/nasa/" + mission.slug + ".jpg"}
          alt={`NASA satellite image of ${mission.city}${observedOn ? ` observed on ${observedOn}` : ""}`}
        />
        <p className="text-sm">
          {meta
            ? `${meta.source ?? "NASA imagery"}${observedOn ? ` · observed ${observedOn}` : ""}.`
            : metaError
              ? "Image details could not be loaded."
              : "Loading image details…"}{" "}
          {meta?.usage}
        </p>
        <p className="text-sm">{hazardProvenance(mission)}</p>
        <ul className="text-sm">
          {mission.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name} ↗
              </a>{" "}
              · {s.provenance === "nasa-observed" ? "NASA observed" : "Educational model"} · {s.usage}
            </li>
          ))}
        </ul>
        <a href={"/nasa/" + mission.slug + ".json"}>Image source, date and bounding box ↗</a>
      </div>
      <div className="panel">
        <p className="eyebrow">Simulated by your satellite</p>
        <h2>What your satellite saw</h2>
        {children}
      </div>
    </section>
  );
}
