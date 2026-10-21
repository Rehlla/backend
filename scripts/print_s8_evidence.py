#!/usr/bin/env python3
"""Print the real Sprint 8 API evidence (UTF-8 safe) from logs/final_fixed_counts_api.json."""
import json, os, sys

sys.stdout.reconfigure(encoding="utf-8")

j = json.load(open("logs/final_fixed_counts_api.json", encoding="utf-8"))
rows = []

for slug, e in j["main"].items():
    p, h, f, m = e["places"], e["hotels"], e["food"], e["meta"]
    f3 = p.get("first3") or []
    names = " | ".join((x.get("name") or "?") for x in f3)
    rows.append("%-15s places=%s/%s tour=%s hot=%s food=%s meta=%s/%s pop=%s | %s" % (
        slug, p.get("status"), p.get("count"), p.get("tourismCount"),
        h.get("count"), f.get("count"), m.get("status"), m.get("count"),
        m.get("population"), names))

for slug, e in j["sub"].items():
    p, h, f = e["places"], e["hotels"], e["food"]
    f3 = p.get("first3") or []
    names = " | ".join((x.get("name") or "?") for x in f3)
    rows.append("%-15s places=%s/%s tour=%s hot=%s food=%s | %s" % (
        slug, p.get("status"), p.get("count"), p.get("tourismCount"),
        h.get("count"), f.get("count"), names))

for k, e in j["extras"].items():
    extra = ""
    if e.get("stops"):
        extra = " -> " + ", ".join(
            "%s(%.3f,%.3f)" % (s.get("name", "?"), s.get("lat", 0), s.get("lng", 0))
            for s in e["stops"] if isinstance(s, dict))
    if e.get("subDestinations"):
        extra = " -> " + ", ".join(
            "%s[parent=%s f=%s]" % (s.get("slug"), s.get("parent"), s.get("featureCount"))
            for s in e["subDestinations"])
    rows.append("%-15s status=%s count=%s%s" % (k, e.get("status"), e.get("count", e.get("stopCount", "")), extra))

out = "\n".join(rows)
with open("logs/final_fixed_counts_api_summary.txt", "w", encoding="utf-8") as fh:
    fh.write(out + "\n")
print(out)
print("\nlog size:", os.path.getsize("logs/final_fixed_counts_api_summary.txt"), "B")
