// Brand SVG generator. Usage: node scripts/brand/gen.mjs . (writes public/brand/*.svg; see docs/brand.md)
// MISSION: POSSIBLE brand asset generator.
// Letterforms are a custom rounded monoline drawn as centerline paths on a
// 100-unit cap height, so every asset renders identically without fonts.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.argv[2];
const OUT = resolve(ROOT, "public/brand");
mkdirSync(OUT, { recursive: true });

const C = {
  ink: "#050B1F",
  navy: "#0B1838",
  navy2: "#13244D",
  white: "#F4F7FF",
  gold: "#FFC845",
  blue: "#6CC4FF",
  blueDeep: "#1F6FD1",
  ocean: "#1B5FB8",
  land: "#7FD48B",
};

const SW = 16; // stroke width in glyph units
const G = {
  I: { w: 0, d: "M0 0V100" },
  M: { w: 74, d: "M0 100V0L37 62L74 0V100" },
  S: {
    w: 60,
    d: "M58 15C51 5 42 0 30 0C14 0 3 9 3 24C3 41 18 45 30 49C45 53 60 58 60 75C60 91 48 100 30 100C17 100 6 94 0 84",
  },
  O: { w: 92, d: "M46 0A46 50 0 1 1 46 100A46 50 0 1 1 46 0Z" },
  N: { w: 66, d: "M0 100V0L66 100V0" },
  P: { w: 58, d: "M0 100V0H32C48 0 58 11 58 27C58 43 48 54 32 54H0" },
  B: {
    w: 60,
    d: "M0 50H33C49 50 60 60 60 75C60 90 49 100 33 100H0V0H29C44 0 54 10 54 25C54 40 44 50 29 50",
  },
  L: { w: 50, d: "M0 0V100H50" },
  E: { w: 52, d: "M52 0H0V100H52M0 50H44" },
  C: { w: 79, d: "M78.5 14.6A46 50 0 1 0 78.5 85.4" },
  D: { w: 84, d: "M0 0V100H36C66 100 84 80 84 50C84 20 66 0 36 0Z" },
  U: { w: 64, d: "M0 0V62C0 87 14 100 32 100C50 100 64 87 64 62V0" },
  ":": { w: 0, dots: [30, 86] },
};
const TRACK = 38; // advance added after each glyph (wide-tracked caps)
const SPACE = 46;

/** Lay out a string; returns glyph boxes with x offsets (centerline units). */
function layout(text, track = TRACK) {
  const out = [];
  let x = 0;
  for (const ch of text) {
    if (ch === " ") {
      x += SPACE;
      continue;
    }
    const g = G[ch];
    if (!g) throw new Error("No glyph " + ch);
    out.push({ ch, g, x });
    x += g.w + track;
  }
  return { glyphs: out, width: x - track };
}

function glyphMarkup(g, color) {
  if (g.dots)
    return g.dots
      .map((y) => `<circle cx="0" cy="${y}" r="${SW * 0.62}" fill="${color}"/>`)
      .join("");
  return `<path d="${g.d}"/>`;
}

/** Straight wordmark, cap height `h` px, top-left at (x,y) of the ink box. */
function word(text, x, y, h, color, opts = {}) {
  const s = h / (100 + SW);
  const { glyphs } = layout(text, opts.track);
  const colon = opts.colon ?? color;
  const parts = glyphs.map(({ ch, g, x: gx }) => {
    const col = ch === ":" ? colon : color;
    return `<g transform="translate(${gx} 0)"${ch === ":" ? ` fill="${col}"` : ""}>${glyphMarkup(g, col)}</g>`;
  });
  return `<g transform="translate(${r(x + (SW / 2) * s)} ${r(y + (SW / 2) * s)}) scale(${r(s, 5)})" fill="none" stroke="${color}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${parts.join("")}</g>`;
}
function wordWidth(text, h, track) {
  const s = h / (100 + SW);
  return (layout(text, track).width + SW) * s;
}

