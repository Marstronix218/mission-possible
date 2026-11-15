"""Build hazard group B missions (heat + flood) from NASA GIBS imagery.

    python3 scripts/data/nasa-group-b.py [--work DIR]

Downloads PNG renderings from the public NASA GIBS WMS (no API key), converts
pixels back to data values with the exact GIBS colormaps, rasterises them onto
the 20x20 mission grid and writes:

  data/missions/<slug>.json   (truth + eventDay from NASA data; cloud and
                               detectability are modelled and labelled so)
  public/nasa/<slug>.jpg|json (true-colour context image for the event date)

Heat (san-francisco, chicago): MODIS Aqua 8-day daytime land-surface
temperature over the heat-wave week, restricted to populated cells (SEDAC
GPWv4 2020). Hot cells = hottest share of populated cells. eventDay = first
heat-wave day the cell's daily Aqua LST reached the hot threshold (clouds hide
some days; never-seen cells keep day 0, when the composite already shows them).

Flood (seattle, st-louis, atlanta, new-york-city): optical/SAR flood layers
(MODIS Combined Flood, OPERA DSWx-S1) were checked but are cloud-obscured or
have no pass on the event days. Flood cells are therefore a PROXY: populated
cells under the heaviest GPM IMERG observed rainfall for the event, plus any
cell where the MODIS 2-day flood product did record flood pixels. eventDay =
day the cell's cumulative IMERG rain first reached half of its event total,
counted from the mission's alert day (lead-in rain before it counts as day 0).

Requires Python 3.9+, Pillow and curl.
"""

import argparse
import json
import re
import subprocess
import tempfile
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlencode

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MISSIONS = ROOT / "data/missions"
PUBLIC = ROOT / "public/nasa"
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
COLORMAPS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3"
GRID = 20
ACCESSED_ON = "2026-11-14"
PNG = b"\x89PNG\r\n\x1a\n"
JPEG = b"\xff\xd8"

LST_8DAY = "MODIS_Aqua_L3_Land_Surface_Temp_8Day_Day"
LST_DAILY = "MODIS_Aqua_L3_Land_Surface_Temp_Daily_Day"
POP = "GPW_Population_Density_2020"
IMERG = "IMERG_Precipitation_Rate"
MODIS_FLOOD = "MODIS_Combined_Flood_2-Day"
DSWX_S1 = "OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1"
TRUE_COLOR = "MODIS_Terra_CorrectedReflectance_TrueColor"
FLOOD_RGB = (250, 30, 36)  # "Flood" class in the MODIS flood colormap
NO_DATA_RGB = (175, 175, 175)  # "Insufficient Data" (cloud) class
FLOOD_MIN_PIXELS = 20

WORK = Path(tempfile.mkdtemp(prefix="nasa-group-b-"))

SOURCES = {
    "lst": {
        "name": "NASA MODIS Aqua 8-day and daily daytime land-surface temperature (via NASA GIBS)",
        "url": "https://www.earthdata.nasa.gov/data/catalog/lpcloud-myd11a2-061",
    },
    "pop": {
        "name": "NASA SEDAC Gridded Population of the World v4, 2020 density (via NASA GIBS)",
        "url": "https://www.earthdata.nasa.gov/data/projects/gpw",
        "usage": "Cells with at least {pop} people per square kilometre count as populated neighbourhoods.",
    },
    "imerg": {
        "name": "NASA GPM IMERG daily precipitation (via NASA GIBS)",
        "url": "https://gpm.nasa.gov/data/imerg",
    },
    "flood": {
        "name": "NASA MODIS NRT Global Flood Product, 2-day composite (via NASA GIBS)",
        "url": "https://www.earthdata.nasa.gov/data/instruments/modis/near-real-time-nrt/global-flood-product",
    },
}

