"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadAttempts } from "../results/session";
import { api, backendAvailable } from "../results/cloud";
import { playableMissions } from "../results/missions";
import { ENGINE_VERSION } from "@/lib/sim";
import type { Category, SimResult } from "@/types/game";
import { categoryLabel } from "@/lib/story/missions";
import { useReducedMotion } from "../results/use-reduced-motion";
import * as maplibregl from "maplibre-gl";
import EmergencyHero from "./EmergencyHero";
import MissionJourney from "./MissionJourney";
import {
  missions,
  featuredMission,
  categories,
  categoryColors,
  categorySymbols,
  type MapMission,
} from "./missions";
export default function MissionMap() {
  const [best, setBest] = useState<
    Record<string, { score: number; success: boolean }>
  >({});
  const [progressError, setProgressError] = useState("");
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const rows = backendAvailable
          ? (
              await Promise.all(
                playableMissions.map(async (mission) =>
                  (
                    await api<
                      {
                        mission_slug: string;
                        result: SimResult;
                        classroom_id: string | null;
                      }[]
                    >("history", { missionSlug: mission.slug })
                  ).map((a) => ({
                    slug: a.mission_slug,
                    result: a.result,
                    classroomId: a.classroom_id ?? undefined,
                  })),
                ),
              )
            ).flat()
          : loadAttempts();
        const scores: Record<string, { score: number; success: boolean }> = {};
        for (const a of rows.filter(
          (a) => !a.classroomId && a.result.engineVersion === ENGINE_VERSION,
        ))
          if (!scores[a.slug] || a.result.score.total > scores[a.slug].score)
            scores[a.slug] = {
              score: a.result.score.total,
              success: a.result.success,
            };
        if (active) {
          setBest(scores);
          setProgressError("");
        }
      } catch {
        if (active) {
          setBest({});
          setProgressError(
            "Your progress could not be loaded. Mission selection is still available.",
          );
        }
      }
    }
    void refresh();
    const changed = () => {
      void refresh();
    };
    window.addEventListener("storage", changed);
    window.addEventListener("mission-possible:mock-updated", changed);
    return () => {
      active = false;
      window.removeEventListener("storage", changed);
      window.removeEventListener("mission-possible:mock-updated", changed);
    };
  }, []);
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedSlug, setSelectedSlug] = useState(featuredMission?.slug);
  const [heroSlug, setHeroSlug] = useState(featuredMission?.slug);
  const hero = missions.find((m) => m.slug === heroSlug);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let instance: maplibregl.Map;
    try {
      maplibregl.setWorkerUrl("/maps/maplibre-worker.mjs");
      instance = new maplibregl.Map({
        container: host.current,
        style: {
          version: 8,
          sources: {
            land: {
              type: "geojson",
              data: "/maps/north-america.geojson",
              attribution: "Natural Earth · Public domain",
            },
          },
          layers: [
            {
              id: "ocean",
              type: "background",
              paint: { "background-color": "#0c202e" },
            },
            {
              id: "land",
              type: "fill",
              source: "land",
              paint: { "fill-color": "#213947" },
            },
            {
              id: "coast",
              type: "line",
              source: "land",
              paint: { "line-color": "#527080", "line-width": 1 },
            },
          ],
        },
        center: [-104, 33],
        zoom: 3.4,
        attributionControl: { compact: true },
      });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl(), "top-right");
      instance.on("error", () => setOffline(true));
    } catch {
      if (host.current)
        host.current.textContent =
          "Interactive map unavailable. Every mission is listed below.";
      return;
    }
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);
  const visible = missions.filter(
    (m) => filter === "all" || m.category === filter,
  );
  useEffect(() => {
    if (!map.current) return;
    const markers = missions
      .filter((m) => filter === "all" || m.category === filter)
      .map((m) => {
        const b = document.createElement("button");
        b.className = "city-pin";
        b.style.setProperty("--pin", categoryColors[m.category]);
        b.textContent = categorySymbols[m.category];
        b.title = `${m.city}: ${categoryLabel[m.category]}, ${m.deadlineHours}-hour deadline`;
        b.setAttribute("aria-label", b.title);
        b.onclick = () => {
          setSelectedSlug(m.slug);
          document.getElementById("mission-" + m.slug)?.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: "nearest",
          });
        };
        b.onfocus = () => setSelectedSlug(m.slug);
        return new maplibregl.Marker({ element: b })
          .setLngLat(m.coordinates)
          .addTo(map.current!);
      });
    return () => markers.forEach((m) => m.remove());
  }, [filter, reducedMotion]);
  const card = (m: MapMission) => {
    const isSelected = m.slug === selectedSlug;
    const record = best[m.slug];
    return (
      <li
        key={m.slug}
        id={"mission-" + m.slug}
        className={
          "flex flex-col rounded-lg border bg-[#122430] p-4 text-[#eaf1f5] " +
          (isSelected
            ? "border-[#9ae6d3] shadow-[0_0_0_1px_#9ae6d3]"
            : "border-[#2a3d4b]")
        }
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span
            className="category"
            style={{ color: categoryColors[m.category] }}
          >
            <span aria-hidden="true">{categorySymbols[m.category]} </span>
            {categoryLabel[m.category]}
          </span>
          <span className="rounded-full border border-[#617a9a] px-2 py-0.5 font-mono text-xs">
            <span aria-hidden="true">⏱ </span>
            {m.deadlineHours} h deadline
          </span>
        </div>
        <h4 className="m-0 text-xl font-medium">{m.city}</h4>
        <p className="mt-1 mb-1 text-sm leading-snug text-[#eaf1f5]">
          {m.headline}
        </p>
        <p className="mt-0 mb-3 text-sm">{m.goal}</p>
        <p className="mt-auto mb-3 text-xs">
          {record ? (
            <>
              <span aria-hidden="true">{record.success ? "✓ " : "△ "}</span>
              {record.success ? "Completed" : "In progress"} · Best{" "}
              {record.score.toFixed(1)}/100
            </>
          ) : (
            "Not attempted yet"
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="primary"
            href={"/mission/" + m.slug + "/brief"}
            aria-label={`${record ? "Replay" : "Start"} the ${m.city} mission`}
          >
            {record ? "Replay mission" : "Start mission"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
          <button
            type="button"
            aria-pressed={isSelected}
            aria-label={`Show ${m.city} on the map`}
            onClick={() => {
              setSelectedSlug(m.slug);
              map.current?.flyTo({
                center: m.coordinates,
                zoom: 5,
                duration: reducedMotion ? 0 : 900,
              });
              host.current?.scrollIntoView({
                behavior: reducedMotion ? "auto" : "smooth",
                block: "nearest",
              });
            }}
          >
            {isSelected ? "Shown on map" : "Show on map"}
          </button>
        </div>
      </li>
    );
  };
  const groups = categories
    .filter((c) => filter === "all" || c === filter)
    .map((c) => ({ c, items: visible.filter((m) => m.category === c) }));
  return (
    <main id="main-content" tabIndex={-1}>
      {hero && (
        <EmergencyHero
          mission={hero}
          onNext={
            missions.length > 1
              ? () => {
                  const i = missions.findIndex((m) => m.slug === heroSlug);
                  setHeroSlug(missions[(i + 1) % missions.length].slug);
                }
              : undefined
          }
        />
      )}
      <MissionJourney />
      <section aria-labelledby="missions-heading" className="mt-12">
        <div className="section-heading flex-wrap">
          <h2 id="missions-heading" className="mb-1">
            Emergencies you can respond to
          </h2>
          <span>
            {missions.length} {missions.length === 1 ? "city" : "cities"} ·{" "}
            {categories.length} hazard{" "}
            {categories.length === 1 ? "type" : "types"}
          </span>
        </div>
        <p className="mt-0 mb-4 text-sm">
          Each hazard needs a different kind of satellite. Start with the
          featured emergency, then take on the rest. All missions are training
          scenarios.
        </p>
        <div className="filter mt-0" role="group" aria-label="Filter by hazard">
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All · {missions.length}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              aria-pressed={filter === c}
              onClick={() => {
                setFilter(c);
                const first = missions.find((m) => m.category === c);
                if (first) setSelectedSlug(first.slug);
              }}
            >
              <span aria-hidden="true" style={{ color: categoryColors[c] }}>
                {categorySymbols[c]}{" "}
              </span>
              {categoryLabel[c]} ·{" "}
              {missions.filter((m) => m.category === c).length}
            </button>
          ))}
        </div>
        {progressError && (
          <p role="status" className="notice">
            {progressError}
          </p>
        )}
        <section
          className="map-panel min-h-[300px] sm:min-h-[400px]"
          aria-label="Mission locations map"
        >
          <div ref={host} className="map-canvas" />
          <div className="map-caption">
            MISSION LOCATIONS{" "}
            <span>Select a marker to jump to its mission</span>
          </div>
          {offline && (
            <p className="map-notice" role="status">
              Map tiles unavailable. Every mission is listed below the map.
            </p>
          )}
        </section>
        {groups.map(({ c, items }) => (
          <section key={c} aria-labelledby={"group-" + c} className="mt-8">
            <h3
              id={"group-" + c}
              className="mt-0 mb-3 text-lg"
              style={{ color: categoryColors[c] }}
            >
              <span aria-hidden="true">{categorySymbols[c]} </span>
              {categoryLabel[c]}{" "}
              <span className="text-sm text-[#a5bac9]">
                · {items.length} {items.length === 1 ? "city" : "cities"}
              </span>
            </h3>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(card)}
            </ul>
          </section>
        ))}
      </section>
    </main>
  );
}
