import urllib.request, json, time
time.sleep(5)
base = "http://localhost:3000"
for c in ["hurghada","luxor","taba","sharm","dahab"]:
    try:
        resp = urllib.request.urlopen(base+"/api/cities/"+c+"/hotels", timeout=15)
        j = json.loads(resp.read().decode("utf-8"))
        first = (j.get("first") or {}).get("name", "")
        print("%s hotels status=%d count=%s first=%s" % (c, resp.status, j.get("count"), first[:40]))
    except Exception as e:
        print("%s ERROR: %s" % (c, str(e)[:60]))
