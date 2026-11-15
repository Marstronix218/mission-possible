import Image from "next/image";
import Link from "next/link";
import type { MapMission } from "./missions";
import styles from "@/components/gameplay/gameplay.module.css";
export default function EmergencyHero({ mission }: { mission: MapMission }) {
  return (
    <section
      className={`${styles.shell} ${styles.hero}`}
      aria-labelledby="hero-heading"
    >
      <Image
        className={styles.heroImage}
        src="/nasa/los-angeles.jpg"
        alt="Smoke from the January 2025 Los Angeles fires, observed from space"
        fill
        priority
        sizes="(max-width: 768px) 100vw, 1100px"
      />
      <div className={styles.heroContent}>
        <p className={styles.kicker}>First mission / Los Angeles wildfire</p>
        <h1 id="hero-heading">
          Build a satellite.
          <br />
          Detect a disaster.
          <br />
          Help save a city.
        </h1>
        <p>Smoke is hiding the fire. We need satellite data.</p>
        <Link className={styles.primary} href="/mission/los-angeles/brief">
          START MISSION →
        </Link>
        <p className={styles.credit}>
          NASA VIIRS · 8 Jan 2025 · archived observation, not live footage.{" "}
          <a href="/nasa/los-angeles.json">Source ↗</a>
        </p>
        <span className="sr-only">Other missions include {mission.city}.</span>
      </div>
    </section>
  );
}
