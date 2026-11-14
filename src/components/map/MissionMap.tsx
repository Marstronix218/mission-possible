"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadAttempts } from "../results/session";
import { api, backendAvailable } from "../results/cloud";
import { playableMissions } from "../results/missions";
import { ENGINE_VERSION } from "@/lib/sim";
import type { SimResult } from "@/types/game";
import { useReducedMotion } from "../results/use-reduced-motion";
import * as maplibregl from "maplibre-gl";
import {
  missions,
  categories,
  categoryColors,
  type Category,
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
  const [selected, setSelected] = useState(missions[0]);
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
        center: [-101, 38],
        zoom: 3.2,
        attributionControl: { compact: true },
      });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl(), "top-right");
      instance.on("error", () => setOffline(true));
    } catch {
      if (host.current)
        host.current.textContent =
          "Interactive map unavailable. Choose a mission from the city list below.";
      return;
    }
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const markers = missions
      .filter((m) => filter === "all" || m.category === filter)
      .map((m) => {
        const b = document.createElement("button");
        b.className = "city-pin";
        b.style.setProperty("--pin", categoryColors[m.category]);
        b.textContent = m.category.slice(0, 1).toUpperCase();
        b.title = m.city + " — " + m.category;
        b.setAttribute("aria-label", b.title);
        b.onclick = () => setSelected(m);
        b.onmouseenter = () => setSelected(m);
        b.onfocus = () => setSelected(m);
        return new maplibregl.Marker({ element: b })
          .setLngLat(m.coordinates)
          .addTo(map.current!);
      });
    return () => markers.forEach((m) => m.remove());
  }, [filter]);
  const visible = missions.filter(
    (m) => filter === "all" || m.category === filter,
  );
  return (
    <main id="main-content" tabIndex={-1}>
      <div className="eyebrow">MISSION CONTROL / 01 — EXPLORE</div>
      <div className="title-row">
        <div>
          <h1>
            Your community.
            <br />
            <em>Your mission.</em>
          </h1>
          <p className="intro">
            Start with a challenge on Earth. Discover what a satellite can do.
          </p>
        </div>
        <div className="stat">
          <strong>18</strong> cities to explore{" "}
          <span>8 observation challenges</span>
        </div>
      </div>
      <div className="filter" aria-label="Filter by disaster">
        <button
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          All missions · 18
        </button>
        {categories.map((c) => (
          <button
            key={c}
            aria-pressed={filter === c}
            onClick={() => {
              setFilter(c);
              if (selected.category !== c)
                setSelected(missions.find((m) => m.category === c)!);
            }}
          >
            <i style={{ background: categoryColors[c] }} />
            {c}
          </button>
        ))}
      </div>
      <div className="map-layout">
        <section className="map-panel" aria-label="USA mission map">
          <div ref={host} className="map-canvas" />
          <div className="map-caption">
            USA / EARTH OBSERVATION{" "}
            <span>Explore Alaska & Hawaii by zooming out</span>
          </div>
          {offline && (
            <p className="map-notice" role="status">
              Map tiles unavailable. All missions remain available in the city
              list below.
            </p>
          )}
          <div className="map-key">
            Letters + colors identify disaster categories. Select a city to
            explore.
          </div>
        </section>
        <aside className="mission-card">
          <div className="eyebrow">SELECTED MISSION</div>
          <span
            className="category"
            style={{ color: categoryColors[selected.category] }}
          >
            {selected.category}
          </span>
          <h2>{selected.city}</h2>
          <p>{selected.objective}</p>
          <dl>
            <div>
              <dt>Mission duration</dt>
              <dd>7 days</dd>
            </div>
            <div>
              <dt>Budget limit</dt>
              <dd>$250M</dd>
            </div>
            <div>
              <dt>Mass limit</dt>
              <dd>500 kg</dd>
            </div>
          </dl>
          {selected.ready ? (
            <Link
              className="primary"
              href={"/mission/" + selected.slug + "/brief"}
            >
              Explore mission <span>↗</span>
            </Link>
          ) : (
            <p className="notice">
              Mission preview only. The playable MVP covers Los Angeles,
              Houston, and Phoenix.
            </p>
          )}
          <small>
            3 playable missions · NASA imagery is available in results.
          </small>
        </aside>
      </div>
      {progressError && (
        <p role="status" className="notice">
          {progressError}
        </p>
      )}
      <section className="cities">
        <div className="section-heading">
          <h2>Choose your next challenge</h2>
          <span>{visible.length} missions</span>
        </div>
        <div className="city-grid">
          {visible.map((m) => (
            <button
              key={m.slug}
              aria-pressed={selected.slug === m.slug}
              onClick={() => {
                setSelected(m);
                map.current?.flyTo({
                  center: m.coordinates,
                  zoom: 4,
                  duration: reducedMotion ? 0 : 900,
                });
              }}
            >
              <span
                className="category"
                style={{ color: categoryColors[m.category] }}
              >
                {m.category}
              </span>
              <strong>{m.city}</strong>
              {best[m.slug] && (
                <span>
                  {best[m.slug].success ? "✓ Completed" : "△ In progress"} ·
                  Best {best[m.slug].score.toFixed(1)}/100
                </span>
              )}
              <span>{m.ready ? "Explore mission ↗" : "Preview"}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
