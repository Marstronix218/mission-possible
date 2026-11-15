"""Rasterise NASA observations onto the 20x20 mission grids.

Fetches PNG renderings from the public NASA GIBS WMS (no API key) and writes
per-cell summaries to scripts/data/observed/<slug>.json. The mission generator
(generate-mvp-missions.mjs) reads those files to set cell truth and eventDay.

Requires Python 3.9+, Pillow and curl. Run from anywhere:

    python3 scripts/data/fetch-nasa-hazards.py

Los Angeles: VIIRS 375 m thermal anomalies (Suomi NPP + NOAA-20), 7-13 Jan 2025;
             the mission runs 8-13 Jan (day 0 = 8 Jan).
Phoenix: MODIS Aqua 8-day daytime land-surface temperature (11-18 Jul 2024)
         restricted to populated cells from SEDAC GPWv4 2020 population density.
Houston: MODIS 3-day flood product for Hurricane Beryl is checked and recorded,
         but it is almost entirely cloud-obscured, so the mission stays modelled.
"""

import json
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlencode

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "scripts/data/observed"
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
COLORMAPS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3"
GRID = 20
ACCESSED_ON = "2026-11-14"
WORK = Path(tempfile.mkdtemp(prefix="nasa-hazards-"))


def wms_url(layer, bbox, time, width, height):
    params = dict(
        SERVICE="WMS", REQUEST="GetMap", VERSION="1.1.1", LAYERS=layer, STYLES="",
        FORMAT="image/png", TRANSPARENT="TRUE", WIDTH=width, HEIGHT=height,
        SRS="EPSG:4326", BBOX=",".join(str(v) for v in bbox),
    )
    if time:
        params["TIME"] = time
    return f"{WMS}?{urlencode(params)}"


def fetch(url, name):
    path = WORK / name
    subprocess.run(["curl", "-fLsS", "--max-time", "90", url, "-o", str(path)], check=True)
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" and data[:2] != b"\xff\xd8" and data[:5] != b"<?xml":
        raise SystemExit(f"{name}: unexpected response {data[:200]!r}")
    return path


def fetch_png(layer, bbox, time, width, height):
    url = wms_url(layer, bbox, time, width, height)
    path = fetch(url, f"{layer}_{time or 'static'}.png")
    if path.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{layer} {time}: not a PNG: {path.read_bytes()[:300]!r}")
    return Image.open(path).convert("RGBA"), url


def cell_of(x, y, width, height):
    """Image pixel -> (row, column); row 0 is the southern edge like the mission grid."""
    return GRID - 1 - int(y * GRID / height), int(x * GRID / width)


def colormap(name):
    """Exact RGB -> lower bound of the data value, from the GIBS colormap XML."""
    path = fetch(f"{COLORMAPS}/{name}.xml", f"{name}.xml")
    text = path.read_text()
    entries = re.findall(r'rgb="(\d+),(\d+),(\d+)" transparent="false"[^>]*?value="\[([-\d.]+)', text)
    return {(int(r), int(g), int(b)): float(v) for r, g, b, v in entries}


def write(slug, payload):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{slug}.json").write_text(json.dumps(payload, indent=2) + "\n")


# --------------------------------------------------------------------------- LA
LA_BBOX = [-118.95, 33.65, -117.55, 34.45]
FIRE_LAYERS = ["VIIRS_SNPP_Thermal_Anomalies_375m_All", "VIIRS_NOAA20_Thermal_Anomalies_375m_All"]
FIRE_DAYS = ["2025-01-07", "2025-01-08", "2025-01-09", "2025-01-10", "2025-01-11", "2025-01-12", "2025-01-13"]
# The mission starts on 8 Jan (day 0) and runs six days; cells already burning on
# 7 Jan (Palisades ignition day) are fire cells from day 0.
MISSION_START = 1
# Pre-event baseline used to mask persistent industrial heat sources (refinery
# and landfill flares) that VIIRS also reports as thermal anomalies.
BASELINE_DAYS = [f"2024-11-{d}" for d in range(18, 28)]
FIRE_SIZE = (700, 400)  # ~0.002 deg per pixel; one detection renders as ~12 opaque pixels
MIN_FIRE_PIXELS = 20  # at least ~2 detections in the cell on that day
BASELINE_FACTOR = 3  # and at least 3x the cell's pre-event maximum


