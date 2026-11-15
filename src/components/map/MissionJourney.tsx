const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const steps = [
  {
    label: "Emergency",
    line: "Read the alert. Learn who needs help and how fast.",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 10v5M12 18h.01" />
      </svg>
    ),
  },
  {
    label: "Build",
    line: "Pick sensors, orbit, and power within budget.",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <path d="M2 10h5v4H2zM17 10h5v4h-5zM7 12h2M15 12h2" />
      </svg>
    ),
  },
  {
    label: "Launch",
    line: "Send your satellite into orbit.",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path d="M12 2c3 3 4 7 3 12H9C8 9 9 5 12 2Z" />
        <path d="M9 14l-3 4h3M15 14l3 4h-3M10 19l2 3 2-3" />
      </svg>
    ),
  },
  {
    label: "Observe",
    line: "Watch it pass overhead. Survive clouds, smoke, and limits.",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    label: "Debrief",
    line: "See who your data helped. Improve and retry.",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
];

export default function MissionJourney() {
  return (
    <section aria-labelledby="journey-heading" className="mt-10">
      <h2 id="journey-heading" className="mt-0 mb-4">
        How a mission works
      </h2>
      <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className="flex items-start gap-3 rounded-lg border border-[#2a3d4b] bg-[#122430] p-4 lg:flex-col"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#9ae6d3] text-[#9ae6d3] [&>svg]:h-5 [&>svg]:w-5"
            >
              {s.icon}
            </span>
            <span>
              <span className="block font-mono text-xs text-[#a5bac9]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <strong className="block text-base font-semibold text-[#eaf1f5]">
                {s.label}
              </strong>
              <span className="block text-sm text-[#a5bac9]">{s.line}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