# ----------------------------------------------------------------- missions
# Constraints are tuned with the real parts catalog so a right-sensor design
# can succeed, a wrong-sensor design fails and weak comms deliver late.
HEAT = [
    {
        "slug": "san-francisco", "city": "San Francisco", "seed": 9062022,
        "bbox": [-122.85, 37.3, -121.55, 38.1],
        "objective": "Find the hottest Bay Area neighbourhoods during the heat wave so cooling help reaches them first.",
        "composite": "2022-09-06", "days": ["2022-09-05", "2022-09-06", "2022-09-07", "2022-09-08", "2022-09-09"],
        "event": "Sept 2022 Bay Area heat wave", "period": "6-13 Sep 2022",
        "pop": 500, "hotFraction": 0.3, "cloudBase": 0.1,
        "constraints": {"budgetM": 160, "massKg": 340}, "durationDays": 7, "targetResponseHours": 18,
        "context": "2022-09-06",
    },
    {
        "slug": "chicago", "city": "Chicago", "seed": 6172024,
        "bbox": [-88.45, 41.45, -87.25, 42.25],
        "objective": "Map the hottest Chicago-area neighbourhoods so cooling centres open where heat is worst.",
        "composite": "2024-06-17", "days": ["2024-06-16", "2024-06-17", "2024-06-18", "2024-06-19", "2024-06-20", "2024-06-21"],
        "event": "June 2024 Midwest heat dome", "period": "17-24 Jun 2024",
        "pop": 500, "hotFraction": 0.25, "cloudBase": 0.22,
        "constraints": {"budgetM": 200, "massKg": 400}, "durationDays": 8, "targetResponseHours": 24,
        "context": "2024-06-18",
    },
]

FLOOD = [
    {
        "slug": "seattle", "city": "Seattle", "seed": 12102025,
        "bbox": [-122.75, 47.15, -121.45, 48.05],
        "objective": "Map river flooding around Seattle through atmospheric-river clouds and warn valley towns in time.",
        "start": "2025-12-09", "days": ["2025-12-08", "2025-12-09", "2025-12-10", "2025-12-11", "2025-12-12"],
        "dswx": ["2025-12-05", "2025-12-10", "2025-12-17"],
        "event": "December 2025 Pacific Northwest atmospheric river", "period": "8-12 Dec 2025",
        "pop": 100, "wetFraction": 0.3, "cloudBase": 0.72,
        "constraints": {"budgetM": 300, "massKg": 620}, "durationDays": 8, "targetResponseHours": 18,
        "context": "2025-12-11",
    },
    {
        "slug": "st-louis", "city": "St. Louis", "seed": 7262022,
        "bbox": [-90.85, 38.25, -89.55, 39.05],
        "objective": "Spot flash-flooded St. Louis streets after record overnight rain and guide rescuers fast.",
        "start": "2022-07-26", "days": ["2022-07-25", "2022-07-26", "2022-07-27", "2022-07-28"],
        "event": "26 July 2022 St. Louis flash flood", "period": "25-28 Jul 2022",
        "pop": 500, "wetFraction": 0.35, "cloudBase": 0.6,
        "constraints": {"budgetM": 280, "massKg": 600}, "durationDays": 5, "targetResponseHours": 10,
        "context": "2022-07-27",
    },
    {
        "slug": "atlanta", "city": "Atlanta", "seed": 9272024,
        "bbox": [-85.0, 33.35, -83.8, 34.15],
        "objective": "Map creek and street flooding across Atlanta under Hurricane Helene's clouds.",
        "start": "2024-09-26", "days": ["2024-09-24", "2024-09-25", "2024-09-26", "2024-09-27", "2024-09-28"],
        "dswx": ["2024-09-26"],
        "event": "Hurricane Helene rain in Atlanta", "period": "24-28 Sep 2024",
        "pop": 500, "wetFraction": 0.3, "cloudBase": 0.74,
        "constraints": {"budgetM": 340, "massKg": 700}, "durationDays": 6, "targetResponseHours": 12,
        "context": "2024-09-28",
    },
    {
        "slug": "new-york-city", "city": "New York City", "seed": 9012021,
        "bbox": [-74.6, 40.35, -73.4, 41.15],
        "objective": "Find flooded New York neighbourhoods after Ida's record downpour and route help to basements and subways.",
        "start": "2021-09-01", "days": ["2021-08-31", "2021-09-01", "2021-09-02", "2021-09-03"],
        "event": "remnants of Hurricane Ida", "period": "31 Aug-3 Sep 2021",
        "pop": 1000, "wetFraction": 0.2, "cloudBase": 0.72,
        "constraints": {"budgetM": 420, "massKg": 760}, "durationDays": 5, "targetResponseHours": 8,
        "context": "2021-09-02",
    },
]


