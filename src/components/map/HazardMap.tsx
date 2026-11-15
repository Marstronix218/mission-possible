"use client";
// Heavy part of the homepage: MapLibre + NASA GIBS imagery. Loaded with
// next/dynamic only when the map section scrolls near the viewport.
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { categoryLabel } from "@/lib/story/missions";
import HazardIcon from "./HazardIcon";
import Stars from "./Stars";
import {
  briefHref,
  progressLabel,
  starsFor,
  type BestRecord,
  type MapMission,
} from "./missions";
import styles from "./MissionMap.module.css";

/** NASA GIBS Web Mercator tiles — public, keyless, attribution required. */
const GIBS_TILES =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";

export default function HazardMap({
  missions,
  best,
}: {
  missions: MapMission[];
  best: Record<string, BestRecord>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState<"none" | "tiles" | "map">("none");
  const [selected, setSelected] = useState<string | null>(null);
  const playRef = useRef<HTMLAnchorElement>(null);
  // Detached DOM nodes that MapLibre positions; React renders into them.
  const [markerHosts] = useState(
    () => new Map(missions.map((m) => [m.slug, document.createElement("div")])),
  );
  const [popupHost] = useState(() => document.createElement("div"));
  const popup = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!host.current) return;
    let instance: maplibregl.Map;
    try {
      maplibregl.setWorkerUrl("/maps/maplibre-worker.mjs");
      const lngs = missions.map((m) => m.coordinates[0]);
      const lats = missions.map((m) => m.coordinates[1]);
      instance = new maplibregl.Map({
        container: host.current,
        style: {
          version: 8,
          sources: {
            gibs: {
              type: "raster",
              tiles: [GIBS_TILES],
              tileSize: 256,
              maxzoom: 8,
              attribution:
                '<a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">Imagery: NASA EOSDIS GIBS / Blue Marble</a>',
            },
          },
          layers: [
            {
              id: "space",
              type: "background",
              paint: { "background-color": "#070a24" },
            },
            {
              id: "earth",
              type: "raster",
              source: "gibs",
              paint: {
                "raster-saturation": 0.25,
                "raster-contrast": 0.08,
                "raster-brightness-min": 0.06,
              },
            },
          ],
        },
        bounds: [
          [Math.min(...lngs) - 4, Math.min(...lats) - 4],
          [Math.max(...lngs) + 4, Math.max(...lats) + 4],
        ],
        fitBoundsOptions: { padding: 30 },
        minZoom: 1,
        maxZoom: 7.9,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures: true,
        attributionControl: { compact: false },
      });
    } catch {
      queueMicrotask(() => setFailed("map"));
      return;
    }
    instance.touchZoomRotate.disableRotation();
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    instance.on("load", () => setMap(instance));
    instance.on("error", () => setFailed((f) => (f === "none" ? "tiles" : f)));
    instance.on("click", (e) => {
      const target = e.originalEvent.target as Element | null;
      if (!target?.closest(".maplibregl-marker, .maplibregl-popup"))
        setSelected(null);
    });
    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
      offset: 28,
      maxWidth: "260px",
      className: styles.popup,
    }).setDOMContent(popupHost);
    return () => {
      popup.current?.remove();
      instance.remove();
      setMap(null);
    };
  }, [missions, popupHost]);

  // Place one marker per mission once the style is ready.
  useEffect(() => {
    if (!map) return;
    const placed = missions.map((m) =>
      new maplibregl.Marker({
        element: markerHosts.get(m.slug)!,
        anchor: "center",
      })
        .setLngLat(m.coordinates)
        .addTo(map),
    );
    return () => placed.forEach((marker) => marker.remove());
  }, [map, missions, markerHosts]);

  const current = missions.find((m) => m.slug === selected);
  useEffect(() => {
    if (!map || !popup.current) return;
    if (current) popup.current.setLngLat(current.coordinates).addTo(map);
    else popup.current.remove();
  }, [map, current]);

  const closeAndReturn = () => {
    const slug = selected;
    setSelected(null);
    if (slug) markerHosts.get(slug)?.querySelector("button")?.focus();
  };

  return (
    <>
      <div ref={host} className="map-canvas" />
      {failed !== "none" && (
        <p className="map-notice" role="status">
          {failed === "map"
            ? "Map unavailable — every mission is listed below."
            : "Some imagery could not load. Missions still work."}
        </p>
      )}
      {missions.map((m) => {
        const el = markerHosts.get(m.slug);
        if (!el) return null;
        const record = best[m.slug];
        return createPortal(
          <button
            type="button"
            className={`${styles.marker} hz-${m.category}`}
            data-category={m.category}
            aria-pressed={selected === m.slug}
            aria-label={`${m.city}: ${categoryLabel[m.category]}, ${m.deadlineHours}-hour deadline. ${progressLabel(record)}.`}
            onMouseEnter={() => setSelected(m.slug)}
            onFocus={() => setSelected(m.slug)}
            onClick={(e) => {
              setSelected(m.slug);
              // Keyboard activation (detail 0): jump into the preview.
              if (e.detail === 0)
                requestAnimationFrame(() => playRef.current?.focus());
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelected(null);
            }}
          >
            <span className={styles.markerRing} aria-hidden="true" />
            <span className={styles.markerBadge}>
              <span className={styles.markerGlyph}>
                <HazardIcon category={m.category} size={20} />
              </span>
            </span>
            {starsFor(record) > 0 && (
              <span className={styles.markerDone} aria-hidden="true">
                ★
              </span>
            )}
          </button>,
          el,
          m.slug,
        );
      })}
      {current &&
        createPortal(
          <div
            className={`${styles.preview} hz-${current.category}`}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeAndReturn();
            }}
          >
            <span className="chip chip--solid">
              <HazardIcon category={current.category} size={16} />
              {categoryLabel[current.category]}
            </span>
            <strong className={styles.previewCity}>{current.city}</strong>
            <span className={styles.previewMeta}>
              <span>
                <span aria-hidden="true">⏱</span> {current.deadlineHours}h
              </span>
              <Stars count={starsFor(best[current.slug])} />
            </span>
            <Link
              ref={playRef}
              className="btn-pop btn-pop--sm btn-pop--block"
              href={briefHref(current.slug)}
              aria-label={`Play the ${current.city} mission`}
            >
              Play <span aria-hidden="true">▶</span>
            </Link>
          </div>,
          popupHost,
        )}
    </>
  );
}
