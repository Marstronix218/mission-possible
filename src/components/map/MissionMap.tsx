"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { loadAttempts } from "../results/session";
import { api, backendAvailable } from "../results/cloud";
import { ENGINE_VERSION } from "@/lib/sim";
import type { Category, SimResult } from "@/types/game";
import { categoryLabel } from "@/lib/story/missions";
import { WelcomeLetter } from "@/components/planning/EnvelopeLetter";
import planning from "@/components/planning/planning.module.css";
import HazardIcon from "./HazardIcon";
import Stars from "./Stars";
import CollectionShelf, { CollectionBadge } from "./CollectionShelf";
import { useInView } from "./useInView";
import {
  selectMissions,
  categoryColors,
  briefHref,
  progressLabel,
  starsFor,
  type BestRecord,
  type MapMission,
} from "./missions";
import styles from "./MissionMap.module.css";

const HazardMap = dynamic(() => import("./HazardMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  return (
    <div className={styles.mapLoading} role="status">
      <span className={styles.mapLoadingGlobe} aria-hidden="true" />
      Loading Earth…
    </div>
  );
}

function useBestScores(missions: MapMission[]) {
  const [best, setBest] = useState<Record<string, BestRecord>>({});
  const [progressError, setProgressError] = useState("");
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const rows = backendAvailable
          ? (
              await Promise.all(
                missions.map(async (mission) =>
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
        const scores: Record<string, BestRecord> = {};
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
            "Progress couldn't load — every mission is still playable.",
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
  }, [missions]);
  return { best, progressError };
}

/** Big, distinct starter card with its own little hazard scene. */
function FeaturedCard({
  m,
  record,
  index,
}: {
  m: MapMission;
  record?: BestRecord;
  index: number;
}) {
  return (
    <li
      className={`${styles.featured} hz-${m.category} anim-pop-in`}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div
        className={styles.featuredArt}
        style={{ position: "relative", overflow: "hidden" }}
      >
        <Image
          src={`/nasa/${m.slug}.jpg`}
          alt={`Archived NASA Earth observation of ${m.city}`}
          fill
          sizes="(max-width: 640px) 100vw, 360px"
          style={{ objectFit: "cover" }}
        />
        <span className={styles.featuredTimer}>
          Archived NASA imagery · {m.deadlineHours}h response
        </span>
      </div>
      <div className={styles.featuredBody}>
        <span className="chip">
          <span style={{ color: categoryColors[m.category] }}>
            <HazardIcon category={m.category} size={16} />
          </span>
          {categoryLabel[m.category]}
        </span>
        <h3 className={styles.featuredCity}>{m.city}</h3>
        <p className={styles.featuredLine}>{m.headline}</p>
        <div className={styles.featuredFoot}>
          <span className="sr-only">{progressLabel(record)}. </span>
          <Stars count={starsFor(record)} size="1.35rem" />
          <Link
            className="btn-pop"
            href={briefHref(m.slug)}
            aria-label={`${record ? "Replay" : "Play"} the ${m.city} mission`}
          >
            {record ? "Replay" : "Play"} <span aria-hidden="true">▶</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

function MissionTile({ m, record }: { m: MapMission; record?: BestRecord }) {
  return (
    <li>
      <Link
        href={briefHref(m.slug)}
        className={`${styles.tile} hz-${m.category}`}
        aria-label={`${m.city}: ${categoryLabel[m.category]}, ${m.deadlineHours}-hour deadline. ${progressLabel(record)}.`}
      >
        <span className={styles.tileIcon} aria-hidden="true">
          <HazardIcon category={m.category} size={22} />
        </span>
        <span className={styles.tileText}>
          <strong>{m.city}</strong>
          <span>
            {categoryLabel[m.category]} · {m.deadlineHours}h
          </span>
        </span>
        {record && <Stars count={starsFor(record)} size="0.8rem" />}
      </Link>
    </li>
  );
}

export default function MissionMap({ missions }: { missions: MapMission[] }) {
  const { featuredMission, featuredMissions, moreMissions, categories } =
    selectMissions(missions);
  const moreCategories = categories.filter((c) =>
    moreMissions.some((m) => m.category === c),
  );
  const { best, progressError } = useBestScores(missions);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [mapRef, mapNear] = useInView<HTMLDivElement>({
    rootMargin: "400px 0px",
    once: true,
  });
  const [mapPanelRef, mapVisible] = useInView<HTMLDivElement>();
  const visible = moreMissions.filter(
    (m) => filter === "all" || m.category === filter,
  );
  const completed = missions.filter((m) => best[m.slug]?.success).length;

  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <section className={planning.mapLead} aria-labelledby="world-heading">
        <div className={planning.mapHead}>
          <div>
            <CollectionBadge />
            <h1 id="world-heading">Your mission starts on Earth.</h1>
            <p>
              Design and operate a satellite to help a community understand a
              hazard on Earth.
            </p>
          </div>
          {featuredMission && (
            <div>
              <p>
                {featuredMission.city} ·{" "}
                {categoryLabel[featuredMission.category]}
              </p>
              <Link className="btn-pop" href={briefHref(featuredMission.slug)}>
                Start your first mission
              </Link>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="map-heading" className="mt-6">
        <div className={styles.sectionHead}>
          <h2 id="map-heading">Explore the world</h2>
          <WelcomeLetter />
          <span
            className="chip"
            style={{ "--hz": "var(--pop-cyan)" } as React.CSSProperties}
          >
            {missions.length} alerts
          </span>
        </div>
        <div ref={mapRef}>
          <div
            ref={mapPanelRef}
            className={`map-panel ${styles.mapPanel}`}
            data-paused={mapVisible ? "false" : "true"}
            aria-label="Map of disaster missions. Select a marker to preview a mission."
            role="region"
          >
            {mapNear ? (
              <HazardMap missions={missions} best={best} />
            ) : (
              <MapLoading />
            )}
          </div>
        </div>
        <p className={styles.attribution}>
          Satellite imagery:{" "}
          <a
            href="https://earthdata.nasa.gov/gibs"
            target="_blank"
            rel="noopener noreferrer"
          >
            NASA EOSDIS GIBS / Blue Marble
          </a>
          . Mission alerts are training scenarios.
        </p>
      </section>

      <section
        aria-labelledby="featured-heading"
        className="mt-16 sm:mt-24"
        id="missions"
      >
        <div className={styles.sectionHead}>
          <h2 id="featured-heading">Explore another mission</h2>
          {completed > 0 && (
            <span
              className="chip"
              style={{ "--hz": "var(--pop-yellow)" } as React.CSSProperties}
            >
              <span aria-hidden="true">★</span> {completed}/{missions.length}{" "}
              completed
            </span>
          )}
        </div>
        {progressError && (
          <p role="status" className="notice">
            {progressError}
          </p>
        )}
        <ul className={styles.featuredGrid}>
          {featuredMissions.map((m, i) => (
            <FeaturedCard key={m.slug} m={m} record={best[m.slug]} index={i} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="more-heading" className="mt-14 sm:mt-20">
        <div className={styles.sectionHead}>
          <h2 id="more-heading" className="text-2xl">
            More missions
          </h2>
          <span className="text-sm text-muted-foreground">
            {moreMissions.length} cities
          </span>
        </div>
        <div
          className={`filter ${styles.filters}`}
          role="group"
          aria-label="Filter missions by hazard"
        >
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {moreCategories.map((c) => (
            <button
              type="button"
              key={c}
              className={"hz-" + c}
              aria-pressed={filter === c}
              onClick={() => setFilter(filter === c ? "all" : c)}
            >
              <HazardIcon category={c} size={18} />
              {categoryLabel[c]}
            </button>
          ))}
        </div>
        <ul className={styles.tileGrid}>
          {visible.map((m) => (
            <MissionTile key={m.slug} m={m} record={best[m.slug]} />
          ))}
        </ul>
      </section>

      <CollectionShelf />
    </main>
  );
}
