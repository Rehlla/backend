#!/usr/bin/env python3
"""Probe the ways file: structure of a tagged way (does it carry lat/lng?)."""
import json, sys

sys.stdout.reconfigure(encoding="utf-8")

W = r"D:\prototype-full\data\egypt_output\egypt_ways_full.jsonl"
shown = 0
with open(W, "r", encoding="utf-8", errors="replace") as fh:
    for i, line in enumerate(fh):
        if i % 200000 == 0 and i:
            print("...scanned", i, "lines")
        try:
            o = json.loads(line)
        except Exception:
            continue
        tags = o.get("tags") or {}
        if not tags:
            continue
        if "name" not in tags and "name:en" not in tags and "name:ar" not in tags:
            continue
        if shown < 6:
            print("keys:", sorted(o.keys()))
            print("sample:", {k: o.get(k) for k in o.keys() if k != "tags"},
                  "| tags:", {k: tags.get(k) for k in
                             ["name", "name:en", "name:ar", "historic", "tourism", "amenity", "building"]
                             if tags.get(k)})
            print("---")
            shown += 1
        if shown >= 6:
            break
print("done, sample lines shown:", shown)
