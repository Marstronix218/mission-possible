import styles from "./MissionMap.module.css";

const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const steps = [
  {
    label: "Disaster",
    color: "var(--pop-pink)",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path
          d="M12 3 2 20.5h20L12 3Z"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <path d="M12 9.5v5M12 17.5h.01" />
      </svg>
    ),
  },
  {
    label: "Design",
    color: "var(--pop-yellow)",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <rect
          x="9"
          y="8"
          width="6"
          height="8"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <path d="M2 9h5v6H2zM17 9h5v6h-5zM7 12h2M15 12h2M12 8V5" />
      </svg>
    ),
  },
  {
    label: "Launch",
    color: "var(--pop-orange)",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path
          d="M12 2c3.2 3 4.3 7 3.2 12H8.8C7.7 9 8.8 5 12 2Z"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <path d="M8.8 14l-3 4h3.5M15.2 14l3 4h-3.5M10.5 20l1.5 2 1.5-2" />
        <circle cx="12" cy="9" r="1.6" />
      </svg>
    ),
  },
  {
    label: "Observe",
    color: "var(--pop-cyan)",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path
          d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    label: "Discover",
    color: "var(--pop-lime)",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <circle
          cx="10.5"
          cy="10.5"
          r="6.5"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <path d="m15.5 15.5 6 6M8 10.5l2 2 3.5-4" />
      </svg>
    ),
  },
  {
    label: "Improve",
    color: "var(--pop-violet)",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path d="M20 12a8 8 0 1 1-2.3-5.7" />
        <path d="M20 4v4.5h-4.5" />
        <path d="M12 15.5V9M9.3 11.5 12 9l2.7 2.5" />
      </svg>
    ),
  },
];

export default function MissionJourney() {
  return (
    <section aria-labelledby="journey-heading" className="mt-14 sm:mt-20">
      <h2 id="journey-heading" className="eyebrow mb-4 block text-center">
        How to play
      </h2>
      <ol className={styles.journey}>
        {steps.map((s, i) => (
          <li
            key={s.label}
            style={{ "--tile": s.color, "--i": i } as React.CSSProperties}
          >
            <span aria-hidden="true" className={styles.journeyIcon}>
              {s.icon}
            </span>
            <span className={styles.journeyLabel}>
              <span className="sr-only">Step {i + 1}: </span>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