# ------------------------------------------------------------------ helpers
def wms_url(layer, bbox, time, width, height, fmt="image/png"):
    params = dict(
        SERVICE="WMS", REQUEST="GetMap", VERSION="1.1.1", LAYERS=layer, STYLES="",
        FORMAT=fmt, WIDTH=width, HEIGHT=height, SRS="EPSG:4326",
        BBOX=",".join(str(v) for v in bbox),
    )
    if fmt == "image/png":
        params["TRANSPARENT"] = "TRUE"
    if time:
        params["TIME"] = time
    return f"{WMS}?{urlencode(params)}"


def fetch(url, name, magic):
    path = WORK / name
    if not path.exists():
        subprocess.run(["curl", "-fLsS", "--max-time", "120", url, "-o", str(path)], check=True)
    data = path.read_bytes()
    if not data.startswith(magic):
        path.unlink()
        raise SystemExit(f"{name}: unexpected response {data[:300]!r}")
    return path


def size_for(bbox, width=520):
    return width, round(width * (bbox[3] - bbox[1]) / (bbox[2] - bbox[0]))


def fetch_png(layer, bbox, time, slug):
    width, height = size_for(bbox)
    url = wms_url(layer, bbox, time, width, height)
    path = fetch(url, f"{slug}_{layer}_{time or 'static'}.png", PNG)
    return Image.open(path).convert("RGBA"), url


def colormap(name, titles=None):
    """Exact RGB -> data value (midpoint of the class range); optionally only the named ColorMaps."""
    path = fetch(f"{COLORMAPS}/{name}.xml", f"cm_{name}.xml", b"<?xml")
    text = path.read_text()
    if titles:
        parts = []
        for title in titles:
            start = text.index(f'title="{title}"')
            parts.append(text[start:text.index("</ColorMap>", start)])
        text = "".join(parts)
    result = {}
    for r, g, b, low, high in re.findall(
        r'rgb="(\d+),(\d+),(\d+)" transparent="false"[^>]*?value="\[([-\d.INF]+),([-\d.INF]+)[)\]]"', text
    ):
        low_v = float(low) if "INF" not in low else float(high)
        high_v = float(high) if "INF" not in high else low_v
        result.setdefault((int(r), int(g), int(b)), (low_v + high_v) / 2)
    return result


def cell_of(x, y, width, height):
    """Image pixel -> (row, column); row 0 is the southern edge like the mission grid."""
    return GRID - 1 - int(y * GRID / height), int(x * GRID / width)


def cell_means(image, cmap, label):
    width, height = image.size
    sums = [[[0.0, 0] for _ in range(GRID)] for _ in range(GRID)]
    pixels = image.load()
    unknown = 0
    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            if pixel[3] == 0:
                continue
            value = cmap.get(pixel[:3])
            if value is None:
                unknown += 1
                continue
            row, column = cell_of(x, y, width, height)
            sums[row][column][0] += value
            sums[row][column][1] += 1
    if unknown > 0.001 * width * height:
        raise SystemExit(f"{label}: {unknown} pixels did not match the colormap")
    return [[s / n if n >= 10 else None for s, n in r] for r in sums]


def class_counts(image, rgb):
    width, height = image.size
    counts = [[0] * GRID for _ in range(GRID)]
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            if pixel[3] > 0 and pixel[:3] == rgb:
                row, column = cell_of(x, y, width, height)
                counts[row][column] += 1
    return counts


def fraction(image, rgb):
    data = list(image.getdata())
    return round(sum(p[3] > 0 and p[:3] == rgb for p in data) / len(data), 4)


def pseudo_random(seed, index):
    """Same integer hash as scripts/data/generate-mvp-missions.mjs."""
    mask = 0xFFFFFFFF
    value = (seed ^ ((index + 1) * 0x9E3779B1)) & mask
    value = ((value ^ (value >> 16)) * 0x85EBCA6B) & mask
    value = ((value ^ (value >> 13)) * 0xC2B2AE35) & mask
    return ((value ^ (value >> 16)) & mask) / 4_294_967_296


def clamp(value, low, high):
    return min(high, max(low, value))


def day_index(days, iso):
    return (date.fromisoformat(iso) - date.fromisoformat(days[0])).days


