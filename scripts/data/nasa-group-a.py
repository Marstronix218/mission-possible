"""Build hazard-group-A missions (snow, drought, storm, glacier, volcano) from NASA data.

Fetches PNG renderings from the public NASA GIBS WMS (no API key), inverts the
published GIBS colormaps back to data values, and rasterises them onto each
mission's 20x20 grid. Writes data/missions/<slug>.json and a true-colour context
image public/nasa/<slug>.jpg|json.

    python3 scripts/data/nasa-group-a.py [slug ...]

Requires Python 3.9+ and Pillow. Raw downloads are cached in $NASA_GROUP_A_CACHE
(default: a temporary directory) and never written into the repository.

Truth (hazard) values are derived from NASA observations/analyses; the cut-off
that turns a continuous signal into "hazard" cells is a game-design choice.
cloudProbability and detectability are educational models (seeded noise around a
per-mission climate baseline), not observations.
"""

import datetime as dt
import io
import json
import os
import re
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MISSIONS = ROOT / "data/missions"
PUBLIC = ROOT / "public/nasa"
CACHE = Path(os.environ.get("NASA_GROUP_A_CACHE") or tempfile.mkdtemp(prefix="nasa-group-a-"))
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
COLORMAPS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3"
GRID = 20
ACCESSED_ON = "2026-11-14"
PNG = b"\x89PNG\r\n\x1a\n"
JPEG = b"\xff\xd8"

IMERG = "IMERG_Precipitation_Rate"
NDSI = "MODIS_Terra_NDSI_Snow_Cover"
SMAP = "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture"
VIIRS_FIRE = "VIIRS_SNPP_Thermal_Anomalies_375m_All"
TRUE_COLOR = "MODIS_Terra_CorrectedReflectance_TrueColor"

SOURCE_INFO = {
    IMERG: ("NASA GPM IMERG daily precipitation rate (GIBS layer IMERG_Precipitation_Rate)",
            "https://gpm.nasa.gov/data/imerg"),
    NDSI: ("NASA Terra MODIS NDSI snow cover (GIBS layer MODIS_Terra_NDSI_Snow_Cover)",
           "https://nsidc.org/data/mod10a1"),
    SMAP: ("NASA SMAP L4 analyzed root-zone soil moisture (GIBS layer SMAP_L4_Analyzed_Root_Zone_Soil_Moisture)",
           "https://nsidc.org/data/spl4smau"),
    VIIRS_FIRE: ("NASA Suomi NPP VIIRS 375 m thermal anomalies (GIBS layer VIIRS_SNPP_Thermal_Anomalies_375m_All)",
                 "https://firms.modaps.eosdis.nasa.gov/"),
}


def days(start, count):
    first = dt.date.fromisoformat(start)
    return [(first + dt.timedelta(i)).isoformat() for i in range(count)]


