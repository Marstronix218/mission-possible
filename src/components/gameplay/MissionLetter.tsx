"use client";
import Image from "next/image";
import Link from "next/link";
import type { Mission } from "@/types/game";
import { storyFor } from "@/components/designer/story-fallback";
import { neutralObstacle } from "./beginner-model";
import styles from "./gameplay.module.css";
export function MissionLetter({ mission }: { mission: Mission }) {
  const story = storyFor(mission);
  return (
    <article className={styles.shell}>
      <div className={styles.hero} style={{ minHeight: 380 }}>
        <Image
          className={styles.heroImage}
          src={`/nasa/${mission.slug}.jpg`}
          alt={`Archived Earth observation of ${mission.city}`}
          fill
          sizes="(max-width: 768px) 100vw, 1100px"
          priority
        />
        <div className={styles.heroContent}>
          <p className={styles.kicker}>Incoming message / {mission.city}</p>
          <h1>{story.alert}</h1>
          <p>{story.situation[0]}</p>
          <p className={styles.credit}>
            Archived NASA imagery · training scenario, not a live emergency.{" "}
            <a href={`/nasa/${mission.slug}.json`}>Image source & date ↗</a>
          </p>
        </div>
      </div>
      <div className={styles.row}>
        {/* Native details can be opened before hydration; keep the player’s open state. */}
        <details className={styles.letter} suppressHydrationWarning>
          <summary>Open your mission letter →</summary>
          <p>Dear Mission Team,</p>
          <p>{mission.objective.en}</p>
          <p>{neutralObstacle(mission)}</p>
          <p>
            Can you get useful observations to us within{" "}
            <strong>{mission.targetResponseHours} hours</strong>?
          </p>
          <p>
            — {mission.city} research team
            <br />
            <small>Fictional training message</small>
          </p>
          <Link
            className={styles.primary}
            href={`/mission/${mission.slug}/design`}
          >
            ACCEPT MISSION →
          </Link>
        </details>
        <Link href="/map">Explore missions</Link>
      </div>
      <details>
        <summary>Science & mission details</summary>
        <p>{story.goal}</p>
        <p>
          Results use the existing simulation. A mission succeeds with 60+
          points and 50%+ coverage. Surface temperature is different from air
          temperature.
        </p>
        <ul>
          {mission.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url}>{s.name}</a> ·{" "}
              {s.provenance === "nasa-observed"
                ? "NASA-observed reference"
                : "Educational model"}{" "}
              · {s.usage}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