def build_grid(config, truth, event_day, cloud, detect):
    west, south, east, north = config["bbox"]
    grid = []
    for row in range(GRID):
        for column in range(GRID):
            grid.append({
                "id": f"r{row:02d}c{column:02d}", "row": row, "column": column,
                "lat": round(south + (north - south) * (row + 0.5) / GRID, 5),
                "lon": round(west + (east - west) * (column + 0.5) / GRID, 5),
                "truth": truth[row][column],
                "cloudProbability": round(cloud[row][column], 3),
                "detectability": round(detect[row][column], 3),
                "eventDay": event_day[row][column] if truth[row][column] else 0,
            })
    return grid


def write_mission(config, category, grid, sources):
    mission = {
        "slug": config["slug"], "city": config["city"], "category": category,
        "objective": {"en": config["objective"]}, "bbox": config["bbox"],
        "defaultConstraints": config["constraints"], "durationDays": config["durationDays"],
        "seed": config["seed"], "targetResponseHours": config["targetResponseHours"],
        "grid": grid,
        "sources": [{**s, "accessedOn": ACCESSED_ON} for s in sources],
    }
    hazards = sum(c["truth"] for c in grid)
    assert len(grid) == GRID * GRID and 0 < hazards < len(grid)
    assert all(c["eventDay"] < config["durationDays"] for c in grid)
    (MISSIONS / f"{config['slug']}.json").write_text(json.dumps(mission, indent=2) + "\n")
    return hazards


def context_image(config, label, note=""):
    bbox = config["bbox"]
    width, height = size_for(bbox, 640)
    url = wms_url(TRUE_COLOR, bbox, config["context"], width, height, "image/jpeg")
    data = fetch(url, f"{config['slug']}_context.jpg", JPEG).read_bytes()
    (PUBLIC / f"{config['slug']}.jpg").write_bytes(data)
    assert (PUBLIC / f"{config['slug']}.jpg").read_bytes()[:2] == JPEG
    meta = {
        "source": "NASA GIBS / Terra MODIS corrected reflectance, true color",
        "observedOn": config["context"], "accessedOn": ACCESSED_ON, "bbox": bbox, "url": url,
        "usage": (
            f"Observed true-color imagery during the {label} for geographical context{note}. "
            "Not a hazard label or scoring ground truth."
        ),
    }
    (PUBLIC / f"{config['slug']}.json").write_text(json.dumps(meta, indent=2) + "\n")


# --------------------------------------------------------------------- heat
def heat(config):
    slug, bbox = config["slug"], config["bbox"]
    lst_cmap = colormap("MODIS_Land_Surface_Temp")
    composite, lst_url = fetch_png(LST_8DAY, bbox, config["composite"], slug)
    lst = cell_means(composite, lst_cmap, f"{slug} {LST_8DAY}")
    pop_image, _ = fetch_png(POP, bbox, None, slug)
    pop = cell_means(pop_image, colormap(POP), f"{slug} {POP}")

    populated = sorted(
        ((lst[r][k], r, k) for r in range(GRID) for k in range(GRID)
         if lst[r][k] is not None and pop[r][k] is not None and pop[r][k] >= config["pop"]),
        reverse=True,
    )
    hot = {(r, k) for _, r, k in populated[: round(len(populated) * config["hotFraction"])]}
    threshold = min(lst[r][k] for r, k in hot)
    hottest = populated[0][0]

    daily = []
    for day in config["days"]:
        image, _ = fetch_png(LST_DAILY, bbox, day, slug)
        daily.append(cell_means(image, lst_cmap, f"{slug} {LST_DAILY} {day}"))

    truth = [[0] * GRID for _ in range(GRID)]
    event_day = [[0] * GRID for _ in range(GRID)]
    cloud = [[0.0] * GRID for _ in range(GRID)]
    detect = [[0.0] * GRID for _ in range(GRID)]
    seen_late = 0
    for r in range(GRID):
        for k in range(GRID):
            index = r * GRID + k
            if (r, k) in hot:
                truth[r][k] = 1
                # first heat-wave day this cell was observed at or above the hot threshold
                # (0.5 K tolerance for daily vs 8-day averaging).
                hits = [d for d, grid in enumerate(daily) if grid[r][k] is not None and grid[r][k] >= threshold - 0.5]
                event_day[r][k] = hits[0] if hits else 0
                seen_late += bool(hits and hits[0] > 0)
            # Modelled: mostly clear heat-wave skies (coastal fog / storms add a little).
            cloud[r][k] = clamp(config["cloudBase"] + (pseudo_random(config["seed"] + 17, index) - 0.5) * 0.16, 0.02, 0.95)
            # Modelled: hotter cells stand out more clearly from their surroundings.
            signal = 0.0 if lst[r][k] is None else clamp((lst[r][k] - threshold + 6) / (hottest - threshold + 6), 0, 1)
            detect[r][k] = clamp(0.62 + 0.2 * signal + pseudo_random(config["seed"] + 31, index) * 0.16, 0.5, 0.98)

    grid = build_grid(config, truth, event_day, cloud, detect)
    sources = [
        {
            **SOURCES["lst"],
            "usage": (
                f"Observed: heat cells are the hottest {round(config['hotFraction'] * 100)}% of populated cells by "
                f"MODIS Aqua 8-day daytime land-surface temperature, {config['period']} ({config['event']}; "
                f"threshold {threshold - 273.15:.1f} C). eventDay is the first day of {config['days'][0]} to "
                f"{config['days'][-1]} that daily Aqua LST reached the threshold (day 0 = {config['days'][0]}; "
                "cells hidden by cloud every day stay at day 0). Cloud blocking and sensor detectability are modelled "
                "(mostly clear skies)."
            ),
            "provenance": "nasa-observed",
        },
        {**SOURCES["pop"], "usage": SOURCES["pop"]["usage"].format(pop=config["pop"]), "provenance": "nasa-observed"},
    ]
    hazards = write_mission(config, "heat", grid, sources)
    context_image(config, config["event"])
    print(f"{slug}: {hazards} heat cells of {len(populated)} populated; threshold {threshold - 273.15:.1f} C; "
          f"{seen_late} cells first hot after day 0; days {sorted({c['eventDay'] for c in grid if c['truth']})}")
    print(f"  example {lst_url}")


