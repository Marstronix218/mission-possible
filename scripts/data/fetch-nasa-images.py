"""Fetch NASA GIBS context imagery for public/nasa/<slug>.jpg|json.

    python3 scripts/data/fetch-nasa-images.py [slug ...]

Houston and Phoenix: Terra MODIS true color on 2024-07-01 (context only).
Los Angeles: Suomi NPP VIIRS true color on 2025-01-08 with that day's VIIRS
375 m fire detections composited on top (requires Pillow).
"""

import io
import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlencode

WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
OUT = Path(__file__).resolve().parents[2] / "public/nasa"
ACCESSED_ON = "2026-11-14"


def url_for(layer, bbox, time, fmt):
    params = dict(SERVICE="WMS", REQUEST="GetMap", VERSION="1.1.1", LAYERS=layer, STYLES="",
                  FORMAT=fmt, WIDTH=512, HEIGHT=512, SRS="EPSG:4326",
                  BBOX=",".join(str(v) for v in bbox), TIME=time)
    if fmt == "image/png":
        params["TRANSPARENT"] = "TRUE"
    return f"{WMS}?{urlencode(params)}"


def get(url, magic):
    data = subprocess.run(["curl", "-fLsS", "--max-time", "60", url], check=True, capture_output=True).stdout
    if not data.startswith(magic):
        raise SystemExit(f"Unexpected response from {url}: {data[:300]!r}")
    return data


def context_image(slug, lon, lat):
    bbox = [lon - .8, lat - .5, lon + .8, lat + .5]
    url = url_for("MODIS_Terra_CorrectedReflectance_TrueColor", bbox, "2024-07-01", "image/jpeg")
    (OUT / f"{slug}.jpg").write_bytes(get(url, b"\xff\xd8"))
    return {
        "source": "NASA GIBS / Terra MODIS corrected reflectance, true color",
        "observedOn": "2024-07-01", "accessedOn": ACCESSED_ON, "bbox": bbox, "url": url,
        "usage": "Observed true-color imagery for geographical context. Not a hazard label or scoring ground truth.",
    }


def los_angeles_fire_image():
    from PIL import Image

    bbox = [-118.95, 33.65, -117.55, 34.45]  # mission bbox, so the image matches the grid
    day = "2025-01-08"
    base_url = url_for("VIIRS_SNPP_CorrectedReflectance_TrueColor", bbox, day, "image/jpeg")
    fire_layers = ["VIIRS_SNPP_Thermal_Anomalies_375m_All", "VIIRS_NOAA20_Thermal_Anomalies_375m_All"]
    fire_urls = [url_for(layer, bbox, day, "image/png") for layer in fire_layers]
    image = Image.open(io.BytesIO(get(base_url, b"\xff\xd8"))).convert("RGBA")
    for fire_url in fire_urls:
        overlay = Image.open(io.BytesIO(get(fire_url, b"\x89PNG\r\n\x1a\n"))).convert("RGBA")
        image.alpha_composite(overlay)
    path = OUT / "los-angeles.jpg"
    image.convert("RGB").save(path, "JPEG", quality=88)
    assert path.read_bytes()[:2] == b"\xff\xd8"
    return {
        "source": "NASA GIBS / Suomi NPP VIIRS corrected reflectance, true color, with VIIRS 375 m active fire detections (Suomi NPP and NOAA-20)",
        "layers": ["VIIRS_SNPP_CorrectedReflectance_TrueColor", *fire_layers],
        "observedOn": day, "accessedOn": ACCESSED_ON, "bbox": bbox, "url": base_url, "overlayUrls": fire_urls,
        "usage": (
            "Observed true-color imagery of the Palisades and Eaton fires and their smoke on 8 Jan 2025 (UTC), "
            "with that day's VIIRS fire detections drawn in red. The mission's fire cells are derived from the "
            "same VIIRS detection layers for 7-13 Jan 2025 (scripts/data/fetch-nasa-hazards.py)."
        ),
    }


JOBS = {
    "los-angeles": los_angeles_fire_image,
    "houston": lambda: context_image("houston", -95.37, 29.76),
    "phoenix": lambda: context_image("phoenix", -112.07, 33.45),
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for slug in sys.argv[1:] or JOBS:
        meta = JOBS[slug]()
        (OUT / f"{slug}.json").write_text(json.dumps(meta, indent=2))
        print(slug, "verified JPEG")
