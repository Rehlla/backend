#!/usr/bin/env python3
"""Quick ScrapeGraph v2 test with new key on all 15 URLs."""
import json, os, sys
from datetime import datetime
import urllib.request

KEY = os.environ.get("SCRAPEGRAPH_API_KEY", "sgai-de8d10bc-5e8d-464e-8034-4a3c732d9397")
URLS = [
    ("tripadvisor","dahab","hotels","https://www.tripadvisor.com/Hotels-g297547-Dahab_South_Sinai_Red_Sea_and_Sinai-Hotels.html"),
    ("tripadvisor","dahab","restaurants","https://www.tripadvisor.com/Restaurants-g297547-Dahab_South_Sinai_Red_Sea_and_Sinai.html"),
    ("tripadvisor","dahab","activities","https://www.tripadvisor.com/Attractions-g297547-Activities-oa0-Dahab_South_Sinai_Red_Sea_and_Sinai.html"),
    ("booking","dahab","hotels","https://www.booking.com/city/eg/dhahab.en.html?aid=1610684;label=dhahab-_MIPMZBZN3T5GiTsLmKEtgS379614582198:pl:ta:p1:p2:ac:ap:neg:fi:tikwd-13314956200:lp9261640:li:dec:dm:ppccp=UmFuZG9tSVYkc2RlIyh9YfqnDqqG8nt10AsofPfvtt0;ws=&gad_source=1&gad_campaignid=1573322608&gbraid=0AAAAAD_Ls1KZzNsyY4p0LYiHxXYlm1IvP&gclid=CjwKCAjwuczWBhA9EiwAYGgEoRJ7gN--iBqd_p8JHvIXKWTUsyEm1wGLi_y-jRYCZt5rLYVKf-GeWhoCC0wQAvD_BwE"),
    ("airbnb","dahab","hotels","https://www.airbnb.com/s/Dahab--Egypt/homes?place_id=ChIJX1itvylLqxURvxkzeY0jZaw&refinement_paths%5B%5D=%2Fhomes&checkin=2026-10-25&checkout=2026-10-26&date_picker_type=calendar&adults=1&guests=1&search_type=HOMEPAGE_CAROUSEL_CLICK"),
    ("tripadvisor","nuweiba","hotels","https://www.tripadvisor.com/Hotels-g297551-Nuweiba_South_Sinai_Red_Sea_and_Sinai-Hotels.html"),
    ("tripadvisor","nuweiba","restaurants","https://www.tripadvisor.com/Restaurants-g297551-Nuweiba_South_Sinai_Red_Sea_and_Sinai.html"),
    ("tripadvisor","nuweiba","activities","https://www.tripadvisor.com/Attractions-g297551-Activities-Nuweiba_South_Sinai_Red_Sea_and_Sinai.html"),
    ("booking","nuweiba","hotels","https://www.booking.com/searchresults.html?aid=1610684&label=nuwaybi-n6GuDnsHs%2AWnTaS32Tj68AS541115125158%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-305534302222%3Alp9261640%3Ali%3Adec%3Adm%3Appccp%3DUmFuZG9tSVYkc2RlIyh9YfqnDqqG8nt10AsofPfvtt0&gclid=CjwKCAjwuczWBhA9EiwAYGgEoRwvyvuVqCu210ChwsHT7BBDCnpzHNsJLLrfddaIlAhKYFEZH0cLcxoCjjsQAvD_BwE&dest_type=city&dest_id=-300490&redirected_from_city=1&redirected=1&source=city&keep_landing=1&sid=9620a46bc9fdb7bee31b7c429ce3ec9e"),
    ("airbnb","nuweiba","hotels","https://www.airbnb.com/s/Nuweiba--Egypt/homes?adults=1&refinement_paths%5B%5D=%2Fhomes&property_type_id%5B%5D=42&place_id=ChIJRz-OQnYkVRQRM9co1YxqbX4&location=Nuweiba%2C+Egypt"),
    ("tripadvisor","siwa","hotels","https://www.tripadvisor.com/Hotels-g303857-Siwa_Matrouh_Governorate-Hotels.html"),
    ("tripadvisor","siwa","restaurants","https://www.tripadvisor.com/Restaurants-g303857-Siwa_Matrouh_Governorate.html"),
    ("tripadvisor","siwa","activities","https://www.tripadvisor.com/Attractions-g303857-Activities-c42-Siwa_Matrouh_Governorate.html"),
    ("booking","siwa","hotels","https://www.booking.com/searchresults.html?aid=356980&label=gog235jc-10CAMoQ0IKc2l3YS1vYXNpc0gzWANoQ4gBAZgBM7gBF8gBDNgBA-gBAfgBAYgCAagCAbgCtq3Q1gbAAgHSAiQ1MzEzYjRiMy0zMDJmLTRlYjAtOTAyZi03ZDg1YjRmZTY2NDXYAgHgAgE&city=900063059"),
    ("airbnb","siwa","hotels","https://www.airbnb.com/s/Siwa-Oasis--Egypt/homes?adults=1&refinement_paths%5B%5D=%2Fhomes&place_id=ChIJI6Xz6KyvehQRTQea8fhdM28&location=Siwa+Oasis%2C+Egypt"),
]

results = []
for src, city, cat, url in URLS:
    r = {"url":url, "city":city, "cat":cat, "src":src, "status":"fail", "plan":"new_key", "ts":datetime.now().isoformat()}
    try:
        req = urllib.request.Request(
            "https://v2-api.scrapegraphai.com/api/scrape",
            data=json.dumps({"url": url, "formats": [{"type":"markdown"}]}).encode(),
            headers={"SGAI-APIKEY": KEY, "Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode())
            if data.get("data") or data.get("status") == "success":
                r["status"] = "success"
                r["snippet"] = str(data.get("data", data.get("message","")))[:300]
                r["plan_info"] = data.get("plan", data.get("tier","unknown"))
            else:
                r["status"] = "fail"
                r["message"] = data.get("message", data.get("error", "unknown"))
    except Exception as e:
        r["status"] = "exception"
        r["error"] = str(e)[:200]
    results.append(r)
    print(f"[{len(results)}/15] {city}/{cat}/{src} -> {r['status']}")

os.makedirs("new_data/new_key_test", exist_ok=True)
with open("new_data/new_key_test/results.json", "w", encoding="utf-8") as f:
    json.dump({"key_prefix":"sgai-de8d10b...","fetchedAt":datetime.now().isoformat(),"results":results,"note":"New key test — Free/Pro difference visible in response"}, f, indent=2, ensure_ascii=False)
print("Done. Saved to new_data/new_key_test/results.json")
