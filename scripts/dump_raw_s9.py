#!/usr/bin/env python3
"""Sprint 9 — RAW candidate dump (nodes + ways) for the four rebuilt cities.

Scans the real 2.55 GB nodes jsonl and the 644 MB ways jsonl once, and writes
EVERY named candidate inside the four Sprint 9 bounds with its full tag set.
The final whitelist / ordering is applied offline (scripts/build_seeds_s9.py)
so it can be tuned without rescanning 3.2 GB again.
"""
import json, os, sys

sys.stdout.reconfigure(encoding="utf-8")

NODES = r"D:\prototype-full\data\egypt_output\egypt_nodes_full.jsonl"
WAYS = r"D:\prototype-full\data\egypt_output\egypt_ways_full.jsonl"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw")

BOUNDS = {
    "saint_catherine": (28.30, 28.80, 33.70, 34.20),
    "taba": (29.20, 29.65, 34.60, 35.00),
    "luxor": (25.50, 25.90, 32.40, 32.80),
    "aswan": (23.80, 24.30, 32.70, 33.10),
}

# A tag key that makes a feature a travel candidate at all.
INTEREST_KEYS = ("tourism", "historic", "amenity", "natural", "leisure", "man_made",
                 "landuse", "place", "boundary", "aeroway", "railway", "building")

buckets = {slug: [] for slug in BOUNDS}


def keep(tags):
    if not tags:
        return False
    if not (tags.get("name") or tags.get("name:ar") or tags.get("name:en")):
        return False
    return any(tags.get(k) for k in INTEREST_KEYS)


def add(obj, src, slug):
    tags = obj.get("tags") or {}
    if not keep(tags):
        return
    if src == "node":
        lat, lng = obj.get("lat"), obj.get("lng")
    else:
        lat, lng = obj.get("center_lat"), obj.get("center_lng")
    if lat is None or lng is None:
        return
    name = tags.get("name") or tags.get("name:ar") or tags.get("name:en")
    buckets[slug].append({
        "id": obj.get("id"),
        "name": name,
        "nameAr": tags.get("name:ar") or tags.get("name:en") or name,
        "nameEn": tags.get("name:en") or tags.get("name") or name,
        "lat": lat, "lng": lng,
        "src": src,
        "tags": {k: v for k, v in tags.items() if v is not None and str(v) != ""},
    })


def scan(path, src):
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            tags = obj.get("tags") or {}
            if not (tags.get("name") or tags.get("name:ar") or tags.get("name:en")):
                continue
            if src == "node":
                lat, lng = obj.get("lat"), obj.get("lng")
            else:
                lat, lng = obj.get("center_lat"), obj.get("center_lng")
            if lat is None or lng is None:
                continue
            for slug, (latMin, latMax, lngMin, lngMax) in BOUNDS.items():
                if latMin <= lat <= latMax and lngMin <= lng <= lngMax:
                    add(obj, src, slug)


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    scan(NODES, "node")
    scan(WAYS, "way")
    for slug, feats in buckets.items():
        # dedupe on (name, rounded coords)
        seen = set()
        uniq = []
        for f in feats:
            k = (f["name"], round(f["lat"], 4), round(f["lng"], 4))
            if k in seen:
                continue
            seen.add(k)
            uniq.append(f)
        path = os.path.join(OUT_DIR, slug + ".json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"slug": slug, "candidates": uniq}, fh, ensure_ascii=False, separators=(",", ":"))
        print("%-16s candidates=%d  %d B" % (slug, len(uniq), os.path.getsize(path)), flush=True)
