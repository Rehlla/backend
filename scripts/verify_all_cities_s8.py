#!/usr/bin/env python3
"""Sprint 8 — comprehensive live API verification for every city + sub-destination.

Runs against the freshly built server (dist/server.cjs on :3111) and stores the
REAL responses (places / hotels / food / meta) in logs/final_fixed_counts_api.json.
"""
import json, os, sys, urllib.request, urllib.error

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3111"
OUT = "logs/final_fixed_counts_api.json"

MAIN = ["dahab", "sharm", "hurghada", "marsa_alam", "siwa", "nuweiba",
        "alexandria", "giza", "luxor", "aswan", "saint_catherine", "taba"]
SUBS = [("sharm", "ras_mohamed"), ("nuweiba", "colored_canyon"), ("aswan", "abu_simbel")]


def get(path):
    """GET a JSON endpoint; returns (status, parsed_body_or_text)."""
    req = urllib.request.Request(BASE + path, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode("utf-8", "replace")
            try:
                return r.status, json.loads(body)
            except Exception:
                return r.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body
    except Exception as e:
        return 0, str(e)


def slim(feature):
    if not isinstance(feature, dict):
        return None
    return {
        "id": feature.get("id"),
        "name": feature.get("name"),
        "nameAr": feature.get("nameAr"),
        "lat": feature.get("lat"),
        "lng": feature.get("lng"),
        "tags": feature.get("tags"),
    }


report = {"base": BASE, "main": {}, "sub": {}, "extras": {}}
lines = []

for slug in MAIN:
    entry = {}
    for kind, path in (
        ("places", "/api/cities/%s/places" % slug),
        ("hotels", "/api/cities/%s/hotels" % slug),
        ("food", "/api/cities/%s/food" % slug),
        ("meta", "/api/cities/%s/meta" % slug),
    ):
        status, body = get(path)
        rec = {"status": status}
        if isinstance(body, dict):
            rec["count"] = body.get("count")
            rec["featureCount"] = body.get("featureCount")
            rec["tourismCount"] = body.get("tourismCount")
            first = body.get("first")
            if first:
                rec["first"] = {"name": first.get("name"), "nameAr": first.get("nameAr"),
                                "lat": first.get("lat"), "lng": first.get("lng")}
            places = body.get("places")
            if isinstance(places, list):
                rec["count"] = body.get("count", len(places))
                rec["first3"] = [slim(p) for p in places[:3]]
            if kind == "meta":
                rec["population"] = body.get("population")
                rec["wikidata"] = body.get("wikidata")
                rec["bounds"] = body.get("bounds")
                rec["nameEn"] = body.get("nameEn")
                rec["nameAr"] = body.get("nameAr")
        else:
            rec["body"] = str(body)[:200]
        entry[kind] = rec
    report["main"][slug] = entry
    p, h, f, m = entry["places"], entry["hotels"], entry["food"], entry["meta"]
    lines.append("%-15s places=%s/%s tour=%s hot=%s food=%s meta=%s | first=%s" % (
        slug, p.get("status"), p.get("count"), p.get("tourismCount"),
        h.get("count"), f.get("count"), m.get("status"),
        (p.get("first3") or [{}])[0].get("name")))

for parent, sub in SUBS:
    entry = {}
    for kind, path in (
        ("places", "/api/cities/%s/sub/%s/places" % (parent, sub)),
        ("hotels", "/api/cities/%s/sub/%s/hotels" % (parent, sub)),
        ("food", "/api/cities/%s/sub/%s/food" % (parent, sub)),
    ):
        status, body = get(path)
        rec = {"status": status}
        if isinstance(body, dict):
            rec["count"] = body.get("count")
            rec["featureCount"] = body.get("featureCount")
            rec["tourismCount"] = body.get("tourismCount")
            places = body.get("places")
            if isinstance(places, list):
                rec["count"] = body.get("count", len(places))
                rec["first3"] = [slim(p) for p in places[:3]]
            first = body.get("first")
            if isinstance(first, dict):
                rec["first"] = {"name": first.get("name"), "nameAr": first.get("nameAr"),
                                "lat": first.get("lat"), "lng": first.get("lng")}
        else:
            rec["body"] = str(body)[:200]
        entry[kind] = rec
    report["sub"]["%s/%s" % (parent, sub)] = entry
    p = entry["places"]
    lines.append("%-15s places=%s/%s hot=%s food=%s | first=%s" % (
        "%s/%s" % (parent, sub), p.get("status"), p.get("count"),
        entry["hotels"].get("count"), entry["food"].get("count"),
        (p.get("first3") or [{}])[0].get("name")))

# extras
extras = {
    "backcompat_dahab_places": "/api/dahab/places",
    "admin_dahab_stats": "/api/cities/dahab/admin/stats",
    "admin_luxor_stats": "/api/cities/luxor/admin/stats",
    "nile_cruise_routes": "/api/nile-cruise/routes",
    "sub_list_sharm": "/api/cities/sharm/sub",
    "sub_list_aswan": "/api/cities/aswan/sub",
    "sub_list_nuweiba": "/api/cities/nuweiba/sub",
}
for key, path in extras.items():
    status, body = get(path)
    rec = {"status": status, "path": path}
    if isinstance(body, dict):
        if key == "nile_cruise_routes":
            stops = body.get("stops") or body.get("routes") or []
            rec["stopCount"] = len(stops) if isinstance(stops, list) else None
            rec["stops"] = stops
        elif key.startswith("sub_list"):
            rec["subDestinations"] = [
                {k: s.get(k) for k in ("slug", "name", "nameAr", "parent", "featureCount", "tourismCount")}
                for s in (body.get("subDestinations") or [])
            ]
        else:
            rec["count"] = body.get("count")
            places = body.get("places")
            if isinstance(places, list):
                rec["count"] = body.get("count", len(places))
                rec["first3"] = [slim(p) for p in places[:3]]
    else:
        rec["body"] = str(body)[:300]
    report["extras"][key] = rec
    lines.append("%-15s status=%s %s" % (key, status, rec.get("count", rec.get("stopCount", ""))))

os.makedirs("logs", exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(report, fh, ensure_ascii=False, indent=2)

with open("logs/final_fixed_counts_api_summary.txt", "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))

print("\n".join(lines))
print("\nSaved:", OUT, os.path.getsize(OUT), "B")