/** Text on a circle. `top` reads clockwise over the top; else along the bottom. */
function arcText(text, cx, cy, radius, h, color, { top = true, colon, track } = {}) {
  const s = h / (100 + SW);
  const { glyphs, width } = layout(text, track);
  const total = width * s;
  const parts = glyphs.map(({ ch, g, x }) => {
    const mid = (x + g.w / 2) * s - total / 2;
    const a = mid / radius; // radians
    const deg = (a * 180) / Math.PI;
    const col = ch === ":" ? (colon ?? color) : color;
    // radius = glyph vertical middle. Glyph local origin = its centre.
    const px = cx + radius * Math.sin(a);
    const py = top ? cy - radius * Math.cos(a) : cy + radius * Math.cos(-a);
    const rot = top ? deg : -deg;
    const tx = top ? px : cx + radius * Math.sin(a);
    return `<g transform="translate(${r(tx)} ${r(py)}) rotate(${r(rot)}) scale(${r(s, 5)}) translate(${-g.w / 2} -50)"${ch === ":" ? ` fill="${col}"` : ""}>${glyphMarkup(g, col)}</g>`;
  });
  return `<g fill="none" stroke="${color}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${parts.join("")}</g>`;
}

const r = (n, p = 2) => +n.toFixed(p);

/** Four-point sparkle star. */
function sparkle(cx, cy, R, color, k = 0.22) {
  const i = R * k;
  return `<path d="M${cx} ${cy - R}Q${cx + i} ${cy - i} ${cx + R} ${cy}Q${cx + i} ${cy + i} ${cx} ${cy + R}Q${cx - i} ${cy + i} ${cx - R} ${cy}Q${cx - i} ${cy - i} ${cx} ${cy - R}Z" fill="${color}"/>`;
}

/** Small boxy satellite with two solar wings; centred at 0,0, ~ 64 wide. */
function satellite(x, y, scale, rot, accent = C.blue) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
  <rect x="-34" y="-8" width="22" height="16" rx="2" fill="${accent}" stroke="${C.white}" stroke-width="3"/>
  <rect x="12" y="-8" width="22" height="16" rx="2" fill="${accent}" stroke="${C.white}" stroke-width="3"/>
  <path d="M-12 0H-8M8 0H12" stroke="${C.white}" stroke-width="3"/>
  <rect x="-8" y="-11" width="16" height="22" rx="4" fill="${C.white}"/>
  <path d="M0 11V17M-5 19.5A5 3 0 0 0 5 19.5" stroke="${C.white}" stroke-width="3" fill="none" stroke-linecap="round"/>
</g>`;
}

function starfield(seed, n, cx, cy, R, maxR = 2.2) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let out = "";
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * R;
    out += `<circle cx="${r(cx + Math.cos(a) * d)}" cy="${r(cy + Math.sin(a) * d)}" r="${r(0.6 + rnd() * maxR)}" fill="${C.white}" opacity="${r(0.35 + rnd() * 0.55)}"/>`;
  }
  return out;
}

const svg = (vb, label, body, w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${w ? ` width="${w}" height="${h}"` : ""} role="img" aria-labelledby="t">
<title id="t">${label}</title>
${body}
</svg>
`;

