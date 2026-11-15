"""Fetch a real Landsat Collection 2 Level-2 scene for the San Francisco heat mission.

    python3 -I scripts/data/fetch-sf-landsat-lst.py [scratch_dir]

Source: USGS/NASA Landsat 8 OLI/TIRS Collection 2 Level-2 (Surface Temperature
ST_B10 = asset "lwir11", Surface Reflectance SR_B4/B3/B2), read through the
Microsoft Planetary Computer data API (no account needed), cropped and
resampled to the mission bbox in EPSG:4326 (plate carree, so each mission grid
cell is a uniform block of pixels).

Writes to public/nasa/:
  san-francisco-lst.png         colour-mapped land surface temperature (deg C);
                                cloud / cloud shadow / water / fill transparent
  san-francisco-landsat.jpg     true colour from the same scene (SR B4/B3/B2)
  san-francisco-lst.json        provenance, value range, colour scale and
                                per-grid-cell mean LST (deg C, land pixels only)

Conversion (USGS Landsat C2 L2 Science Product Guide):
  ST [K] = DN * 0.00341802 + 149.0 ; deg C = K - 273.15
  SR     = DN * 0.0000275 - 0.2
Numbers are measured land SURFACE temperature, not air temperature.
"""

import io
import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlencode

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/nasa"
MISSION = json.loads((ROOT / "data/missions/san-francisco.json").read_text())
BBOX = MISSION["bbox"]  # [west, south, east, north]
ITEM = "LC08_L2SP_044034_20220831_02_T1"
COLLECTION = "landsat-c2-l2"
STAC = f"https://planetarycomputer.microsoft.com/api/stac/v1/collections/{COLLECTION}/items/{ITEM}"
DATA = "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox"
WIDTH, HEIGHT = 800, 492  # 1.3 deg x 0.8 deg, same aspect as the bbox in degrees
ACCESSED_ON = "2026-11-15"
# Fixed colour scale so the legend is stable and honest.
SCALE_MIN_C, SCALE_MAX_C = 20.0, 55.0
STOPS = [  # (deg C, RGB) perceptual-ish dark-blue -> yellow -> red ramp
    (20.0, (49, 54, 149)),
    (27.0, (69, 117, 180)),
    (34.0, (171, 217, 233)),
    (40.0, (254, 224, 144)),
    (46.0, (253, 174, 97)),
    (50.0, (244, 109, 67)),
    (55.0, (165, 0, 38)),
]


def curl(url, out=None):
    data = subprocess.run(["curl", "-fLsS", "--max-time", "180", url], check=True, capture_output=True).stdout
    if out:
        out.write_bytes(data)
    return data


def crop_url(asset, resampling):
    west, south, east, north = BBOX
    query = urlencode(
        dict(collection=COLLECTION, item=ITEM, assets=asset, dst_crs="epsg:4326", return_mask="false",
             reproject=resampling, resampling=resampling)
    )
    return f"{DATA}/{west},{south},{east},{north}/{WIDTH}x{HEIGHT}.npy?{query}"


def fetch_band(scratch, asset, resampling):
    url = crop_url(asset, resampling)
    raw = curl(url, scratch / f"{asset}.npy")
    arr = np.load(io.BytesIO(raw), allow_pickle=False)
    if arr.shape != (1, HEIGHT, WIDTH):
        raise SystemExit(f"Unexpected shape for {asset}: {arr.shape}")
    return arr[0].astype(np.float64), url


def colormap(celsius):
    xs = np.array([s[0] for s in STOPS])
    rgb = np.zeros(celsius.shape + (3,), dtype=np.float64)
    clipped = np.clip(celsius, SCALE_MIN_C, SCALE_MAX_C)
    for channel in range(3):
        rgb[..., channel] = np.interp(clipped, xs, [s[1][channel] for s in STOPS])
    return rgb.astype(np.uint8)


