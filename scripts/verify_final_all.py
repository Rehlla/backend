#!/usr/bin/env python3
"""Sprint 9 final verification — hits the live API, records REAL responses only.

Usage: python scripts/verify_final_all.py [base_url]
Writes: logs/final_verification_all.json
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
CTX = ssl.create_default_context()

MAIN = [
    "dahab", "sharm", "hurghada", "marsa_alam", "siwa", "nuweiba",
    "alexandria", "giza", "luxor", "aswan", "saint_catherine", "taba",
]
SUB_PAIRS = [
    ("sharm", "ras_mohamed"),
    ("nuweiba", "colored_canyon"),
    ("aswan", "abu_simbel"),
]


def fetch(url):
    """Returns (status, body_text). Never raises."""
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json; charset=utf-8"})
        with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:  # connection refused, timeout, DNS
        return 0, "ERROR: %s" % e


def features_of(payload):
    """Pull the feature list out of whichever envelope the endpoint uses."""
    if not isinstance(payload, dict):
        return []
    for key in ("features", "places", "items", "results", "data"):
        v = payload.get(key)
        if isinstance(v, list):
            return v
        if isinstance(v, dict):
            for key2 in ("features", "places", "items", "results"):
                v2 = v.get(key2)
                if isinstance(v2, list):
                    return v2
    return []


def label_of(feature):
    if not isinstance(feature, dict):
        return ""
    for key in ("name", "nameAr", "name_ar", "title", "label"):
        v = feature.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    tags = feature.get("tags")
    if isinstance(tags, dict):
        for key in ("tourism", "historic", "restaurant", "cafe", "dive_centre", "viewpoint"):
            v = tags.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
    return ""


def count_field(payload):
    if isinstance(payload, dict):
        for key in ("count", "total", "totalCount", "featureCount"):
            if isinstance(payload.get(key), int):
                return payload[key]
    return None


def summarise(url, payload, body):
    feats = features_of(payload)
    first = label_of(feats[0]) if feats else ""
    return {
        "url": url,
        "status": 200,
        "count": len(feats),
        "count_field": count_field(payload),
        "first_name": first[:120],
        "first_lat": (feats[0].get("lat") if feats and isinstance(feats[0], dict) else None),
        "first_lng": (feats[0].get("lng") if feats and isinstance(feats[0], dict) else None),
        "utf8_ok": ("????" not in first),
        "body_bytes": len(body.encode("utf-8")),
    }


def main():
    results = {}
    raw_samples = {}

    # --- 12 main cities: places / hotels / food / meta ---
    for city in MAIN:
        for kind in ("places", "hotels", "food", "meta"):
            url = "%s/api/cities/%s/%s" % (BASE, city, kind)
            status, body = fetch(url)
            entry = {"url": url, "status": status, "body_bytes": len(body.encode("utf-8"))}
            if status == 200:
                try:
                    payload = json.loads(body)
                except Exception:
                    payload = None
                if kind == "meta":
                    entry["meta_keys"] = sorted(payload.keys())[:24] if isinstance(payload, dict) else []
                    for probe in ("population", "wikidata", "bounds", "heroImage", "hero", "vibe", "lat", "lng"):
                        if isinstance(payload, dict) and probe in payload:
                            val = payload[probe]
                            entry[probe] = val if not isinstance(val, (dict, list)) else str(val)[:160]
                else:
                    entry.update(summarise(url, payload, body))
                raw_samples["%s/%s" % (city, kind)] = payload
            else:
                entry["error"] = body[:200]
            results["%s/%s" % (city, kind)] = entry

    # --- 3 sub destinations ---
    for parent, sub in SUB_PAIRS:
        status, body = fetch("%s/api/cities/%s/sub" % (BASE, parent))
        entry = {"url": "%s/api/cities/%s/sub" % (BASE, parent), "status": status}
        if status == 200:
            try:
                payload = json.loads(body)
                subs = features_of(payload)
                if not subs and isinstance(payload, dict):
                    for v in payload.values():
                        if isinstance(v, list):
                            subs = v
                            break
                names = []
                for s in subs if isinstance(subs, list) else []:
                    if isinstance(s, dict):
                        names.append(s.get("id") or s.get("slug") or s.get("name"))
                    else:
                        names.append(str(s))
                entry["sub_ids"] = names
                entry["contains_target"] = sub in names
            except Exception:
                pass
        results["%s/sub-list" % parent] = entry

        for kind in ("places", "hotels", "food", "meta"):
            url = "%s/api/cities/%s/sub/%s/%s" % (BASE, parent, sub, kind)
            status, body = fetch(url)
            entry = {"url": url, "status": status, "body_bytes": len(body.encode("utf-8"))}
            if status == 200:
                try:
                    payload = json.loads(body)
                except Exception:
                    payload = None
                if kind == "meta":
                    entry["meta_keys"] = sorted(payload.keys())[:24] if isinstance(payload, dict) else []
                    for probe in ("parent", "coords", "lat", "lng", "vibe", "heroImage"):
                        if isinstance(payload, dict) and probe in payload:
                            val = payload[probe]
                            entry[probe] = val if not isinstance(val, (dict, list)) else str(val)[:160]
                else:
                    entry.update(summarise(url, payload, body))
                raw_samples["%s/%s/%s" % (parent, sub, kind)] = payload
            else:
                entry["error"] = body[:200]
            results["%s/%s/%s" % (parent, sub, kind)] = entry

    # --- Nile cruise ---
    url = "%s/api/nile-cruise/routes" % BASE
    status, body = fetch(url)
    entry = {"url": url, "status": status}
    if status == 200:
        try:
            payload = json.loads(body)
            stops = features_of(payload)
            if not stops and isinstance(payload, dict):
                for v in payload.values():
                    if isinstance(v, list):
                        stops = v
                        break
            entry["stops"] = len(stops) if isinstance(stops, list) else 0
            entry["stop_names"] = [label_of(s) for s in stops][:10]
            entry["stop_coords"] = [
                {"name": label_of(s), "lat": s.get("lat") if isinstance(s, dict) else None,
                 "lng": s.get("lng") if isinstance(s, dict) else None}
                for s in stops
            ]
        except Exception:
            pass
    results["cruise/routes"] = entry

    # --- admin must stay 401 ---
    status, body = fetch("%s/api/cities/dahab/admin/stats" % BASE)
    results["admin/stats"] = {"url": "%s/api/cities/dahab/admin/stats" % BASE, "status": status,
                              "expected_401": status == 401, "body_bytes": len(body.encode("utf-8"))}

    # --- backward compat ---
    status, body = fetch("%s/api/dahab/places" % BASE)
    compat = {"url": "%s/api/dahab/places" % BASE, "status": status}
    if status == 200:
        try:
            payload = json.loads(body)
            feats = features_of(payload)
            compat["count"] = len(feats)
            compat["count_field"] = count_field(payload)
            compat["first_name"] = label_of(feats[0]) if feats else ""
        except Exception:
            pass
    results["back-compat/dahab/places"] = compat

    out = {
        "base": BASE,
        "results": results,
        "raw_samples": raw_samples,
    }
    path = "logs/final_verification_all.json"
    os.makedirs("logs", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # --- console summary (ASCII-safe) ---
    def clean(s):
        return "".join(ch if ord(ch) < 128 else "?" for ch in str(s))

    print("WROTE", path)
    for key in sorted(results):
        v = results[key]
        if "count" in v:
            print("  %-34s status=%s count=%-6s first=%s" % (
                key, v.get("status"), v.get("count"), clean(v.get("first_name", ""))[:60]))
        elif "stops" in v:
            print("  %-34s status=%s stops=%s" % (key, v.get("status"), v.get("stops")))
        else:
            print("  %-34s status=%s" % (key, v.get("status")))


if __name__ == "__main__":
    main()
