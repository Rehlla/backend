#!/usr/bin/env python3
"""Precise frontend audit: which slugs appear in which src/ file (exact slug match)."""
import os, re, sys, json

sys.stdout.reconfigure(encoding="utf-8")

BASE = r"D:\dahab-—-travel-platform\Travel.eg\src"
SLUGS = ["luxor", "aswan", "saint_catherine", "taba", "ras_mohamed",
         "colored_canyon", "abu_simbel", "dahab", "sharm", "hurghada",
         "marsa_alam", "siwa", "nuweiba", "alexandria", "giza"]
# extra needles for the cruise route feature
EXTRA = ["nile_cruise", "nile-cruise", "nileCruise", "Nile Cruise", "esna", "edfu", "kom_ombo", "kom ombo"]

rows = []
for root, dirs, files in os.walk(BASE):
    dirs[:] = [d for d in dirs if d not in ("node_modules", "dist")]
    for f in sorted(files):
        if not f.endswith((".ts", ".tsx")):
            continue
        path = os.path.join(root, f)
        rel = os.path.relpath(path, BASE).replace("\\", "/")
        try:
            content = open(path, encoding="utf-8", errors="replace").read()
        except Exception:
            continue
        found = [s for s in SLUGS if re.search(r"['\"/\b]%s['\"/\b]" % re.escape(s), content)]
        extra = [e for e in EXTRA if e.lower() in content.lower()]
        if found or extra:
            rows.append((rel, found, extra))

rows.sort()
out = []
for rel, found, extra in rows:
    out.append("%-58s | %s%s" % (rel, ",".join(found) if found else "-",
                                 ("  CRUISE:" + ",".join(extra)) if extra else ""))
text = "\n".join(out)
with open("frontend_audit.txt", "w", encoding="utf-8") as fh:
    fh.write(text)
print(text)
print("\nfiles matched:", len(rows))
