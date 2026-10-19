#!/usr/bin/env python3
"""Scrapling unified fetch — unstoppable pipeline for all 15 travel URLs."""
import json, sys, os
from datetime import datetime
from scrapling.fetchers import Fetcher, StealthyFetcher

URLS = [
    # Dahab
    {"url":"https://www.tripadvisor.com/Hotels-g297547-Dahab_South_Sinai_Red_Sea_and_Sinai-Hotels.html","city":"dahab","cat":"hotels","src":"tripadvisor"},
    {"url":"https://www.tripadvisor.com/Restaurants-g297547-Dahab_South_Sinai_Red_Sea_and_Sinai.html","city":"dahab","cat":"restaurants","src":"tripadvisor"},
    {"url":"https://www.tripadvisor.com/Attractions-g297547-Activities-oa0-Dahab_South_Sinai_Red_Sea_and_Sinai.html","city":"dahab","cat":"activities","src":"tripadvisor"},
    {"url":"https://www.booking.com/city/eg/dhahab.en.html?aid=1610684;label=dhahab-_MIPMZBZN3T5GiTsLmKEtgS379614582198:pl:ta:p1:p2:ac:ap:neg:fi:tikwd-13314956200:lp9261640:li:dec:dm:ppccp=UmFuZG9tSVYkc2RlIyh9YfqnDqqG8nt10AsofPfvtt0;ws=&gad_source=1&gad_campaignid=1573322608&gbraid=0AAAAAD_Ls1KZzNsyY4p0LYiHxXYlm1IvP&gclid=CjwKCAjwuczWBhA9EiwAYGgEoRJ7gN--iBqd_p8JHvIXKWTUsyEm1wGLi_y-jRYCZt5rLYVKf-GeWhoCC0wQAvD_BwE","city":"dahab","cat":"hotels","src":"booking"},
    {"url":"https://www.airbnb.com/s/Dahab--Egypt/homes?place_id=ChIJX1itvylLqxURvxkzeY0jZaw&refinement_paths%5B%5D=%2Fhomes&checkin=2026-10-25&checkout=2026-10-26&date_picker_type=calendar&adults=1&guests=1&search_type=HOMEPAGE_CAROUSEL_CLICK","city":"dahab","cat":"hotels","src":"airbnb"},
    # Nuweiba
    {"url":"https://www.tripadvisor.com/Hotels-g297551-Nuweiba_South_Sinai_Red_Sea_and_Sinai-Hotels.html","city":"nuweiba","cat":"hotels","src":"tripadvisor"},
    {"url":"https://www.tripadvisor.com/Restaurants-g297551-Nuweiba_South_Sinai_Red_Sea_and_Sinai.html","city":"nuweiba","cat":"restaurants","src":"tripadvisor"},
    {"url":"https://www.tripadvisor.com/Attractions-g297551-Activities-Nuweiba_South_Sinai_Red_Sea_and_Sinai.html","city":"nuweiba","cat":"activities","src":"tripadvisor"},
    {"url":"https://www.booking.com/searchresults.html?aid=1610684&label=nuwaybi-n6GuDnsHs%2AWnTaS32Tj68AS541115125158%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-305534302222%3Alp9261640%3Ali%3Adec%3Adm%3Appccp%3DUmFuZG9tSVYkc2RlIyh9YfqnDqqG8nt10AsofPfvtt0&gclid=CjwKCAjwuczWBhA9EiwAYGgEoRwvyvuVqCu210ChwsHT7BBDCnpzHNsJLLrfddaIlAhKYFEZH0cLcxoCjjsQAvD_BwE&dest_type=city&dest_id=-300490&redirected_from_city=1&redirected=1&source=city&keep_landing=1&sid=9620a46bc9fdb7bee31b7c429ce3ec9e","city":"nuweiba","cat":"hotels","src":"booking"},
    {"url":"https://www.airbnb.com/s/Nuweiba--Egypt/homes?adults=1&refinement_paths%5B%5D=%2Fhomes&property_type_id%5B%5D=42&place_id=ChIJRz-OQnYkVRQRM9co1YxqbX4&location=Nuweiba%2C+Egypt","city":"nuweiba","cat":"hotels","src":"airbnb"},
    # Siwa
    {"url":"https://www.tripadvisor.com/Hotels-g303857-Siwa_Matrouh_Governorate-Hotels.html","city":"siwa","cat":"hotels","src":"tripadvisor"},
    {"url":"https://www.tripadvisor.com/Restaurants-g303857-Siwa_Matrouh_Governorate.html","city":"siwa","cat":"restaurants","src":"tripadvisor"},
    {"url":"https://www.tripadvisor.com/Attractions-g303857-Activities-c42-Siwa_Matrouh_Governorate.html","city":"siwa","cat":"activities","src":"tripadvisor"},
    {"url":"https://www.booking.com/searchresults.html?aid=356980&label=gog235jc-10CAMoQ0IKc2l3YS1vYXNpc0gzWANoQ4gBAZgBM7gBF8gBDNgDA-gBAfgBAYgCAagCAbgCtq3Q1gbAAgHSAiQ1MzEzYjRiMy0zMDJmLTRlYjAtOTAyZi03ZDg1YjRmZTY2NDXYAgHgAgE&city=900063059","city":"siwa","cat":"hotels","src":"booking"},
    {"url":"https://www.airbnb.com/s/Siwa-Oasis--Egypt/homes?adults=1&refinement_paths%5B%5D=%2Fhomes&place_id=ChIJI6Xz6KyvehQRTQea8fhdM28&location=Siwa+Oasis%2C+Egypt","city":"siwa","cat":"hotels","src":"airbnb"},
]

