import type { Category } from "@/types/game";

const INK = "var(--space-950)";

/**
 * Chunky glyph per hazard. Shape is distinct for every category so the icon,
 * not the color, carries the meaning. Decorative by default (aria-hidden);
 * always render a text label next to it.
 */
export default function HazardIcon({
  category,
  className,
  size = 24,
}: {
  category: Category;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph[category]}
    </svg>
  );
}

const glyph: Record<Category, React.ReactNode> = {
  wildfire: (
    <>
      <path d="M12 1.8c1.2 3.6 5.2 5.6 5.2 10.9a5.2 5.2 0 0 1-10.4 0c0-2.3.9-3.8 2.3-5.2.2 1.8 1 2.9 2.2 3.4-.6-3.4.2-6.3.7-9.1Z" />
      <path
        d="M12 13.2c1 1.1 2 2 2 3.6a2 2 0 0 1-4 0c0-1.4 1-2.4 2-3.6Z"
        fill={INK}
        opacity="0.35"
      />
    </>
  ),
  flood: (
    <>
      <path d="M12 2C9 6.6 5.8 9.9 5.8 13.8a6.2 6.2 0 0 0 12.4 0C18.2 9.9 15 6.6 12 2Z" />
      <path
        d="M8.8 14.6c.6 1.6 1.8 2.5 3.4 2.7"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
        opacity="0.4"
      />
    </>
  ),
  storm: (
    <>
      <path
        d="M12 3.5a8.5 8.5 0 0 0-8 5.6c1.6-1.6 3.8-2.4 6.2-2.1M12 20.5a8.5 8.5 0 0 0 8-5.6c-1.6 1.6-3.8 2.4-6.2 2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
      />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1.6" fill={INK} opacity="0.5" />
    </>
  ),
  volcano: (
    <>
      <path d="M2.5 21 8.4 10.5h7.2L21.5 21Z" />
      <path
        d="M8.4 10.5h7.2l-1.4 2.6-1.6-1.1-1.4 1.6-1.3-1.4-1.2.9Z"
        fill={INK}
        opacity="0.35"
      />
      <circle cx="9" cy="5.2" r="1.7" />
      <circle cx="12.4" cy="3.4" r="1.4" />
      <circle cx="15.6" cy="5.6" r="1.9" />
    </>
  ),
  heat: (
    <>
      <circle cx="12" cy="12" r="4.6" />
      <g stroke="currentColor" strokeWidth="2.4">
        <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
      </g>
    </>
  ),
  snow: (
    <g fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" />
      <path d="M9.4 4.2 12 6.6l2.6-2.4M9.4 19.8 12 17.4l2.6 2.4" />
    </g>
  ),
  drought: (
    <>
      <path d="M2.5 14.5h19v5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5Z" />
      <path
        d="M8 14.5l1.6 2.4-1.2 1.6.8 2.5M15.5 14.5l-1.2 2.2 1.8 1.4"
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
        opacity="0.5"
      />
      <path
        d="M12 14.5V8.5c0-2 1-3.5 3-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path d="M12 10.5c-2.8.2-4.6-1.2-5.4-3.6 2.8-.3 4.7 1 5.4 3.6Z" />
      <path d="M15 4c1.8.4 2.8 1.8 2.9 3.8-1.8-.3-2.8-1.6-2.9-3.8Z" />
    </>
  ),
  glacier: (
    <>
      <path d="M3 18.5 7.6 8l3 3.2L13 4.5l8 14Z" />
      <path
        d="M13 4.5 11.8 11l1.9-1.3 1.2 2.3"
        fill="none"
        stroke={INK}
        strokeWidth="1.4"
        opacity="0.4"
      />
      <path
        d="M2 21.2h20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      />
    </>
  ),
};
