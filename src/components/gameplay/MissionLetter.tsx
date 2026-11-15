"use client";
import Link from "next/link";
import type { Mission } from "@/types/game";
import { MissionFlightBrief } from "./MissionFlightBrief";
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
      <MissionFlightBrief mission={mission} />

      <details className="mt-6">
        <summary>Read the mission letter</summary>
        <EnvelopeLetter mission={mission} />
      </details>
    </article>
  );
}