# Constraints are tuned with a runSimulation sweep so the right sensor family wins
# and a wrong one fails; see the story file for the in-world reasons.
CONFIGS = {
    "denver": dict(
        city="Denver", category="snow", seed=3142024, bbox=[-105.7, 39.3, -104.3, 40.2],
        objective="Map the heaviest new snow from the March 2024 blizzard so plow and power crews know where to go first.",
        start="2024-03-13", durationDays=7, targetResponseHours=24, budgetM=175, massKg=420,
        method="snow", precipDays=days("2024-03-13", 3), snowDays=days("2024-03-15", 5),
        targetShare=0.18, cloudBase=0.45, contextDate="2024-03-16",
        event="the 13-15 March 2024 Front Range blizzard",
    ),
    "minneapolis": dict(
        city="Minneapolis", category="snow", seed=4142018, bbox=[-94.0, 44.5, -92.5, 45.45],
        objective="Map the deepest snow bands of the April 2018 blizzard so the city can reopen roads and check roofs.",
        start="2018-04-13", durationDays=7, targetResponseHours=30, budgetM=170, massKg=400,
        method="snow", precipDays=days("2018-04-13", 4), snowDays=days("2018-04-17", 4),
        targetShare=0.18, cloudBase=0.55, contextDate="2018-04-17",
        event="the 13-16 April 2018 Upper Midwest blizzard",
    ),
    "boston": dict(
        city="Boston", category="snow", seed=1292022, bbox=[-71.75, 41.95, -70.35, 42.8],
        objective="Find the hardest-hit snow areas after the January 2022 nor'easter so crews can clear roads to hospitals.",
        start="2022-01-29", durationDays=7, targetResponseHours=20, budgetM=175, massKg=450,
        method="snow", precipDays=days("2022-01-29", 2), snowDays=days("2022-01-30", 3),
        targetShare=0.2, cloudBase=0.5, contextDate="2022-01-30",
        event="the 28-29 January 2022 nor'easter blizzard",
    ),
    "salt-lake-city": dict(
        city="Salt Lake City", category="drought", seed=7252022, bbox=[-112.65, 40.25, -111.15, 41.2],
        objective="Find the driest ground around the shrinking Great Salt Lake during the July 2022 drought.",
        start="2022-07-19", durationDays=7, targetResponseHours=72, budgetM=160, massKg=450,
        method="drought", smapDays=days("2022-07-19", 7),
        targetShare=0.18, cloudBase=0.1, contextDate="2022-07-25",
        event="the summer 2022 drought, when the Great Salt Lake hit a record low",
    ),
    "oklahoma-city": dict(
        city="Oklahoma City", category="storm", seed=4282024, bbox=[-98.25, 35.0, -96.8, 35.95],
        objective="Track the heaviest rain cores of the April 2024 severe storms fast enough to warn neighborhoods.",
        start="2024-04-26", durationDays=5, targetResponseHours=10, budgetM=160, massKg=400,
        method="storm", precipDays=days("2024-04-26", 4),
        targetShare=0.18, cloudBase=0.7, contextDate="2024-04-30",
        event="the 26-28 April 2024 severe storm outbreak",
    ),
    "miami": dict(
        city="Miami", category="storm", seed=6122024, bbox=[-80.9, 25.25, -79.6, 26.25],
        objective="Find where the June 2024 rainstorm is dumping the most rain before streets flood.",
        start="2024-06-11", durationDays=4, targetResponseHours=12, budgetM=160, massKg=420,
        method="storm", precipDays=days("2024-06-11", 4),
        targetShare=0.18, cloudBase=0.78, contextDate="2024-06-14",
        event="the 11-14 June 2024 South Florida rainstorm",
    ),
    "new-orleans": dict(
        city="New Orleans", category="storm", seed=8292021, bbox=[-90.8, 29.45, -89.35, 30.45],
        objective="Track Hurricane Ida's heaviest rain bands so pump and levee crews know where water will rise.",
        start="2021-08-29", durationDays=5, targetResponseHours=16, budgetM=160, massKg=450,
        method="storm", precipDays=days("2021-08-29", 3),
        targetShare=0.18, cloudBase=0.82, contextDate="2021-08-31",
        event="Hurricane Ida's landfall on 29-30 August 2021",
    ),
    "anchorage": dict(
        city="Anchorage", category="glacier", seed=8272024, bbox=[-150.3, 60.8, -148.7, 61.6],
        objective="Map the glacier ice that survives the summer melt in the mountains east of Anchorage.",
        start="2024-08-20", durationDays=21, targetResponseHours=72, budgetM=160, massKg=480,
        method="glacier", snowDays=days("2024-08-20", 21),
        targetShare=0.12, cloudBase=0.6, contextDate="2024-08-27",
        event="the end of the summer 2024 melt season (20 August - 9 September 2024)",
    ),
    "hilo": dict(
        city="Hilo", category="volcano", seed=5222018, bbox=[-155.6, 19.3, -154.6, 19.76],
        objective="Track active lava from Kilauea's 2018 eruption so Hilo-area responders know which areas are burning.",
        start="2018-05-28", durationDays=14, targetResponseHours=24, budgetM=175, massKg=500,
        method="volcano", fireDays=days("2018-05-03", 39), fireOffset=25, baselineDays=days("2018-04-10", 6), maxLat=19.6,
        targetShare=None, cloudBase=0.5, contextDate="2018-06-04",
        event="the 2018 lower Puna eruption of Kilauea (eruption began 3 May; mission window 28 May - 10 June 2018)",
    ),
}


