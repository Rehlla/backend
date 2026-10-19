#!/usr/bin/env python3
"""Extract individual listings from the 15 travel URLs — organized by city/cat."""
import json, os
from datetime import datetime
from scrapling.fetchers import Fetcher, StealthyFetcher

URLS = [
    {"url":"https://www.tripadvisor.com/Hotels-g297547-Dahab_South_Sinai_Red_Sea_and_Sinai-Hotels.html","city":"dahab","cat":"hotels","src":"tripadvisor","selector":".property_title a::text,.quote .text::text"},
    {"url":"https://www.tripadvisor.com/Restaurants-g297547-Dahab_South_Sinai_Red_Sea_and_Sinai.html","city":"dahab","cat":"restaurants","src":"tripadvisor","selector":".quote .text::text"},
    {"url":"https://www.tripadvisor.com/Attractions-g297547-Activities-oa0-Dahab_South_Sinai_Red_Sea_and_Sinai.html","city":"dahab","cat":"activities","src":"tripadvisor","selector":"h1,h2,.quote .text::text"},
    {"url":"https://www.booking.com/city/eg/dhahab.en.html?aid=1610684;label=dhahab-_MIPMZBZN3T5GiTsLmKEtgS379614582198:pl:ta:p1:p2:ac:ap:neg:fi:tikwd-13314956200:lp9261640:li:dec:dm:ppccp=UmFuZG9tSVYkc2RlIyh9YfqnDqqG8nt10AsofPfvtt0;ws=&gad_source=1&gad_campaignid=1573322608&gbraid=0AAAAAD_Ls1KZzNsyY4p0LYiHxXYlm1IvP&gclid=CjwKCAjwuczWBhA9EiwAYGgEoRJ7gN--iBqd_p8JHvIXKWTUsyEm1wGLi_y-jRYCZt5rLYVKf-GeWhoCC0wQAvD_BwE","city":"dahab","cat":"hotels","src":"booking","selector":".sr_property_card .property-name::text,.sr_property_card .sr-hotel__name::text"},
    {"url":"https://www.airbnb.com/s/Dahab--Egypt/homes?place_id=ChIJX1itvylLqxURvxkzeY0jZaw&refinement_paths%5B%5D=%2Fhomes&checkin=2026-10-25&checkout=2026-10-26&date_picker_type=calendar&adults=1&guests=1&search_type=HOMEPAGE_CAROUSEL_CLICK","city":"dahab","cat":"hotels","src":"airbnb","selector":".g1q79x3b ._fecoyn4::text,.g1q79x3b ._1tanv1h::text"},
    {"url":"https://www.tripadvisor.com/Hotels-g297551-Nuweiba_South_Sinai_Red_Sea_and_Sinai-Hotels.html","city":"nuweiba","cat":"hotels","src":"tripadvisor","selector":".property_title a::text,.quote .text::text"},
    {"url":"https://www.tripadvisor.com/Restaurants-g297551-Nuweiba_South_Sinai_Red_Sea_and_Sinai.html","city":"nuweiba","cat":"restaurants","src":"tripadvisor","selector":".quote .text::text"},
    {"url":"https://www.tripadvisor.com/Attractions-g297551-Activities-Nuweiba_South_Sinai_Red_Sea_and_Sinai.html","city":"nuweiba","cat":"activities","src":"tripadvisor","selector":"h1,h2,.quote .text::text"},
    {"url":"https://www.booking.com/searchresults.html?aid=1610684&label=nuwaybi-n6GuDnsHs%2AWnTaS32Tj68AS541115125158%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-305534302222%3Alp9261640%3Ali%3Adec%3Adm%3Appccp%3DUmFuZG9tSVYkc2RlIyh9YfqnDqqG8nt10AsofPfvtt0&gclid=CjwKCAjwuczWBhA9EiwAYGgEoRwvyvuVqCu210ChwsHT7BBDCnpzHNsJLLrfddaIlAhKYFEZH0cLcxoCjjsQAvD_BwE&dest_type=city&dest_id=-300490&redirected_from_city=1&redirected=1&source=city&keep_landing=1&sid=9620a46bc9fdb7bee31b7c429ce3ec9e","city":"nuweiba","cat":"hotels","src":"booking","selector":".sr_property_card .property-name::text"},
    {"url":"https://www.airbnb.com/s/Nuweiba--Egypt/homes?adults=1&refinement_paths%5B%5D=%2Fhomes&property_type_id%5B%5D=42&place_id=ChIJRz-OQnYkVRQRM9co1YxqbX4&location=Nuweiba%2C+Egypt","city":"nuweiba","cat":"hotels","src":"airbnb","selector":".g1q79x3b ._fecoyn4::text"},
    {"url":"https://www.tripadvisor.com/Hotels-g303857-Siwa_Matrouh_Governorate-Hotels.html","city":"siwa","cat":"hotels","src":"tripadvisor","selector":".property_title a::text"},
    {"url":"https://www.tripadvisor.com/Restaurants-g303857-Siwa_Matrouh_Governorate.html","city":"siwa","cat":"restaurants","src":"tripadvisor","selector":".quote .text::text"},
    {"url":"https://www.tripadvisor.com/Attractions-g303857-Activities-c42-Siwa_Matrouh_Governorate.html","city":"siwa","cat":"activities","src":"tripadvisor","selector":"h1,h2"},
    {"url":"https://www.booking.com/searchresults.html?aid=356980&label=gog235jc-10CAMoQ0IKc2l3YS1vYXNpc0gzWANoQ4gBAZgBM7gBF8gBDNgBA-gBAfgBAYgCAagCAbgCtq3Q1gbAAgHSAiQ1MzEzYjRiMy0zMDJmLTRlYjAtOTAyZi03ZDg1YjRmZTY2NDXYAgHgAgE&city=900063059","city":"siwa","cat":"hotels","src":"booking","selector":".sr_property_card .property-name::text"},
    {"url":"https://www.airbnb.com/s/Siwa-Oasis--Egypt/homes?adults=1&refinement_paths%5B%5D=%2Fhomes&place_id=ChIJI6Xz6KyvehQRTQea8fhdM28&location=Siwa+Oasis%2C+Egypt","city":"siwa","cat":"hotels","src":"airbnb","selector":".g1q79x3b ._fecoyn4::text"},
]