def main():
    scratch = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    scratch.mkdir(parents=True, exist_ok=True)
    item = json.loads(curl(STAC, scratch / "item.json"))
    props = item["properties"]

    qa, qa_url = fetch_band(scratch, "qa_pixel", "nearest")
    st, st_url = fetch_band(scratch, "lwir11", "nearest")
    q = qa.astype(np.uint16)
    fill = (q & 1) > 0
    cloudy = (((q >> 1) & 1) | ((q >> 2) & 1) | ((q >> 3) & 1) | ((q >> 4) & 1)) > 0  # dilated, cirrus, cloud, shadow
    water = ((q >> 7) & 1) > 0
    invalid = fill | cloudy | (st == 0)
    kelvin = st * 0.00341802 + 149.0
    celsius = kelvin - 273.15
    land = ~invalid & ~water

    rgba = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    rgba[..., :3] = np.where(land[..., None], colormap(celsius), 0)
    rgba[..., 3] = np.where(land, 255, 0)
    # Palette PNG (<=256 colours) keeps the file small; the ramp has far fewer distinct steps anyway.
    Image.fromarray(rgba, "RGBA").quantize(colors=128, method=Image.Quantize.FASTOCTREE).save(
        OUT / "san-francisco-lst.png", optimize=True
    )

    bands = []
    sr_urls = []
    for asset in ("red", "green", "blue"):
        band, url = fetch_band(scratch, asset, "nearest")
        sr_urls.append(url)
        bands.append(np.clip(band * 0.0000275 - 0.2, 0, 1))
    rgb = np.stack(bands, axis=-1)
    # Simple linear stretch + gamma for display only.
    rgb = np.clip(rgb / 0.3, 0, 1) ** (1 / 1.6)
    Image.fromarray((rgb * 255).astype(np.uint8), "RGB").save(OUT / "san-francisco-landsat.jpg", quality=84, optimize=True)

    # Per mission grid cell: mean LST over valid land pixels.
    west, south, east, north = BBOX
    rows = max(c["row"] for c in MISSION["grid"]) + 1
    cols = max(c["column"] for c in MISSION["grid"]) + 1
    cells = {}
    for c in MISSION["grid"]:
        y1 = HEIGHT - int(round(c["row"] * HEIGHT / rows))
        y0 = HEIGHT - int(round((c["row"] + 1) * HEIGHT / rows))
        x0 = int(round(c["column"] * WIDTH / cols))
        x1 = int(round((c["column"] + 1) * WIDTH / cols))
        block = celsius[y0:y1, x0:x1][land[y0:y1, x0:x1]]
        total = (y1 - y0) * (x1 - x0)
        cells[c["id"]] = {
            "meanC": round(float(block.mean()), 1) if block.size else None,
            "landShare": round(block.size / total, 3),
            "cloudShare": round(float(cloudy[y0:y1, x0:x1].mean()), 3),
        }

    valid = celsius[land]
    provenance = {
        "kind": "land-surface-temperature",
        "source": "USGS/NASA Landsat 8 OLI/TIRS Collection 2 Level-2 Surface Temperature (ST_B10)",
        "sceneId": props.get("landsat:scene_id"),
        "productId": ITEM,
        "platform": props.get("platform"),
        "sensor": "TIRS band 10 (surface temperature), OLI bands 4/3/2 (true colour)",
        "wrsPathRow": f"{props.get('landsat:wrs_path')}/{props.get('landsat:wrs_row')}",
        "acquired": props.get("datetime"),
        "observedOn": props.get("datetime", "")[:10],
        "sceneCloudCover": props.get("eo:cloud_cover"),
        "bboxCloudShare": round(float(cloudy.mean()), 3),
        "accessedOn": ACCESSED_ON,
        "bbox": BBOX,
        "width": WIDTH,
        "height": HEIGHT,
        "processing": (
            "Planetary Computer data API crop of the COGs to the mission bbox in EPSG:4326, nearest-neighbour "
            f"resampling to {WIDTH}x{HEIGHT}. ST [K] = DN x 0.00341802 + 149.0, minus 273.15 for deg C. "
            "QA_PIXEL fill, dilated cloud, cirrus, cloud and cloud-shadow bits masked (transparent); water masked. "
            "True colour: SR = DN x 0.0000275 - 0.2, linear stretch to 0.3 reflectance, gamma 1.6 (display only)."
        ),
        "url": STAC,
        "dataUrls": {"lst": st_url, "qa": qa_url, "trueColour": sr_urls},
        "landingPage": "https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature",
        "files": {"lst": "/nasa/san-francisco-lst.png", "trueColour": "/nasa/san-francisco-landsat.jpg"},
        "valueRangeC": {
            "min": round(float(valid.min()), 1),
            "p05": round(float(np.percentile(valid, 5)), 1),
            "median": round(float(np.median(valid)), 1),
            "p95": round(float(np.percentile(valid, 95)), 1),
            "max": round(float(valid.max()), 1),
        },
        "colourScale": {"minC": SCALE_MIN_C, "maxC": SCALE_MAX_C, "stops": [[c, "#%02x%02x%02x" % rgb] for c, rgb in STOPS]},
        "usage": (
            "Real Landsat land surface temperature on the first day of the Aug 31 - Sep 9 2022 Bay Area heat wave, "
            "used as a reference picture. Land surface temperature is the skin temperature of the ground and roofs, "
            "not air temperature. Not used for scoring; mission hazard cells come from MODIS (see mission sources)."
        ),
        "grid": {"rows": rows, "columns": cols, "cells": cells},
    }
    (OUT / "san-francisco-lst.json").write_text(json.dumps(provenance, indent=1) + "\n")
    print(json.dumps({k: provenance[k] for k in ("sceneId", "acquired", "bboxCloudShare", "valueRangeC")}, indent=1))


if __name__ == "__main__":
    main()