# ---------------------------------------------------------------- fetching

def get(url, magic, name):
    path = CACHE / name
    if not path.exists():
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read()
        if not data.startswith(magic):
            raise SystemExit(f"Unexpected response for {name}: {data[:300]!r}")
        path.write_bytes(data)
    return path


def wms_url(layer, bbox, time, width, height, fmt="image/png"):
    params = dict(SERVICE="WMS", REQUEST="GetMap", VERSION="1.1.1", LAYERS=layer, STYLES="",
                  FORMAT=fmt, WIDTH=width, HEIGHT=height, SRS="EPSG:4326",
                  BBOX=",".join(str(v) for v in bbox), TIME=time)
    if fmt == "image/png":
        params["TRANSPARENT"] = "TRUE"
    return f"{WMS}?{urllib.parse.urlencode(params)}"


def layer_png(layer, bbox, time):
    width = 400
    height = round(width * (bbox[3] - bbox[1]) / (bbox[2] - bbox[0]))
    name = re.sub(r"[^A-Za-z0-9]+", "_", f"{layer}_{time}_{bbox}") + ".png"
    return Image.open(get(wms_url(layer, bbox, time, width, height), PNG, name)).convert("RGBA")


def colormap(name):
    """Exact RGB -> lower bound of the data value, from the GIBS colormap XML."""
    text = get(f"{COLORMAPS}/{name}.xml", b"<?xml", f"{name}.xml").read_text()
    table = {}
    for r, g, b, value in re.findall(
        r'rgb="(\d+),(\d+),(\d+)" transparent="false"[^>]*?sourceValue="[\[(]?([-\d.]+)', text
    ):
        table[(int(r), int(g), int(b))] = float(value)
    return table


def cell_pixels(image, table=None):
    """Per cell list of decoded values (None = transparent / no data)."""
    width, height = image.size
    pixels = image.load()
    cells = [[[] for _ in range(GRID)] for _ in range(GRID)]
    for y in range(height):
        row = GRID - 1 - int(y * GRID / height)  # row 0 is the southern edge
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 128:
                value = None
            elif table is None:
                value = 1.0
            else:
                value = table.get((r, g, b))
            cells[row][int(x * GRID / width)].append(value)
    return cells


def cell_mean(cell, missing=0.0):
    return sum(missing if v is None else v for v in cell) / len(cell)


def cell_fraction(cell, test):
    return sum(1 for v in cell if v is not None and test(v)) / len(cell)


def per_cell(cells, fn):
    return [[fn(cells[r][c]) for c in range(GRID)] for r in range(GRID)]


# ---------------------------------------------------------------- hazard signals

def snow_signal(cfg):
    """Storm-total IMERG precipitation, kept only where MODIS confirms snow on the ground afterwards."""
    rain = colormap("GPM_Precipitation_Rate")
    ndsi = colormap("MODIS_NDSI_Snow_Cover")
    daily = [per_cell(cell_pixels(layer_png(IMERG, cfg["bbox"], d), rain), cell_mean) for d in cfg["precipDays"]]
    snow = [[0.0] * GRID for _ in range(GRID)]
    for d in cfg["snowDays"]:
        frac = per_cell(cell_pixels(layer_png(NDSI, cfg["bbox"], d), ndsi), lambda c: cell_fraction(c, lambda v: v >= 40))
        snow = [[max(snow[r][c], frac[r][c]) for c in range(GRID)] for r in range(GRID)]
    total = [[sum(day[r][c] for day in daily) for c in range(GRID)] for r in range(GRID)]
    score = [[total[r][c] if snow[r][c] >= 0.3 else 0.0 for c in range(GRID)] for r in range(GRID)]
    return score, cumulative_event_days(daily, total), dict(snowCells=sum(s >= 0.3 for row in snow for s in row))


def storm_signal(cfg):
    rain = colormap("GPM_Precipitation_Rate")
    daily = [per_cell(cell_pixels(layer_png(IMERG, cfg["bbox"], d), rain), cell_mean) for d in cfg["precipDays"]]
    peak = [[max(day[r][c] for day in daily) for c in range(GRID)] for r in range(GRID)]
    total = [[sum(day[r][c] for day in daily) for c in range(GRID)] for r in range(GRID)]
    return peak, cumulative_event_days(daily, total), {}