/* ------------------------------------------------------------------ */
/* 1. App mark: navy disc, monoline M, gold orbit, sparkle.            */
/* ------------------------------------------------------------------ */
function markBody({ size = 512, simple = false, bleed = false, inset = 0 } = {}) {
  const c = size / 2;
  const R = c - inset;
  const k = R / 256; // scale relative to 512 design
  const disc = bleed
    ? `<rect width="${size}" height="${size}" fill="${C.navy}"/>`
    : `<circle cx="${c}" cy="${c}" r="${R}" fill="${C.navy}"/>
<circle cx="${c}" cy="${c}" r="${R - 10 * k}" fill="none" stroke="${C.white}" stroke-width="${simple ? 0 : 6 * k}"/>`;
  // M centred, centerline height ~ 190 * k
  const mh = (simple ? 220 : 190) * k;
  const mw = (simple ? 190 : 168) * k;
  const msw = (simple ? 64 : 40) * k;
  const mx = c - mw / 2;
  const my = c - mh / 2 - 6 * k;
  const M = `<path d="M${r(mx)} ${r(my + mh)}V${r(my)}L${r(c)} ${r(my + mh * 0.62)}L${r(mx + mw)} ${r(my)}V${r(my + mh)}" fill="none" stroke="${C.white}" stroke-width="${r(msw)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // Orbit: tilted ellipse; back half under the M, front half over it.
  const orx = (simple ? 200 : 196) * k;
  const ory = (simple ? 62 : 58) * k;
  const osw = (simple ? 34 : 16) * k;
  const tilt = -18;
  const back = `<path d="M${r(c - orx)} ${r(c)}A${r(orx)} ${r(ory)} 0 0 1 ${r(c + orx)} ${r(c)}" fill="none" stroke="${C.gold}" stroke-width="${r(osw * 0.7)}" stroke-linecap="round" opacity="${simple ? 1 : 0.55}" transform="rotate(${tilt} ${c} ${c + 40 * k})"/>`;
  const front = `<path d="M${r(c + orx)} ${r(c)}A${r(orx)} ${r(ory)} 0 0 1 ${r(c - orx)} ${r(c)}" fill="none" stroke="${C.navy}" stroke-width="${r(osw + 18 * k)}" transform="rotate(${tilt} ${c} ${c + 40 * k})"/>
<path d="M${r(c + orx)} ${r(c)}A${r(orx)} ${r(ory)} 0 0 1 ${r(c - orx)} ${r(c)}" fill="none" stroke="${C.gold}" stroke-width="${r(osw)}" stroke-linecap="round" transform="rotate(${tilt} ${c} ${c + 40 * k})"/>`;
  const spark = simple ? "" : sparkle(r(c + 132 * k), r(c - 128 * k), r(34 * k), C.gold);
  const stars = simple
    ? ""
    : `<circle cx="${r(c - 120 * k)}" cy="${r(c - 120 * k)}" r="${r(5 * k)}" fill="${C.white}" opacity=".8"/><circle cx="${r(c + 150 * k)}" cy="${r(c + 92 * k)}" r="${r(4 * k)}" fill="${C.white}" opacity=".7"/><circle cx="${r(c - 70 * k)}" cy="${r(c + 170 * k)}" r="${r(3.5 * k)}" fill="${C.white}" opacity=".6"/>`;
  return `${disc}${stars}${back}${M}${front}${spark}`;
}

writeFileSync(
  resolve(OUT, "mission-possible-mark.svg"),
  svg("0 0 512 512", "MISSION: POSSIBLE", markBody()),
);
// favicon-scale master (thicker strokes, no hairlines)
writeFileSync(
  resolve(OUT, "_mark-small.svg"),
  svg("0 0 512 512", "MISSION: POSSIBLE", markBody({ simple: true })),
);
// full-bleed (apple touch / maskable: content within 80% safe zone)
writeFileSync(
  resolve(OUT, "_mark-maskable.svg"),
  svg(
    "0 0 512 512",
    "MISSION: POSSIBLE",
    `<rect width="512" height="512" fill="${C.navy}"/><g transform="translate(76.8 76.8) scale(.7)">${markBody()}</g>`,
  ),
);
writeFileSync(
  resolve(OUT, "_mark-apple.svg"),
  svg(
    "0 0 512 512",
    "MISSION: POSSIBLE",
    `<rect width="512" height="512" fill="${C.ink}"/><g transform="translate(46 46) scale(.82)">${markBody()}</g>`,
  ),
);

/* ------------------------------------------------------------------ */
/* 2. Horizontal logo: mark + one-line wordmark (header).              */
/* ------------------------------------------------------------------ */
{
  const H = 120;
  const cap = 40;
  const text = "MISSION: POSSIBLE";
  const ww = wordWidth(text, cap);
  const gap = 26;
  const W = Math.ceil(H + gap + ww + 4);
  const body = `<g transform="scale(${r(H / 512, 5)})">${markBody()}</g>
${word(text, H + gap, (H - cap) / 2, cap, C.white, { colon: C.gold })}`;
  writeFileSync(resolve(OUT, "mission-possible-logo.svg"), svg(`0 0 ${W} ${H}`, "MISSION: POSSIBLE", body));
  // Wordmark only (for header next to an inline mark, footers, docs).
  const W2 = Math.ceil(ww + 2);
  writeFileSync(
    resolve(OUT, "mission-possible-wordmark.svg"),
    svg(`0 0 ${W2} ${cap}`, "MISSION: POSSIBLE", word(text, 0, 0, cap, C.white, { colon: C.gold })),
  );
  console.log("logo", W, H, "wordmark", W2, cap);
}

/* ------------------------------------------------------------------ */
/* 3. Stacked emblem (franchise patch).                                */
/* ------------------------------------------------------------------ */
{
  const c = 256;
  const cap = 52;
  const w1 = wordWidth("MISSION:", cap);
  const w2 = wordWidth("POSSIBLE", cap);
  const y1 = 186;
  const y2 = y1 + cap + 30;
  const ocx = 256, ocy = 248, orx = 222, ory = 112, tilt = -9;
  const tf = `rotate(${tilt} ${ocx} ${ocy})`;
  const orbit = (part) =>
    part === "back"
      ? `<path d="M${ocx - orx} ${ocy}A${orx} ${ory} 0 0 1 ${ocx + orx} ${ocy}" fill="none" stroke="${C.white}" stroke-width="3" opacity=".45" transform="${tf}"/>`
      : `<path d="M${ocx + orx} ${ocy}A${orx} ${ory} 0 0 1 ${ocx - orx} ${ocy}" fill="none" stroke="${C.gold}" stroke-width="8" stroke-linecap="round" transform="${tf}"/>`;
  const t = (64 * Math.PI) / 180;
  const ex = orx * Math.cos(t), ey = ory * Math.sin(t), ta = (tilt * Math.PI) / 180;
  const satX = r(ocx + ex * Math.cos(ta) - ey * Math.sin(ta));
  const satY = r(ocy + ex * Math.sin(ta) + ey * Math.cos(ta));
  const body = `<defs><clipPath id="in"><circle cx="${c}" cy="${c}" r="226"/></clipPath>
<radialGradient id="sky" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${C.navy2}"/><stop offset="1" stop-color="${C.ink}"/></radialGradient></defs>
<circle cx="${c}" cy="${c}" r="254" fill="${C.ink}"/>
<circle cx="${c}" cy="${c}" r="244" fill="url(#sky)" stroke="${C.white}" stroke-width="8"/>
<circle cx="${c}" cy="${c}" r="228" fill="none" stroke="${C.gold}" stroke-width="3"/>
<g clip-path="url(#in)">${starfield(7, 46, c, c, 220)}${orbit("back")}</g>
${word("MISSION:", c - w1 / 2 + (wordWidth(":", cap) + 0) / 2 - 2, y1, cap, C.white, { colon: C.gold })}
${word("POSSIBLE", c - w2 / 2, y2, cap, C.white)}
<g clip-path="url(#in)">${orbit("front")}</g>
${satellite(satX, satY, 0.78, -30, C.blueDeep)}
${sparkle(394, 118, 28, C.gold)}
${sparkle(120, 128, 11, C.white)}
${sparkle(214, 420, 7, C.gold)}${sparkle(256, 428, 10, C.gold)}${sparkle(298, 420, 7, C.gold)}`;
  writeFileSync(resolve(OUT, "mission-possible-emblem.svg"), svg("0 0 512 512", "MISSION: POSSIBLE", body));
}

/* ------------------------------------------------------------------ */
/* 4. Collection badge template. CODE BLUE = first collection.         */
/* ------------------------------------------------------------------ */
function collectionBadge({ name, color, art }) {
  const c = 256;
  const body = `<defs><clipPath id="disc"><circle cx="${c}" cy="${c}" r="170"/></clipPath>
<radialGradient id="sky" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="${C.navy2}"/><stop offset="1" stop-color="${C.ink}"/></radialGradient></defs>
<circle cx="${c}" cy="${c}" r="255" fill="${C.ink}"/>
<circle cx="${c}" cy="${c}" r="247" fill="${C.navy}" stroke="${C.white}" stroke-width="8"/>
<circle cx="${c}" cy="${c}" r="236" fill="none" stroke="${color}" stroke-width="3"/>
<circle cx="${c}" cy="${c}" r="176" fill="url(#sky)" stroke="${C.white}" stroke-width="6"/>
${arcText("MISSION: POSSIBLE", c, c, 206, 30, C.white, { top: true, colon: C.gold, track: 34 })}
${arcText(name, c, c, 206, 30, color, { top: false, track: 40 })}
${sparkle(c - 206, c, 13, C.gold)}${sparkle(c + 206, c, 13, C.gold)}
<g clip-path="url(#disc)">${art}</g>
<circle cx="${c}" cy="${c}" r="176" fill="none" stroke="${C.white}" stroke-width="6"/>`;
  return body;
}

const codeBlueArt = `${starfield(19, 40, 256, 200, 170, 1.8)}
<circle cx="256" cy="452" r="196" fill="${C.ocean}"/>
<circle cx="256" cy="452" r="196" fill="none" stroke="${C.blue}" stroke-width="10" opacity=".55"/>
<path d="M120 318C150 300 186 304 204 322C220 338 208 356 186 362C162 368 140 384 112 380Z" fill="${C.land}"/>
<path d="M262 284C290 274 330 280 352 298C370 312 360 330 334 334C312 338 300 352 280 348C258 344 244 300 262 284Z" fill="${C.land}"/>
<path d="M370 352C392 344 414 356 420 376L392 384C380 378 366 366 370 352Z" fill="${C.land}"/>
<path d="M150 300C210 268 300 262 380 290" fill="none" stroke="${C.white}" stroke-width="5" stroke-linecap="round" opacity=".85" stroke-dasharray="2 14"/>
<path d="M236 150L188 316H330Z" fill="${C.blue}" opacity=".22"/>
<path d="M236 150L188 316M236 150L330 316" stroke="${C.blue}" stroke-width="2.5" opacity=".7"/>
<path d="M66 214A220 70 0 0 1 446 150" fill="none" stroke="${C.white}" stroke-width="3" opacity=".45" stroke-linecap="round"/>
${satellite(236, 140, 1.15, -14, C.blue)}
${sparkle(352, 116, 20, C.gold)}
${sparkle(146, 156, 8, C.white)}`;

writeFileSync(
  resolve(OUT, "code-blue-badge.svg"),
  svg("0 0 512 512", "CODE BLUE — a MISSION: POSSIBLE collection", collectionBadge({ name: "CODE BLUE", color: C.blue, art: codeBlueArt })),
);

/* ------------------------------------------------------------------ */
/* 5. Social card 1200x630.                                            */
/* ------------------------------------------------------------------ */
{
  const cap = 44;
  const ww = wordWidth("MISSION: POSSIBLE", cap);
  const body = `<defs><radialGradient id="bg" cx="70%" cy="40%" r="80%"><stop offset="0" stop-color="${C.navy2}"/><stop offset="1" stop-color="${C.ink}"/></radialGradient></defs>
<rect width="1200" height="630" fill="url(#bg)"/>
${starfield(3, 120, 600, 315, 640, 1.6)}
<g transform="translate(70 145) scale(.66)">${collectionBadge({ name: "CODE BLUE", color: C.blue, art: codeBlueArt }).replace(/id="(disc|sky)"/g, 'id="og-$1"').replace(/#(disc|sky)\)/g, "#og-$1)")}</g>
${word("MISSION: POSSIBLE", 470, 250, cap, C.white, { colon: C.gold })}
<rect x="470" y="326" width="${r(wordWidth("CODE BLUE", 22, 40) + 52)}" height="44" rx="22" fill="none" stroke="${C.blue}" stroke-width="3"/>
${word("CODE BLUE", 496, 337, 22, C.blue, { track: 40 })}
${sparkle(r(470 + ww + 26), 226, 20, C.gold)}`;
  writeFileSync(resolve(OUT, "mission-possible-og.svg"), svg("0 0 1200 630", "MISSION: POSSIBLE — Code Blue", body));
}

console.log("done");