def fire_pixels(layer, day):
    image, url = fetch_png(layer, LA_BBOX, day, *FIRE_SIZE)
    width, height = image.size
    counts = [[0] * GRID for _ in range(GRID)]
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] >= 128:
                row, column = cell_of(x, y, width, height)
                counts[row][column] += 1
    return counts, url


def los_angeles():
    def daily_max(days):
        result, urls = [], []
        for day in days:
            per_layer = []
            for layer in FIRE_LAYERS:
                counts, url = fire_pixels(layer, day)
                per_layer.append(counts)
                urls.append(url)
            result.append([[max(c[r][k] for c in per_layer) for k in range(GRID)] for r in range(GRID)])
        return result, urls

    event, event_urls = daily_max(FIRE_DAYS)
    baseline_days, _ = daily_max(BASELINE_DAYS)
    baseline = [[max(d[r][k] for d in baseline_days) for k in range(GRID)] for r in range(GRID)]

    cells = []
    for row in range(GRID):
        for column in range(GRID):
            daily = [event[d][row][column] for d in range(len(FIRE_DAYS))]
            threshold = max(MIN_FIRE_PIXELS, BASELINE_FACTOR * baseline[row][column])
            fire_days = [d for d, count in enumerate(daily) if count >= threshold]
            cells.append({
                "row": row, "column": column, "dailyFirePixels": daily,
                "baselineFirePixels": baseline[row][column],
                "truth": 1 if fire_days else 0,
                "eventDay": max(0, fire_days[0] - MISSION_START) if fire_days else 0,
            })

    write("los-angeles", {
        "slug": "los-angeles", "usable": True, "kind": "wildfire",
        "dataset": "VIIRS 375 m Thermal Anomalies and Fires (Suomi NPP and NOAA-20), via NASA GIBS WMS",
        "layers": FIRE_LAYERS, "eventDays": FIRE_DAYS, "missionStart": FIRE_DAYS[MISSION_START], "baselineDays": BASELINE_DAYS,
        "bbox": LA_BBOX, "imageSize": list(FIRE_SIZE),
        "method": (
            "Each day's PNG (UTC date) is rasterised to the 20x20 grid by counting opaque "
            "detection pixels per cell (max of the two satellites). A cell is a fire cell on "
            f"a day if it has >= {MIN_FIRE_PIXELS} pixels and >= {BASELINE_FACTOR}x its maximum "
            "over the pre-event baseline days, which masks persistent industrial heat sources. "
            "eventDay is the first such day counted from the mission start, 0 = 2025-01-08; "
            "cells first detected on 2025-01-07 are also day 0."
        ),
        "accessedOn": ACCESSED_ON, "exampleUrl": event_urls[0], "cells": cells,
    })
    fire = [c for c in cells if c["truth"]]
    print(f"los-angeles: {len(fire)} fire cells")
    for c in fire:
        lat = LA_BBOX[1] + (LA_BBOX[3] - LA_BBOX[1]) * (c["row"] + 0.5) / GRID
        lon = LA_BBOX[0] + (LA_BBOX[2] - LA_BBOX[0]) * (c["column"] + 0.5) / GRID
        print(f"  r{c['row']:02d}c{c['column']:02d} lat {lat:.3f} lon {lon:.3f} "
              f"day {c['eventDay']} pixels {c['dailyFirePixels']} baseline {c['baselineFirePixels']}")


# ---------------------------------------------------------------------- Phoenix
PHX_BBOX = [-112.55, 33.15, -111.55, 33.85]
LST_LAYER = "MODIS_Aqua_L3_Land_Surface_Temp_8Day_Day"
LST_DATE = "2024-07-11"  # 8-day composite covering 11-18 Jul 2024
POP_LAYER = "GPW_Population_Density_2020"
PHX_SIZE = (500, 350)
POPULATED_PER_KM2 = 500  # urban/suburban cells
HOT_FRACTION = 0.4  # hottest 40% of populated cells are heat-hazard cells