def cumulative_event_days(daily, total):
    """Mission day on which a cell has received a quarter of its event total."""
    out = [[0] * GRID for _ in range(GRID)]
    for r in range(GRID):
        for c in range(GRID):
            running = 0.0
            for index, day in enumerate(daily):
                running += day[r][c]
                if total[r][c] > 0 and running >= 0.25 * total[r][c]:
                    out[r][c] = index
                    break
    return out


def drought_signal(cfg):
    """Dryness = 1 - root-zone soil moisture on the last mission day (lake / no-data cells score 0)."""
    sm = colormap("SMAP_Analyzed_Soil_Moisture")
    series = []
    for d in cfg["smapDays"]:
        cells = cell_pixels(layer_png(SMAP, cfg["bbox"], d), sm)
        series.append(per_cell(cells, lambda c: (
            sum(v for v in c if v is not None) / max(1, sum(v is not None for v in c))
            if sum(v is not None for v in c) >= 0.5 * len(c) else None)))
    last = series[-1]
    score = [[0.0 if last[r][c] is None else max(0.0, 0.4 - last[r][c]) for c in range(GRID)] for r in range(GRID)]
    return score, series, {}


def glacier_signal(cfg):
    """Late-summer snow/ice persistence: second-highest daily MODIS snow fraction (needs two clear sightings)."""
    ndsi = colormap("MODIS_NDSI_Snow_Cover")
    stack = [per_cell(cell_pixels(layer_png(NDSI, cfg["bbox"], d), ndsi), lambda c: cell_fraction(c, lambda v: v >= 40))
             for d in cfg["snowDays"]]
    score = [[sorted(day[r][c] for day in stack)[-2] for c in range(GRID)] for r in range(GRID)]
    return score, [[0] * GRID for _ in range(GRID)], {}


def volcano_signal(cfg):
    """Cells with VIIRS thermal anomalies during the eruption window, minus pre-eruption hot spots."""
    baseline = [[False] * GRID for _ in range(GRID)]
    for d in cfg["baselineDays"]:
        hits = per_cell(cell_pixels(layer_png(VIIRS_FIRE, cfg["bbox"], d)), lambda c: any(c))
        baseline = [[baseline[r][c] or hits[r][c] for c in range(GRID)] for r in range(GRID)]
    count = [[0] * GRID for _ in range(GRID)]
    first = [[0] * GRID for _ in range(GRID)]
    for index, d in enumerate(cfg["fireDays"]):
        hits = per_cell(cell_pixels(layer_png(VIIRS_FIRE, cfg["bbox"], d)), lambda c: sum(1 for v in c if v))
        for r in range(GRID):
            for c in range(GRID):
                if hits[r][c] and not baseline[r][c]:
                    if count[r][c] == 0:
                        # Lava that erupted before the mission window is already hot on day 0.
                        first[r][c] = max(0, index - cfg["fireOffset"])
                    count[r][c] += 1
    # Keep Kilauea's summit and rift zones only; brush fires further north are not lava.
    west, south, east, north = cfg["bbox"]
    for r in range(GRID):
        if south + (north - south) * (r + 0.5) / GRID > cfg["maxLat"]:
            count[r] = [0] * GRID
    # A cell seen hot on two or more days is active lava; a single sighting is a weaker signal.
    score = [[min(1.0, count[r][c] / 2) for c in range(GRID)] for r in range(GRID)]
    return score, first, dict(baselineCells=sum(b for row in baseline for b in row))


# ---------------------------------------------------------------- mission assembly

def pseudo_random(seed, index):
    """Same hash as scripts/data/generate-mvp-missions.mjs."""
    m = 0xFFFFFFFF
    value = (seed ^ ((index + 1) * 0x9E3779B1)) & m
    value = ((value ^ (value >> 16)) * 0x85EBCA6B) & m
    value = ((value ^ (value >> 13)) * 0xC2B2AE35) & m
    return ((value ^ (value >> 16)) & m) / 4_294_967_296