results = []

for item in URLS:
    r = {"url": item["url"], "city": item["city"], "cat": item["cat"], "src": item["src"], "status": "fail", "len": 0, "title": None, "ts": datetime.now().isoformat()}
    try:
        # Try stealth browser for protected pages first (TripAdvisor/Booking)
        if item["src"] in ("tripadvisor", "booking"):
            page = StealthyFetcher.fetch(item["url"], headless=True, solve_cloudflare=False, timeout=30)
        else:
            page = Fetcher.get(item["url"], stealthy_headers=True)
        r["status"] = "success"
        r["len"] = len(page.html()) if hasattr(page, "html") else len(str(page))
        r["title"] = page.css("title::text").get() or str(page)[:200]
    except Exception as e:
        r["status"] = "fail"
        r["error"] = str(e)[:200]
        # Fallback: try basic Fetcher
        try:
            page = Fetcher.get(item["url"], stealthy_headers=True)
            r["status"] = "fallback_success"
            r["len"] = len(str(page))
            r["title"] = (page.css("title::text").get() if hasattr(page, "css") else "N/A")[:200]
        except Exception as e2:
            r["fallback_error"] = str(e2)[:200]
    results.append(r)
    print(f"[{len(results)}/{len(URLS)}] {item['city']}/{item['cat']}/{item['src']} -> {r['status']} (len={r['len']})")

# Organize by city/cat/src
organized = {}
for r in results:
    key = f"{r['city']}/{r['cat']}/{r['src']}"
    organized.setdefault(key, []).append(r)

os.makedirs("new_data/scrapling_organized", exist_ok=True)
with open("new_data/scrapling_organized/MASTER.json", "w", encoding="utf-8") as f:
    json.dump({"fetchedAt": datetime.now().isoformat(), "total": len(URLS), "results": results, "groups": {k: len(v) for k,v in organized.items()}}, f, indent=2, ensure_ascii=False)

for key, items in organized.items():
    city, cat, src = key.split("/")
    d = f"new_data/scrapling_organized/{city}/{cat}"
    os.makedirs(d, exist_ok=True)
    with open(f"{d}/{src}.json", "w", encoding="utf-8") as f:
        json.dump({"city": city, "category": cat, "source": src, "count": len(items), "items": items}, f, indent=2, ensure_ascii=False)

print("Scrapling done. Organized:", len(organized), "groups.")