# -------------------------------------------------------------------- flood
def flood(config):
    slug, bbox = config["slug"], config["bbox"]
    rain_cmap = colormap("GPM_Precipitation_Rate", ["Rain Rate", "Snow Rate"])
    pop_image, _ = fetch_png(POP, bbox, None, slug)
    pop = cell_means(pop_image, colormap(POP), f"{slug} {POP}")

    daily_mm, flood_counts, checks = [], [], []
    imerg_url = None
    for day in config["days"]:
        image, url = fetch_png(IMERG, bbox, day, slug)
        imerg_url = imerg_url or url
        rate = cell_means(image, rain_cmap, f"{slug} {IMERG} {day}")
        # Daily IMERG is rendered as a mean rate in mm/hr (rain, or liquid-equivalent snow on
        # high terrain): x24 gives the day's total.
        daily_mm.append([[0.0 if v is None else v * 24 for v in row] for row in rate])
        flood_image, _ = fetch_png(MODIS_FLOOD, bbox, day, slug)
        flood_counts.append(class_counts(flood_image, FLOOD_RGB))
        checks.append({"layer": MODIS_FLOOD, "date": day,
                       "insufficientData": fraction(flood_image, NO_DATA_RGB),
                       "flood": fraction(flood_image, FLOOD_RGB)})
    for day in config.get("dswx", []):
        image, _ = fetch_png(DSWX_S1, bbox, day, slug)
        opaque = sum(p[3] > 0 for p in image.getdata()) / (image.size[0] * image.size[1])
        checks.append({"layer": DSWX_S1, "date": day, "coverage": round(opaque, 3)})

    total = [[sum(d[r][k] for d in daily_mm) for k in range(GRID)] for r in range(GRID)]
    start = day_index(config["days"], config["start"])
    populated = sorted(
        ((total[r][k], r, k) for r in range(GRID) for k in range(GRID)
         if pop[r][k] is not None and pop[r][k] >= config["pop"]),
        reverse=True,
    )
    wet = {(r, k) for _, r, k in populated[: round(len(populated) * config["wetFraction"])]}
    rain_threshold = min(total[r][k] for r, k in wet)
    # A cell counts as observed flooding when a later 2-day composite has >= FLOOD_MIN_PIXELS
    # flood pixels (~5% of the cell) and the first (pre-peak) composite had almost none, which
    # drops shoreline/tidal pixels the NRT product flags before the storm.
    observed = {(r, k) for r in range(GRID) for k in range(GRID)
                if flood_counts[0][r][k] < 5 and any(c[r][k] >= FLOOD_MIN_PIXELS for c in flood_counts[1:])}
    max_total = max(max(row) for row in total) or 1

    truth = [[0] * GRID for _ in range(GRID)]
    event_day = [[0] * GRID for _ in range(GRID)]
    cloud = [[0.0] * GRID for _ in range(GRID)]
    detect = [[0.0] * GRID for _ in range(GRID)]
    for r in range(GRID):
        for k in range(GRID):
            index = r * GRID + k
            if (r, k) in wet or (r, k) in observed:
                truth[r][k] = 1
                if (r, k) in wet:
                    running, day = 0.0, 0
                    for day, grid in enumerate(daily_mm):
                        running += grid[r][k]
                        if running >= total[r][k] / 2:
                            break
                else:
                    day = next(d for d, c in enumerate(flood_counts) if d and c[r][k] >= FLOOD_MIN_PIXELS)
                # Mission day 0 is the alert day; earlier lead-in rain counts as day 0.
                event_day[r][k] = max(0, day - start)
            # Modelled: storm clouds, heavier where IMERG saw more rain.
            cloud[r][k] = clamp(config["cloudBase"] + 0.15 * total[r][k] / max_total
                                + (pseudo_random(config["seed"] + 17, index) - 0.5) * 0.2, 0.05, 0.95)
            detect[r][k] = clamp(0.66 + pseudo_random(config["seed"] + 31, index) * 0.3, 0.5, 0.98)

    grid = build_grid(config, truth, event_day, cloud, detect)
    checked = "; ".join(
        f"{c['date']} {round(c['insufficientData'] * 100)}% no-data, {c['flood'] * 100:.1f}% flood"
        if c["layer"] == MODIS_FLOOD else f"{c['date']} DSWx-S1 coverage {round(c['coverage'] * 100)}%"
        for c in checks
    )
    sources = [
        {
            **SOURCES["imerg"],
            "usage": (
                f"Observed rainfall, {config['period']} ({config['event']}). Flood cells are a heavy-rain PROXY, not "
                f"mapped flood water: the wettest {round(config['wetFraction'] * 100)}% of populated cells by IMERG "
                f"event total (at least {rain_threshold:.0f} mm). eventDay is the day a cell's cumulative IMERG rain "
                f"first reached half its event total (mission day 0 = {config['start']}; earlier lead-in rain counts as day 0)."
            ),
            "provenance": "nasa-observed",
        },
        {**SOURCES["pop"], "usage": SOURCES["pop"]["usage"].format(pop=config["pop"]), "provenance": "nasa-observed"},
        {
            **SOURCES["flood"],
            "usage": (
                (f"Cells with {FLOOD_MIN_PIXELS}+ MODIS flood pixels (about 5% of the cell) in a composite after "
                 f"{config['days'][0]}, and almost none on {config['days'][0]} (masks shoreline false alarms), are added "
                 f"as observed flood cells ({len(observed)} cells). " if observed else
                 "Checked for observed flood water but no usable flood pixels were recorded. ")
                + f"Checks: {checked}."
            ),
            "provenance": "nasa-observed",
        },
        {
            "name": "Cloud cover and sensor detectability (educational model)",
            "url": "https://gpm.nasa.gov/data/imerg",
            "usage": (
                "Not observed: per-cell cloud probability is a model (storm-cloud base, higher where IMERG rain was "
                "heavier) and detectability is a seeded model. The heavy-rain-to-flood rule is also a simplification."
            ),
            "provenance": "educational-model",
        },
    ]
    hazards = write_mission(config, "flood", grid, sources)
    context_image(config, config["event"], "; storm clouds hide the ground, which is why ordinary cameras struggle")
    print(f"{slug}: {hazards} flood cells ({len(wet)} heavy-rain of {len(populated)} populated, "
          f"{len(observed)} MODIS-observed); rain >= {rain_threshold:.0f} mm, max {max_total:.0f} mm; "
          f"days {sorted({c['eventDay'] for c in grid if c['truth']})}")
    print(f"  checks: {checked}")
    print(f"  example {imerg_url}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", help="cache directory for raw downloads")
    parser.add_argument("slugs", nargs="*")
    args = parser.parse_args()
    if args.work:
        WORK = Path(args.work)
        WORK.mkdir(parents=True, exist_ok=True)
    for config in HEAT:
        if not args.slugs or config["slug"] in args.slugs:
            heat(config)
    for config in FLOOD:
        if not args.slugs or config["slug"] in args.slugs:
            flood(config)
