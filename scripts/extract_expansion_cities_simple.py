#!/usr/bin/env python3
"""
Simple robust extraction: stream the nodes file line-by-line,
parse each line with json.loads(), filter by real criteria,
write GeoJSON FeatureCollection per expansion city.
"""
import json, argparse, os, time, sys

SOURCE = r"D:\prototype-full\data\egypt_output\egypt_nodes_full.jsonl"
CITIES = {
    "alexandria": {"lat_min":31.0,"lat_max":31.35,"lng_min":29.8,"lng_max":30.1},
    "giza":       {"lat_min":29.8,"lat_max":30.2,"lng_min":31.0,"lng_max":31.3},
    "nuweiba":    {"lat_min":28.9,"lat_max":29.1,"lng_min":34.6,"lng_max":34.7},
}
POI_AMENITIES = {
    "restaurant","cafe","bar","fast_food","food_court","ice_cream",
    "hotel","guest_house","hostel","motel","chalet","beach_resort",
    "museum","gallery","attraction","viewpoint","arts_centre",
    "theatre","cinema","library","place_of_worship","marketplace","market",
    "nightlife","spa","aquarium","theme_park","camp_site","park",
    "garden","memorial","monument","casino","social_facility",
}


def in_bounds(lat, lng, box):
    return box["lat_min"] <= lat <= box["lat_max"] and box["lng_min"] <= lng <= box["lng_max"]


def interesting(tags):
    if tags.get("tourism") or tags.get("historic"):
        return True
    if tags.get("amenity") in POI_AMENITIES:
        return True
    if tags.get("leisure") in {"park","garden","nature_reserve"}:
        return True
    return False


def has_name(tags):
    return any(tags.get(k) for k in ("name","name:en","name:ar","official_name"))


def no_housenumber(tags):
    return "addr:housenumber" not in tags


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data/cities")
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    hits = {s: [] for s in CITIES}
    stats = {s: {"scanned":0,"in_bounds":0,"interesting":0,"named":0,"kept":0} for s in CITIES}
    started = time.time()
    total_lines = 0
    # Stream through file line by line, parse only lines with lat/lng
    # (all lines in nodes dump are nodes).
    with open(SOURCE, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            total_lines += 1
            line = line.strip()
            if not line or line[0] != "{":
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            # Nodes file implies node; don't filter by "type" (some lines
            # may not have it, like the Lighthouse of Alexandria line 0).
            lat = obj.get("lat")
            lng = obj.get("lng")
            if lat is None or lng is None:
                continue
            tags = obj.get("tags")
            if not tags:
                continue
            # Check which city box (if any) this node belongs to.
            slug = None
            for s, b in CITIES.items():
                if in_bounds(lat, lng, b):
                    slug = s
                    break
            if slug is None:
                continue
            s = stats[slug]
            s["in_bounds"] += 1
            if not interesting(tags):
                continue
            s["interesting"] += 1
            if not no_housenumber(tags):
                continue
            if not has_name(tags):
                continue
            s["named"] += 1
            props = {}
            for k in ("name","name:en","name:ar","official_name","alt_name",
                      "short_name","tourism","historic","amenity","leisure",
                      "shop","office","building","building:levels",
                      "addr:street","addr:city","addr:place","addr:suburb",
                      "addr:country","addr:postcode","cuisine","internet_access",
                      "wheelchair","opening_hours","phone","website","wikidata",
                      "wikimedia_commons","description","is_in","brand","stars",
                      "rooms","beds"):
                v = tags.get(k)
                if v is not None and v != "":
                    props[k] = v
            props["id"] = obj.get("id")
            props["type"] = "node"
            hits[slug].append({
                "type": "Feature",
                "geometry": {"type":"Point","coordinates":[lng, lat]},
                "properties": props,
            })
            s["kept"] += 1
            # Progress every 500k lines
            if total_lines % 500_000 == 0:
                print(f"  ...{total_lines:,} lines  " + "  ".join(f"{s}:{stats[s]['kept']}" for s in CITIES), flush=True)
    print(f"\nScanned {total_lines:,} lines in {time.time()-started:,.0f}s")
    for slug in CITIES:
        feats = hits[slug]
        feats.sort(key=lambda f: (f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0]))
        fc = {"type":"FeatureCollection","name":slug,"features":feats}
        out_path = os.path.join(args.out_dir, f"{slug}.json")
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(fc, fh, ensure_ascii=False, separators=(",",":"))
        sz = os.path.getsize(out_path)
        s = stats[slug]
        print(f"{slug:<12} features={len(feats):<6} bytes={sz:<10,} in_bounds={s['in_bounds']:<8,} interesting={s['interesting']:<5,} named={s['named']:<8,} kept={s['kept']}")
    total_bytes = sum(os.path.getsize(os.path.join(args.out_dir, f"{s}.json")) for s in CITIES)
    total_feats = sum(len(hits[s]) for s in CITIES)
    print(f"\nTOTAL 3 new cities: {total_feats} features, {total_bytes:,} B")