import Image from "next/image";
import Link from "next/link";
import {
  collections,
  currentCollection,
  type Collection,
} from "@/lib/collections";
import styles from "./MissionMap.module.css";

const accentStyle = (c: Collection) =>
  ({ "--collection": c.accent }) as React.CSSProperties;

/** Badge + collection label shown above the page heading on /map. */
export function CollectionBadge({
  collection = currentCollection,
}: {
  collection?: Collection;
}) {
  const index = collections.indexOf(collection) + 1;
  return (
    <div className={styles.collectionLead} style={accentStyle(collection)}>
      <Image
        className={styles.collectionLeadBadge}
        src={collection.badge}
        alt=""
        width={112}
        height={112}
        priority
        unoptimized
      />
      <div className={styles.collectionLeadText}>
        <span className={styles.collectionKicker}>
          MISSION: POSSIBLE · Collection {String(index).padStart(2, "0")}
        </span>
        <span className={styles.collectionName}>{collection.name}</span>
        <span className={styles.collectionFocus}>{collection.focus}</span>
      </div>
    </div>
  );
}

/** Every collection in the franchise, plus an honest placeholder for what's next. */
export default function CollectionShelf() {
  return (
    <section aria-labelledby="collections-heading" className="mt-16 sm:mt-24">
      <div className={styles.sectionHead}>
        <h2 id="collections-heading" className="text-2xl">
          Mission collections
        </h2>
        <span className="text-sm text-muted-foreground">
          {collections.filter((c) => c.status === "playable").length} playable
        </span>
      </div>
      <ul className={styles.collectionGrid}>
        {collections.map((c) => {
          const current = c.id === currentCollection.id;
          return (
            <li
              key={c.id}
              className={styles.collectionCard}
              style={accentStyle(c)}
            >
              <Image
                src={c.badge}
                alt={`${c.name} collection badge`}
                width={96}
                height={96}
                unoptimized
              />
              <div className={styles.collectionCardBody}>
                <span className={styles.collectionStatus}>
                  {current
                    ? "Now playing"
                    : c.status === "playable"
                      ? "Playable"
                      : "Coming soon"}
                </span>
                <h3>{c.name}</h3>
                <p>{c.tagline}</p>
                {c.status === "playable" &&
                  (current ? (
                    <Link
                      className="btn-pop btn-pop--ghost btn-pop--sm"
                      href="#missions"
                      aria-label={`Browse ${c.name} missions`}
                    >
                      Browse missions <span aria-hidden="true">↑</span>
                    </Link>
                  ) : (
                    <Link className="btn-pop btn-pop--sm" href={c.href}>
                      Open {c.name}
                    </Link>
                  ))}
              </div>
            </li>
          );
        })}
        <li className={`${styles.collectionCard} ${styles.collectionNext}`}>
          <span className={styles.collectionNextMark} aria-hidden="true">
            +
          </span>
          <div className={styles.collectionCardBody}>
            <span className={styles.collectionStatus}>Coming later</span>
            <h3>More collections</h3>
            <p>
              New mission collections will join MISSION: POSSIBLE over time.
            </p>
          </div>
        </li>
      </ul>
    </section>
  );
}
