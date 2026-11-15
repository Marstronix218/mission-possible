# MISSION: POSSIBLE brand system

**MISSION: POSSIBLE** is the permanent franchise and platform name.
**CODE BLUE** is the first mission collection (Earth observation, environmental
hazards, satellite engineering). Collections come and go under the franchise, so
a collection name is never set in the same weight, color, or line as the
franchise wordmark. Treat it as a label, not part of the name.

All lettering is a custom rounded monoline drawn as SVG paths. The assets don't
depend on any installed font and render the same everywhere.

## Assets (`public/brand/`, app icons in `src/app/`)

| File                                                     | Use                                                 | Size                         |
| -------------------------------------------------------- | --------------------------------------------------- | ---------------------------- |
| `mission-possible-logo.svg` / `.png`                     | Horizontal lockup: mark + wordmark                  | 639×120 vector, PNG 1278×240 |
| `mission-possible-wordmark.svg`                          | Wordmark alone (header, footer)                     | 491×40 vector                |
| `mission-possible-mark.svg`                              | Round "M + orbit" mark                              | 512×512 vector               |
| `mission-possible-emblem.svg` / `-512.png` / `-1024.png` | Stacked franchise patch                             | 512 / 1024                   |
| `code-blue-badge.svg` / `-512.png` / `-1024.png`         | CODE BLUE collection badge                          | 512 / 1024                   |
| `mission-possible-og.svg` / `.png`                       | Social card (Open Graph / Twitter)                  | 1200×630                     |
| `icon-192.png`, `icon-512.png`                           | Manifest icons (`purpose: any`)                     | 192, 512                     |
| `icon-maskable-192.png`, `icon-maskable-512.png`         | Manifest maskable icons (mark inside 70% safe zone) | 192, 512                     |
| `src/app/icon.svg`                                       | Favicon (bold small-size mark)                      | vector                       |
| `src/app/favicon.ico`                                    | Legacy favicon, PNG-in-ICO                          | 16, 32, 48                   |
| `src/app/apple-icon.png`                                 | iOS home screen (full bleed)                        | 180×180                      |

## Color

| Token       | Hex       | Role                                          |
| ----------- | --------- | --------------------------------------------- |
| Ink         | `#050B1F` | Outer patch edge, deepest background          |
| Navy        | `#0B1838` | Patch field, `theme-color`                    |
| Navy 2      | `#13244D` | Sky gradient highlight                        |
| White       | `#F4F7FF` | Wordmark, rings                               |
| Signal gold | `#FFC845` | Franchise accent: colon, orbit, sparkle stars |
| Code Blue   | `#6CC4FF` | CODE BLUE collection accent only              |

Gold belongs to the franchise. Each collection gets one accent of its own, used
for its badge ring, bottom arc name, and UI chip. Collection accents must reach
at least 4.5:1 contrast on `#07121B` (Code Blue `#6CC4FF` is about 9.9:1).

## Clear space and minimum sizes

- Clear space around any lockup equals the cap height of the wordmark on all sides.
- Wordmark: cap height at least 9px on screen (about 110px wide). Below that,
  use the mark alone.
- Mark: at least 16px. At 16–48px use the bold small-size version (`src/app/icon.svg`).
- Emblem and collection badges: at least 72px. Under that, the arc lettering stops
  being readable, so pair the badge with a text label (the UI always does).

## Collection badge template

`code-blue-badge.svg` is the template for every future collection:

1. Outer ink edge (r 255), navy field with an 8px white ring (r 247).
2. A thin ring in the **collection accent** (r 236).
3. Lettering band: `MISSION: POSSIBLE` in white along the top arc (gold colon),
   and the **collection name** in its accent along the bottom arc. Both use the
   same 30px cap height, so the franchise always reads first because it sits on top.
4. Gold four-point sparkles at 9 and 3 o'clock separate the two arcs.
5. Inner disc (r 176, 6px white ring) holds the collection's scene. CODE BLUE
   shows Earth, a ground track, and a satellite with an observation cone.

To add a collection: copy the badge, change the accent, bottom-arc name, and inner
scene, save it as `public/brand/<id>-badge.svg`, then add an entry to
`src/lib/collections.ts`. The header chip, homepage lead, and "Mission collections"
shelf pick it up from there.

## Do

- Write the franchise as `MISSION: POSSIBLE` (caps, colon, one space).
- Show the active collection as a separate chip or label ("Collection | CODE BLUE").
- Put the logo on navy or ink backgrounds.
- Give logo images an accessible name, or leave them empty (`alt=""`) when
  adjacent text already names the brand.

## Don't

- Don't lock CODE BLUE into the franchise wordmark or emblem.
- Don't recolor the wordmark, or use gold for collection names.
- Don't stretch, outline, or add drop shadows to the wordmark.
- Don't show the mark smaller than 16px, or the emblem or a badge smaller than 72px.
- Don't add mockups of collections that don't exist. The single "More
  collections" placeholder is the only allowed stand-in.
