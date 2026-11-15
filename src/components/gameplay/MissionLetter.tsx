"use client";
import Image from "next/image";
import Link from "next/link";
import type { Mission } from "@/types/game";
import { EnvelopeLetter } from "@/components/planning/EnvelopeLetter";
import styles from "./gameplay.module.css";
export function MissionLetter({ mission }: { mission: Mission }) {
  return (
    <article className={styles.shell}>
      <div className={styles.row}>
        <Link href="/map">← World map</Link>
        <span>
          {mission.city} · {mission.targetResponseHours} h response target
        </span>
      </div>
      <h1 className="sr-only">Incoming mission from {mission.city}</h1>
      <EnvelopeLetter mission={mission} />
      <details className="mt-6">
        <summary>NASA reference & mission details</summary>
        <Image
          src={`/nasa/${mission.slug}.jpg`}
          alt={`Archived NASA reference for ${mission.city}, not live footage`}
          width={512}
          height={512}
          className="mt-4 max-w-full rounded-xl"
        />
        <p>
          Archived reference, not a live emergency.{" "}
          <a href={`/nasa/${mission.slug}.json`}>Source, date & usage ↗</a>
        </p>
        <p>
          Mission success requires 60+ points and 50%+ coverage. The scenario
          runs {mission.durationDays} days. Temperature observations concern
          surfaces, not air temperature.
        </p>
        <ul>
          {mission.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url}>{s.name}</a> ·{" "}
              {s.provenance === "nasa-observed"
                ? "NASA observed"
                : "Educational model"}{" "}
              · {s.usage}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
