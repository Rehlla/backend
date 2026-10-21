#!/usr/bin/env python3
"""Sprint 8 combined: nodes + ways, wider bounds & whitelist, ensure_ascii=False."""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")

SOURCE_NODE = r"D:\prototype-full\data\egypt_output\egypt_nodes_full.jsonl"
SOURCE_WAY  = r"D:\prototype-full\data\egypt_output\egypt_ways_full.jsonl"
BASE = r"D:\dahab-—-travel-platform\Travel.eg"

BOUNDS = {
    "saint_catherine": (28.30, 28.80, 33.70, 34.20, "data/cities/saint_catherine.json"),
    "taba":            (29.20, 29.65, 34.60, 35.00, "data/cities/taba.json"),
    "luxor":           (25.50, 25.90, 32.40, 32.80, "data/cities/luxor.json"),
    "aswan":           (23.80, 24.30, 32.70, 33.10, "data/cities/aswan.json"),
}

OK = {
    "tourism": {"attraction","museum","temple","tomb","hotel","restaurant","viewpoint",
                "gallery","artwork","picnic_site","monument","memorial","hostel","guest_house",
                "guesthouse","castle","palace","ruins","theme_park","zoo","aquarium",
                "cultural_centre","arts_centre","beach_resort","camp_site","wilderness_camp",
                "wilderness_hut","chalet","alpine_hut","motel","diving","snorkeling",
                "scuba_diving","resort","fort","fortress","shrine","spring","sauna",
                "garden","park","nature_reserve","sculpture","city_gate","caravan_site",
                "dive_centre","boatyard","marina","harbour","fishing_village","dive_centre"},
    "historic": {"temple","tomb","ruins","archaeological_site","monastery","church","memorial",
                 "mosque","castle","palace","fort","fortress","cemetery","shrine",
                 "wayside_cross","mausoleum","necropolis","colonnade","city_gate","gatehouse",
                 "kirk","cathedral","city_wall","wall","tower","beacon","military","mine","settlement"},
    "amenity": {"place_of_worship","shrine","monastery","religious_christian","religious_muslim",
                "restaurant","cafe","fast_food","hotel","hostel","guest_house","bar","pub",
                "nightclub","marketplace","library","museum","community_centre","grave_yard",
                "shelter","campsite","drinking_water","fountain","theatre","arts_centre",
                "ice_cream","food_court","bus_station","ferry_terminal","harbour","marina",
                "fuel","pharmacy","bank","atm","university","school","polling_station"},
    "natural": {"peak","cave","rock","gorge","valley","bay","beach","reef","island","spring",
                "waterfall","crater","sand","cliff","canyon","volcano","hill","saddle",
                "wetland","wood","scrub","bare_rock","hot_spring","geyser","sinkhole","desert"},
    "leisure": {"park","garden","nature_reserve","picnic_table","playground","pitch","stadium",
                "fitness_station","marina","slipway","swimming_area","fitness_centre","sports_centre"},
}

POLLUTION = {"addr:housenumber","shop","office","craft","casino","vending_machine",
             "payment","atm","fuel","parking","bicycle_rental","car_rental"}

def allowed(tags):
    for k, s in OK.items():
        v = tags.get(k)
        if isinstance(v, str) and v in s:
            return True
    # also allow basic tourism/historic present as tag keys with any value
    for k in ("tourism","historic","amenity","natural","leisure"):
        if k in tags:
            v = tags[k]
            if isinstance(v, str) and v and v not in ("no","disused","closed","demolished"):
                return True
    return False

def build_feature(obj, src):
    tags = obj.get("tags") or {}
    # pollution skip
    for bad in POLLUTION:
        if bad in tags:
            return None
    if not allowed(tags):
        return None
    name = tags.get("name") or tags.get("name:ar") or tags.get("name:en")
    if not name or not str(name).strip():
        return None
    if src == "node":
        lat = obj.get("lat")
        lng = obj.get("lng")
        f = {"id": obj.get("id"), "name": name,
             "nameAr": tags.get("name:ar") or tags.get("name:en") or name,
             "nameEn": tags.get("name:en") or tags.get("name") or name,
             "lat": lat, "lng": lng,
             "tags": {k: v for k, v in tags.items() if v is not None and str(v) != ""}}
    elif src == "way":
        lat = obj.get("center_lat")
        lng = obj.get("center_lng")
        f = {"id": obj.get("id"), "name": name,
             "nameAr": tags.get("name:ar") or tags.get("name:en") or name,
             "nameEn": tags.get("name:en") or tags.get("name") or name,
             "lat": lat, "lng": lng,
             "tags": {k: v for k, v in tags.items() if v is not None and str(v) != ""},
             "way": True}
    else:
        return None
    return f

def extract():
    # initialize per slug feature lists
    buckets = {slug: [] for slug in BOUNDS}
    # scan nodes
    with open(SOURCE_NODE, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line=line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            lat = obj.get("lat"); lng = obj.get("lng")
            if lat is None or lng is None:
                continue
            for slug, (latMin, latMax, lngMin, lngMax, file) in BOUNDS.items():
                if not (latMin <= lat <= latMax and lngMin <= lng <= lngMax):
                    continue
                f = build_feature(obj, "node")
                if f:
                    buckets[slug].append(f)
    # scan ways (much faster — only 644MB and only check tags first quickly)
    with open(SOURCE_WAY, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line=line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            tags = obj.get("tags") or {}
            # quick skip if no interesting name/tag
            if not (tags.get("name") or tags.get("name:ar") or tags.get("name:en") or
                    tags.get("historic") or tags.get("tourism") or tags.get("amenity")):
                continue
            lat = obj.get("center_lat"); lng = obj.get("center_lng")
            if lat is None or lng is None:
                continue
            for slug, (latMin, latMax, lngMin, lngMax, file) in BOUNDS.items():
                if not (latMin <= lat <= latMax and lngMin <= lng <= lngMax):
                    continue
                f = build_feature(obj, "way")
                if f:
                    buckets[slug].append(f)
    # write outputs
    for slug, feats in buckets.items():
        _, _, _, _, file = BOUNDS[slug]
        out = os.path.join(BASE, *file.split("/"))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        # deduplicate by id+lat+lng roughly (nodes and ways have different id spaces usually)
        seen = set()
        unique = []
        for f in feats:
            k = (f["id"], round(f["lat"], 4), round(f["lng"], 4))
            if k not in seen:
                seen.add(k); unique.append(f)
        meta = {
            "slug": slug,
            "featureCount": len(unique),
            "tourismCount": sum(1 for f in unique if f.get("tags",{}).get("tourism")),
            "historicCount": sum(1 for f in unique if f.get("tags",{}).get("historic")),
            "bounds": {"latMin": BOUNDS[slug][0], "latMax": BOUNDS[slug][1],
                        "lngMin": BOUNDS[slug][2], "lngMax": BOUNDS[slug][3]},
            "features": unique,
        }
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(meta, fh, ensure_ascii=False, separators=(",",":"))
        sz = os.path.getsize(out)
        f0 = unique[0] if unique else {}
        # log in ascii-only (safe for console) — write detail to log file
        log_line = ("%s -> %d B f=%d tour=%d first_EN=%s first_AR=%s lat=%.4f lng=%.4f\n" %
                    (slug, sz, len(unique), meta["tourismCount"],
                     f0.get("nameEn","?")[:30], f0.get("nameAr","?")[:30],
                     f0.get("lat",0), f0.get("lng",0)))
        with open("extract_s8_report.log","a",encoding="utf-8") as lg:
            lg.write(log_line)

if __name__ == "__main__":
    extract()