extracted = []
for item in URLS:
    items = []
    try:
        if item["src"] in ("tripadvisor",):
            page = Fetcher.get(item["url"], stealthy_headers=True, impersonate="chrome")
        else:
            try:
                page = StealthyFetcher.fetch(item["url"], headless=True, timeout=20)
            except:
                page = Fetcher.get(item["url"], stealthy_headers=True)
        selectors = item.get("selector", "h1,h2,::text").split(",")
        for sel in selectors:
            try:
                vals = page.css(sel).getall()
                for v in vals:
                    v = v.strip()
                    if v and len(v) > 3:
                        items.append({"text": v, "selector": sel})
            except Exception as e:
                pass
        # Deduplicate
        seen = set()
        unique_items = []
        for it in items:
            if it["text"] not in seen:
                seen.add(it["text"])
                unique_items.append(it)
        items = unique_items[:20]  # cap per URL
    except Exception as e:
        items = [{"text":"FETCH_ERROR","selector":"error","message":str(e)[:100]}]

    extracted.append({
        "url": item["url"],
        "city": item["city"],
        "cat": item["cat"],
        "src": item["src"],
        "count": len(items),
        "items": items,
        "fetchedAt": datetime.now().isoformat(),
    })
    print(f"[{len(extracted)}/15] {item['city']}/{item['cat']}/{item['src']} -> {len(items)} items")

os.makedirs("new_data/extracted_items", exist_ok=True)
with open("new_data/extracted_items/MASTER.json", "w", encoding="utf-8") as f:
    json.dump({"fetchedAt": datetime.now().isoformat(), "total": len(URLS), "totalItems": sum(r["count"] for r in extracted), "results": extracted}, f, indent=2, ensure_ascii=False)

for r in extracted:
    d = f"new_data/extracted_items/{r['city']}/{r['cat']}"
    os.makedirs(d, exist_ok=True)
    with open(f"{d}/{r['src']}.json", "w", encoding="utf-8") as f:
        json.dump({"city": r["city"], "category": r["cat"], "source": r["src"], "items": r["items"], "count": r["count"]}, f, indent=2, ensure_ascii=False)

print("Done. Extracted items saved to new_data/extracted_items/")
print("Total individual items extracted:", sum(r["count"] for r in extracted))
