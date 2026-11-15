/**
 * MISSION: POSSIBLE is the permanent franchise. Each collection is a
 * self-contained set of missions published under it. CODE BLUE is the first.
 *
 * To add a collection: append an entry, add its badge at
 * `public/brand/<id>-badge.svg` following docs/brand.md, and point `href`
 * at its mission selection route. Order here is display order.
 */
export type CollectionStatus = "playable" | "coming-soon";

export type Collection = {
  id: string;
  /** Display name, written in caps as it appears on the badge. */
  name: string;
  /** One-line pitch shown under the badge. */
  tagline: string;
  /** Short topic summary for chips and screen readers. */
  focus: string;
  /** Square badge (SVG) in `public/`. */
  badge: string;
  /** Accent used for the collection chip; must pass 4.5:1 on --space-950. */
  accent: string;
  status: CollectionStatus;
  href: string;
};

export const collections: readonly Collection[] = [
  {
    id: "code-blue",
    name: "CODE BLUE",
    tagline:
      "Design satellites that watch Earth from orbit and help communities respond to environmental hazards.",
    focus: "Earth observation · environmental hazards · satellite engineering",
    badge: "/brand/code-blue-badge.svg",
    accent: "#6cc4ff",
    status: "playable",
    href: "/map",
  },
];

/** The collection currently loaded by the game screens. */
export const currentCollection: Collection = collections[0];

export function getCollection(id: string): Collection | undefined {
  return collections.find((c) => c.id === id);
}