def to_truth(score, share):
    """Rescale so the top `share` of cells sit above 0.5 (hazard) and the rest below."""
    flat = sorted((v for row in score for v in row), reverse=True)
    top = flat[0] or 1.0
    if share is None:
        cut = 0.5 * top  # volcano: score is already 0 / 0.5 / 1
    else:
        cut = flat[max(0, round(share * len(flat)) - 1)]
        cut = max(cut, 1e-6)
    truth = []
    for row in score:
        out = []
        for v in row:
            if share is None:
                t = 0.0 if v <= 0 else (0.55 + 0.45 * (v - cut) / max(1e-6, top - cut) if v >= cut else 0.3)
            elif v >= cut:
                t = 0.55 + 0.45 * (v - cut) / max(1e-6, top - cut)
            else:
                t = 0.45 * v / cut
            out.append(round(min(1.0, max(0.0, t)), 3))
        truth.append(out)
    return truth


def drought_event_days(series, truth, score):
    """Day each hazard cell first reaches its final-day dryness band (within 0.01 m3/m3)."""
    out = [[0] * GRID for _ in range(GRID)]
    last = series[-1]
    for r in range(GRID):
        for c in range(GRID):
            if truth[r][c] > 0.5 and last[r][c] is not None:
                for index, day in enumerate(series):
                    if day[r][c] is not None and day[r][c] <= last[r][c] + 0.01:
                        out[r][c] = index
                        break
    return out


def build(slug):
    cfg = CONFIGS[slug]
    method = cfg["method"]
    signal = dict(snow=snow_signal, storm=storm_signal, drought=drought_signal,
                  glacier=glacier_signal, volcano=volcano_signal)[method]
    score, extra, info = signal(cfg)
    truth = to_truth(score, cfg["targetShare"])
    event_days = drought_event_days(extra, truth, score) if method == "drought" else extra

    west, south, east, north = cfg["bbox"]
    seed = cfg["seed"]
    grid = []
    for row in range(GRID):
        for column in range(GRID):
            index = row * GRID + column
            hazard = truth[row][column] > 0.5
            cloud = cfg["cloudBase"] + (pseudo_random(seed + 17, index) - 0.5) * 0.28
            grid.append(dict(
                id=f"r{row:02d}c{column:02d}", row=row, column=column,
                lat=round(south + (north - south) * (row + 0.5) / GRID, 5),
                lon=round(west + (east - west) * (column + 0.5) / GRID, 5),
                truth=truth[row][column],
                cloudProbability=round(min(0.95, max(0.02, cloud)), 3),
                # Hazard cells carry a strong signal (fresh snow, rain cores, hot lava, bare dry soil).
                detectability=round((0.82 if hazard else 0.68) + pseudo_random(seed + 31, index) * (0.16 if hazard else 0.3), 3),
                eventDay=min(cfg["durationDays"] - 1, event_days[row][column]) if hazard else 0,
            ))

    sources = [source_entry(slug, cfg), cloud_model_entry(cfg)]
    mission = dict(
        slug=slug, city=cfg["city"], category=cfg["category"], objective=dict(en=cfg["objective"]),
        bbox=cfg["bbox"], defaultConstraints=dict(budgetM=cfg["budgetM"], massKg=cfg["massKg"]),
        durationDays=cfg["durationDays"], seed=seed, targetResponseHours=cfg["targetResponseHours"],
        grid=grid, sources=sources,
    )
    (MISSIONS / f"{slug}.json").write_text(json.dumps(mission, indent=2) + "\n")
    hazards = sum(cell["truth"] > 0.5 for cell in grid)
    print(f"{slug}: {hazards} hazard cells, {info}")
    context_image(slug, cfg)


