#!/usr/bin/env python3
"""
Extract three expansion cities (Alexandria, Giza, Nuweiba) from the raw
Overpass dump at D:\\prototype-full\\data\\egypt_output\\egypt_nodes_full.jsonl
(2.55 GB, JSONL: one JSON object per line).

The dump holds every OSM node in Egypt. Only a tiny fraction is useful for a
travel catalogue: ~98.8% of Alexandria's rows are bare `addr:housenumber`
entries with no name and no amenity/tourism tag. Keeping those would blow the
seed up to hundreds of megabytes for zero catalogue value.

Filter (applied to every candidate):
  * inside the city bounds (lat/lng rectangle)
  * carries at least one of: tourism=*, historic=*, amenity in the
    POI whitelist (restaurant, cafe, bar, hotel, guest_house, attraction,
    museum, gallery, viewpoint, arts_centre, library, place_of_worship,
    market, nightlife, spa, aquarium, theme_park, camp_site, hostel,
    motel,chalet, beach_resort, food_court, ice_cream, fast_food,
    cafe, nightclub, theatre, cinema, park, garden, memorial)
  * has a `name` tag (a POI without a name cannot be shown to a traveller)
  * does NOT carry `addr:housenumber` (house numbers are the 98% noise)

Output: a compact GeoJSON FeatureCollection per city, in the same shape as
data/cities/<slug>.json (properties bag + Point geometry), so the existing
cityRoutes.ts reader needs no change.

Usage:
  python scripts/extract_expansion_cities.py [--out-dir data/cities]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time

SOURCE = r"D:\prototype-full\data\egypt_output\egypt_nodes_full.jsonl"

CITIES = {
    "alexandria": {
        "lat_min": 31.0,
        "lat_max": 31.35,
        "lng_min": 29.8,
        "lng_max": 30.1,
    },
    "giza": {
        "lat_min": 29.8,
        "lat_max": 30.2,
        "lng_min": 31.0,
        "lng_max": 31.3,
    },
    "nuweiba": {
        "lat_min": 28.9,
        "lat_max": 29.1,
        "lng_min": 34.6,
        "lng_max": 34.7,
    },
}

# Amenities worth showing a traveller. Everything else in the amenity=* family
# (parking, bench, waste_basket, bicycle_parking, ...) is street furniture.
POI_AMENITIES = {
    "restaurant",
    "cafe",
    "bar",
    "fast_food",
    "food_court",
    "ice_cream",
    "hotel",
    "guest_house",
    "hostel",
    "motel",
    "chalet",
    "beach_resort",
    "motel",
    "museum",
    "gallery",
    "attraction",
    "viewpoint",
    "arts_centre",
    "theatre",
    "cinema",
    "library",
    "place_of_worship",
    "marketplace",
    "market",
    "nightlife",
    "spa",
    "aquarium",
    "theme_park",
    "camp_site",
    "park",
    "garden",
    "memorial",
    "monument",
    "casino",
    "social_facility",
}

# Tags that carry a usable human label even without amenity=/tourism=.
LABEL_TAGS = ("name", "name:en", "name:ar", "official_name")


def in_bounds(lat: float, lng: float, box: dict) -> bool:
    return (
        box["lat_min"] <= lat <= box["lat_max"]
        and box["lng_min"] <= lng <= box["lng_max"]
    )


def is_interesting(tags: dict) -> bool:
    """tourism=* or historic=* or a whitelisted amenity=*."""
    if tags.get("tourism"):
        return True
    if tags.get("historic"):
        return True
    if tags.get("amenity") in POI_AMENITIES:
        return True
    if tags.get("leisure") in {"park", "garden", "nature_reserve"}:
        return True
    return False


def has_name(tags: dict) -> bool:
    return any(tags.get(t) for t in LABEL_TAGS)


def has_housenumber(tags: dict) -> bool:
    return "addr:housenumber" in tags


def compact_properties(tags: dict) -> dict:
    """Keep only catalogue-relevant tags; drop the address noise."""
    keep = (
        "name",
        "name:en",
        "name:ar",
        "name:alt",
        "official_name",
        "alt_name",
        "short_name",
        "tourism",
        "historic",
        "amenity",
        "leisure",
        "shop",
        "office",
        "building",
        "building:levels",
        "addr:street",
        "addr:city",
        "addr:place",
        "addr:suburb",
        "addr:country",
        "addr:postcode",
        "cuisine",
        "internet_access",
        "wheelchair",
        "opening_hours",
        "phone",
        "website",
        "wikidata",
        "wikimedia_commons",
        "description",
        "is_in",
        "brand",
        "stars",
        "rooms",
        "beds",
    )
    out = {}
    for k in keep:
        v = tags.get(k)
        if v is not None and v != "":
            out[k] = v
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data/cities")
    ap.add_argument("--source", default=SOURCE)
    args = ap.parse_args()

    if not os.path.isfile(args.source):
        print(f"SOURCE NOT FOUND: {args.source}", file=sys.stderr)
        return 2

    os.makedirs(args.out_dir, exist_ok=True)

    # slug -> list of features
    hits = {slug: [] for slug in CITIES}
    stats = {
        slug: {"scanned": 0, "in_bounds": 0, "interesting": 0, "named": 0, "kept": 0}
        for slug in CITIES
    }

    started = time.time()
    total_lines = 0
    # Fast pre-filter: pull lat/lng out of the raw text before paying for a
    # full json.loads on all 21.4M lines. Only lines whose coordinates land
    # inside one of the three boxes get parsed.
    lat_re = re.compile(r'"lat":\s*(-?\d+\.?\d*)')
    lng_re = re.compile(r'"lng":\s*(-?\d+\.?\d*)')
    with open(args.source, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            total_lines += 1
            if '"lat"' not in line:
                continue
            m_lat = lat_re.search(line)
            m_lng = lng_re.search(line)
            if not m_lat or not m_lng:
                continue
            lat = float(m_lat.group(1))
            lng = float(m_lng.group(1))
            # Which city (if any) does this coordinate belong to?
            slug = None
            for s, b in CITIES.items():
                if in_bounds(lat, lng, b):
                    slug = s
                    break
            if slug is None:
                continue

            line = line.strip()
            if not line or line[0] != "{":
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            # The raw OSM nodes dump has no "type" field (it's implied by the
            # file name); treating missing/"node" as node prevents dropping
            # 100% of the data (e.g. Lighthouse of Alexandria line 0).
            obj_type = obj.get("type")
            if obj_type is not None and obj_type != "node":
                continue
            lat = obj.get("lat")
            lng = obj.get("lng")
            if lat is None or lng is None:
                continue
            tags = obj.get("tags")
            if not tags:
                continue

            s = stats[slug]
            s["in_bounds"] += 1
            if not is_interesting(tags):
                continue
            s["interesting"] += 1
            if has_housenumber(tags):
                # Explicitly excluded: address-only rows are the 98% noise.
                continue
            if not has_name(tags):
                continue
            s["named"] += 1
            props = compact_properties(tags)
            if not props:
                continue
            props["id"] = obj.get("id")
            props["type"] = "node"
            hits[slug].append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "properties": props,
                }
            )
            s["kept"] += 1

            if total_lines % 2_000_000 == 0:
                elapsed = time.time() - started
                print(
                    f"  ...{total_lines:,} lines / {elapsed:,.0f}s  "
                    + "  ".join(
                        f"{slug}:{stats[slug]['kept']}" for slug in CITIES
                    ),
                    flush=True,
                )

    print(f"\nScanned {total_lines:,} lines in {time.time() - started:,.0f}s\n")

    summary = {}
    for slug in CITIES:
        feats = hits[slug]
        feats.sort(key=lambda f: (f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0]))
        fc = {
            "type": "FeatureCollection",
            "name": slug,
            "features": feats,
        }
        out_path = os.path.join(args.out_dir, f"{slug}.json")
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(fc, fh, ensure_ascii=False, separators=(",", ":"))
        size = os.path.getsize(out_path)
        s = stats[slug]
        summary[slug] = {
            "features": len(feats),
            "bytes": size,
            "in_bounds": s["in_bounds"],
            "interesting": s["interesting"],
            "named": s["named"],
        }
        print(
            f"{slug:<12} features={len(feats):<6} bytes={size:<10,} "
            f"in_bounds={s['in_bounds']:<8,} interesting={s['interesting']:<8,} "
            f"named={s['named']:<8,} -> {out_path}"
        )

    total_bytes = sum(v["bytes"] for v in summary.values())
    total_feats = sum(v["features"] for v in summary.values())
    print(f"\nTOTAL 3 new cities: {total_feats} features, {total_bytes:,} B")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
