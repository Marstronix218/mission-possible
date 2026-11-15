import Image from "next/image";
import Link from "next/link";
import type { Mission } from "@/types/game";
import { storyFor } from "@/components/designer/story-fallback";
import { neutralObstacle } from "./beginner-model";
import styles from "./gameplay.module.css";

export function MissionFlightBrief({ mission }: { mission: Mission }) {
  const story = storyFor(mission);
  return (
    <article className={styles.shell}>
      <section className={styles.briefing} aria-labelledby="mission-title">
        <div className={styles.briefingVisual}>
          <Image
            className={styles.heroImage}
            src={`/nasa/${mission.slug}.jpg`}
            alt={`Archived Earth observation of ${mission.city}`}
            fill
            sizes="(max-width: 800px) 100vw, 720px"
            priority
          />
          <div className={styles.briefingScan} aria-hidden="true" />
          <div className={styles.briefingContent}>
            <p className={styles.kicker}>Mission control / priority uplink</p>
            <p className={styles.alertChip}>● ACTIVE TRAINING SCENARIO</p>
            <h1 id="mission-title">{story.alert}</h1>
            <p className={styles.briefingSituation}>{story.situation[0]}</p>
            <div className={styles.objective}>
              <span>MISSION OBJECTIVE</span>
              <strong>{story.goal}</strong>
            </div>
            <p className={styles.whySpace}>
              <span aria-hidden="true">🛰️</span>
              <span>
                <strong>Why space?</strong> {neutralObstacle(mission)} Your
                spacecraft must find useful observations and transmit them to
                the ground team.
              </span>
            </p>
            <div className={styles.briefingActions}>
              <Link
                className={styles.primary}
                href={`/mission/${mission.slug}/design`}
              >
                ACCEPT MISSION →
              </Link>
              <Link className={styles.textLink} href="/map">
                Explore other missions
              </Link>
            </div>
          </div>
          <p className={styles.imageCredit}>
            Archived NASA imagery · not a live emergency ·{" "}
            <a href={`/nasa/${mission.slug}.json`}>source & date ↗</a>
          </p>
        </div>

        <aside className={styles.briefingPanel} aria-label="Mission parameters">
          <div>
            <p className={styles.kicker}>Flight brief / MP-{mission.seed}</p>
            <h2>Mission parameters</h2>
          </div>
          <dl className={styles.missionFacts}>
            <div>
              <dt>Target area</dt>
              <dd>{mission.city}</dd>
            </div>
            <div>
              <dt>Hazard</dt>
              <dd>{mission.category}</dd>
            </div>
            <div className={styles.deadlineFact}>
              <dt>First delivery target</dt>
              <dd>{mission.targetResponseHours} hours</dd>
            </div>
            <div>
              <dt>Mission duration</dt>
              <dd>{mission.durationDays} days</dd>
            </div>
            <div>
              <dt>Launch mass limit</dt>
              <dd>{mission.defaultConstraints.massKg} kg</dd>
            </div>
            <div>
              <dt>Budget ceiling</dt>
              <dd>${mission.defaultConstraints.budgetM}M</dd>
            </div>
          </dl>
          <div className={styles.successCriteria}>
            <span aria-hidden="true">◎</span>
            <p>
              <strong>Success criteria</strong>
              Earn 60+ points and observe at least 50% of the mission area. Delivery timing contributes to your score.
            </p>
          </div>
          <p className={styles.briefingNote}>
            No sensor is selected for you. Predict, build, launch, and learn
            from the measured result.
          </p>
        </aside>
      </section>

      <details className={styles.scienceDetails}>
        <summary>Mission science, assumptions & data sources</summary>
        <div className={styles.scienceGrid}>
          <div>
            <h2>What the mission models</h2>
            <p>{story.goal}</p>
            <p>{story.obstacle}</p>
            <p>
              Results come from the deterministic simulation. Surface
              temperature is different from air temperature, and radar does not
              directly measure surface heat.
            </p>
          </div>
          <div>
            <h2>Source provenance</h2>
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
          </div>
        </div>
      </details>
    </article>
  );
}