def cell_means(layer, date, cmap):
    image, url = fetch_png(layer, PHX_BBOX, date, *PHX_SIZE)
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
    if unknown:
        raise SystemExit(f"{layer}: {unknown} pixels did not match the colormap")
    return [[s / n if n else None for s, n in r] for r in sums], url


def phoenix():
    lst, lst_url = cell_means(LST_LAYER, LST_DATE, colormap("MODIS_Land_Surface_Temp"))
    pop, pop_url = cell_means(POP_LAYER, None, colormap(POP_LAYER))
    populated = [
        (lst[r][k], r, k) for r in range(GRID) for k in range(GRID)
        if lst[r][k] is not None and pop[r][k] is not None and pop[r][k] >= POPULATED_PER_KM2
    ]
    populated.sort(reverse=True)
    hot = {(r, k) for _, r, k in populated[: round(len(populated) * HOT_FRACTION)]}
    threshold_c = min(lst[r][k] for r, k in hot) - 273.15
    cells = [{
        "row": r, "column": k,
        "lstC": None if lst[r][k] is None else round(lst[r][k] - 273.15, 2),
        "populationPerKm2": None if pop[r][k] is None else round(pop[r][k], 1),
        "truth": 1 if (r, k) in hot else 0, "eventDay": 0,
    } for r in range(GRID) for k in range(GRID)]
    write("phoenix", {
        "slug": "phoenix", "usable": True, "kind": "heat",
        "dataset": "MODIS Aqua 8-day daytime land-surface temperature and SEDAC GPWv4 2020 population density, via NASA GIBS WMS",
        "layers": [LST_LAYER, POP_LAYER], "observedOn": "2024-07-11/2024-07-18",
        "bbox": PHX_BBOX, "imageSize": list(PHX_SIZE),
        "method": (
            "PNG pixels are converted back to data values with the exact GIBS colormaps and "
            f"averaged per grid cell. Cells with >= {POPULATED_PER_KM2} people/km2 are populated; "
            f"the hottest {round(HOT_FRACTION * 100)}% of populated cells by daytime land-surface "
            f"temperature (>= {threshold_c:.1f} C) are heat cells. eventDay is 0 for all cells."
        ),
        "accessedOn": ACCESSED_ON, "exampleUrl": lst_url, "populationUrl": pop_url, "cells": cells,
    })
    print(f"phoenix: {len(hot)} heat cells of {len(populated)} populated; threshold {threshold_c:.1f} C")


# ---------------------------------------------------------------------- Houston
HOU_BBOX = [-96.05, 29.35, -94.95, 30.15]
FLOOD_LAYER = "MODIS_Combined_Flood_3-Day"
FLOOD_DAYS = ["2024-07-09", "2024-07-10", "2024-07-11", "2024-07-12"]
FLOOD_RGB = (250, 30, 36)  # "flood" class in the GIBS MODIS flood legend
NO_DATA_RGB = (175, 175, 175)  # "insufficient data" (cloud) class


def houston():
    days = []
    for day in FLOOD_DAYS:
        image, url = fetch_png(FLOOD_LAYER, HOU_BBOX, day, 550, 400)
        data = list(image.getdata())
        days.append({
            "date": day, "url": url,
            "insufficientDataFraction": round(sum(p[:3] == NO_DATA_RGB and p[3] > 0 for p in data) / len(data), 3),
            "floodPixels": sum(p[:3] == FLOOD_RGB and p[3] > 0 for p in data),
        })
    write("houston", {
        "slug": "houston", "usable": False, "kind": "flood",
        "dataset": "MODIS NRT Global Flood Product (3-day composite), via NASA GIBS WMS",
        "layers": [FLOOD_LAYER], "bbox": HOU_BBOX, "days": days,
        "reason": (
            "After Hurricane Beryl (8 Jul 2024) the optical MODIS flood composite is almost "
            "entirely 'insufficient data' because of cloud, with only a few flood pixels. It "
            "cannot supply a defensible flood map, so the Houston grid remains an educational model."
        ),
        "accessedOn": ACCESSED_ON,
    })
    for d in days:
        print(f"houston {d['date']}: insufficient data {d['insufficientDataFraction']:.0%}, flood pixels {d['floodPixels']}")


if __name__ == "__main__":
    los_angeles()
    phoenix()
    houston()
