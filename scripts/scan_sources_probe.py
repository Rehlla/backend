#!/usr/bin/env python3
"""Probe: how many tourism.geojson / nodes features fall in the Sprint 8 bounds."""
import json, os, sys

sys.stdout.reconfigure(encoding="utf-8")

TOUR_GEOJSON = r"D:\prototype-full\data\egypt_tourism.geojson"
BOUNDS = {
    "luxor": (25.50, 25.90, 32.40, 32.80),
    "aswan": (23.80, 24.30, 32.70, 33.10),
    "saint_catherine": (28.30, 28.80, 33.70, 34.20),
    "taba": (29.20, 29.65, 34.60, 35.00),
}


def in_bounds(lat, lng, b):
    return b[0] <= lat <= b[1] and b[2] <= lng <= b[3]


geo = json.load(open(TOUR_GEOJSON, "r", encoding="utf-8"))
feats = geo.get("features", [])
print("tourism.geojson total:", len(feats))

for slug, b in BOUNDS.items():
    hits = []
    for f in feats:
        geom = f.get("geometry") or {}
        props = f.get("properties") or {}
        coords = geom.get("coordinates") or []
        if geom.get("type") == "Point" and len(coords) >= 2:
            lng, lat = coords[0], coords[1]
        else:
            continue
        if lat is None or lng is None:
            continue
        if in_bounds(lat, lng, b):
            hits.append((props, lat, lng))
    print("%-16s geojson hits: %d" % (slug, len(hits)))
    for props, lat, lng in hits[:3]:
        print("    name=%r lat=%.4f lng=%.4f keys=%s" % (
            props.get("name"), lat, lng, sorted(props.keys())[:8]))