def source_entry(slug, cfg):
    method = cfg["method"]
    if method == "snow":
        dates = f"{cfg['precipDays'][0]}..{cfg['precipDays'][-1]} (IMERG), {cfg['snowDays'][0]}..{cfg['snowDays'][-1]} (MODIS)"
        usage = (f"Hazard cells = top {round(cfg['targetShare'] * 100)}% of storm-total GPM IMERG precipitation "
                 f"during {cfg['event']}, kept only where Terra MODIS NDSI shows snow on the ground afterwards "
                 f"({dates}). eventDay = day a cell received a quarter of its storm total. The hazard cut-off is a game choice.")
        names = [IMERG, NDSI]
    elif method == "storm":
        usage = (f"Hazard cells = top {round(cfg['targetShare'] * 100)}% of peak daily GPM IMERG precipitation rate "
                 f"during {cfg['event']} ({cfg['precipDays'][0]}..{cfg['precipDays'][-1]}). eventDay = day a cell "
                 "received a quarter of its event total. The hazard cut-off is a game choice.")
        names = [IMERG]
    elif method == "drought":
        usage = (f"Hazard cells = driest {round(cfg['targetShare'] * 100)}% of SMAP L4 root-zone soil moisture on "
                 f"{cfg['smapDays'][-1]} during {cfg['event']}; lake / no-data cells are not hazards. eventDay = first "
                 f"day (from {cfg['smapDays'][0]}) a cell reached that dryness. SMAP L4 is a model analysis that "
                 "assimilates SMAP satellite observations. The hazard cut-off is a game choice.")
        names = [SMAP]
    elif method == "glacier":
        usage = (f"Hazard cells = cells where Terra MODIS NDSI saw snow/ice (NDSI >= 40) on at least two clear days "
                 f"during {cfg['event']}, i.e. ice that survived the summer melt; top {round(cfg['targetShare'] * 100)}% "
                 "by persistence. Ice is present from day 0. The hazard cut-off is a game choice.")
        names = [NDSI]
    else:
        usage = (f"Hazard cells = cells with Suomi NPP VIIRS 375 m thermal anomalies during {cfg['event']}, restricted to "
                 f"Kilauea's summit and rift zones (south of {cfg['maxLat']} N) and excluding "
                 f"hot spots already present on {cfg['baselineDays'][0]}..{cfg['baselineDays'][-1]}; seen on two or more "
                 f"days = strongest. Detections from {cfg['fireDays'][0]} count; eventDay = first mission day "
                 f"(from {cfg['start']}) a cell was hot, 0 if it was already hot before the window.")
        names = [VIIRS_FIRE]
    entries = []
    for name in names:
        title, url = SOURCE_INFO[name]
        entries.append(title)
    title = " + ".join(entries)
    url = SOURCE_INFO[names[0]][1]
    return dict(name=title, url=url, accessedOn=ACCESSED_ON, usage=usage, provenance="nasa-observed")


def cloud_model_entry(cfg):
    return dict(
        name="Mission: Possible cloud and detectability model",
        url="https://gibs.earthdata.nasa.gov/",
        accessedOn=ACCESSED_ON,
        usage=(f"cloudProbability (baseline {cfg['cloudBase']} for this {cfg['category']} setting) and detectability "
               "are seeded educational estimates, not observations."),
        provenance="educational-model",
    )


def context_image(slug, cfg):
    bbox = cfg["bbox"]  # mission bbox, so the image matches the grid
    day = cfg["contextDate"]
    url = wms_url(TRUE_COLOR, bbox, day, 512, 512, "image/jpeg")
    data = get(url, JPEG, f"{slug}_true_color_{day}.jpg").read_bytes()
    source = "NASA GIBS / Terra MODIS corrected reflectance, true color"
    if cfg["method"] == "volcano":
        image = Image.open(io.BytesIO(data)).convert("RGBA")
        overlay_url = wms_url(VIIRS_FIRE, bbox, day, 512, 512)
        overlay = Image.open(get(overlay_url, PNG, f"{slug}_fire_overlay_{day}.png")).convert("RGBA")
        image.alpha_composite(overlay)
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, "JPEG", quality=90)
        data = buffer.getvalue()
        source += " with Suomi NPP VIIRS 375 m thermal anomalies"
    if not data.startswith(JPEG):
        raise SystemExit(f"{slug}: context image is not a JPEG")
    (PUBLIC / f"{slug}.jpg").write_bytes(data)
    meta = dict(source=source, observedOn=day, accessedOn=ACCESSED_ON, bbox=bbox, url=url,
                usage="Observed true-color imagery for geographical context. Not a hazard label or scoring ground truth.")
    (PUBLIC / f"{slug}.json").write_text(json.dumps(meta, indent=2) + "\n")


if __name__ == "__main__":
    for name in sys.argv[1:] or list(CONFIGS):
        build(name)
