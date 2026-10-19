"""Round 3: final targeted pass for coverless venues (varied queries)."""
import json
import time
import random
from pathlib import Path
from urllib.parse import urlparse

from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / 'data' / 'dahab_restaurants.json'
IMG_DIR = ROOT / 'public' / 'images' / 'restaurants'
print('round3 boot', flush=True)

TARGETS = {
    '2700830': ['Al Yusef Dahab', 'Al Yusef restaurant Dahab Egypt'],
    '21251382': ['Nasyet Mekky Dahab', 'Nasyet Mekky restaurant'],
    '2713578': ['Just Noodles Dahab', 'Just Noodles restaurant Dahab Egypt'],
    '22895166': ['Euphoria Dahab restaurant', 'Euphoria restaurant Dahab Egypt'],
    '22906478': ['Euphoria Dahab cafe', 'Euphoria Dahab Egypt'],
}
SKIP_HOSTS = ('tripadvisor.', 'facebook.', 'instagram.', 'google.', 'youtube.', 'tiktok.', 'x.com', 'twitter.')
BAD_IMG = ('logo', 'icon', 'sprite', 'avatar', 'banner', 'ad-', 'ads/', '.svg', 'placeholder')


def rank_link(u):
    host = urlparse(u).netloc.lower()
    if any(h in host for h in SKIP_HOSTS):
        return -1
    if 'restaurantguru.com' in host:
        return 0
    return 1


def page_image(url):
    try:
        page = Fetcher.get(url, impersonate='chrome', stealthy_headers=True, timeout=30)
    except Exception:
        return None
    if page.status != 200:
        return None
    og = page.css('meta[property="og:image"]::attr(content)').get()
    if og and not any(b in og.lower() for b in BAD_IMG):
        return og
    for src in page.css('img::attr(src)').getall():
        if not src or any(b in src.lower() for b in BAD_IMG):
            continue
        if src.startswith('//'):
            src = 'https:' + src
        if src.startswith('/'):
            src = f'{urlparse(url).scheme}://{urlparse(url).netloc}{src}'
        if src.startswith('http'):
            return src
    return None


def download(url, dest):
    try:
        page = Fetcher.get(url, impersonate='chrome', stealthy_headers=True, timeout=30)
    except Exception as e:
        return 'fetch:' + type(e).__name__
    if page.status != 200:
        return 'HTTP ' + str(page.status)
    body = None
    for attr in ('content', 'body'):
        try:
            v = getattr(page, attr, None)
            if isinstance(v, (bytes, bytearray)) and len(v) > 0:
                body = bytes(v)
                break
        except Exception:
            continue
    if body is None:
        return 'empty'
    if len(body) < 8 * 1024:
        return 'small:' + str(len(body))
    if not body[:4].startswith((b'\xff\xd8', b'\x89PN', b'RIFF', b'GIF8')):
        return 'notimg'
    dest.write_bytes(body)
    return None


def main():
    print('round3 main start', flush=True)
    seed = json.loads(SEED.read_text(encoding='utf-8'))
    by_id = {r['locationId']: r for r in seed['restaurants']}
    for lid, queries in TARGETS.items():
        r = by_id.get(lid)
        if not r or r.get('coverImageUrl'):
            print(lid + ': skip (has cover)', flush=True)
            continue
        print('trying ' + r['nameEn'], flush=True)
        found = None
        for q in queries:
            try:
                page = Fetcher.post('https://html.duckduckgo.com/html/', data={'q': q},
                                    impersonate='chrome', stealthy_headers=True, timeout=30)
                links = [u for u in page.css('.result__a::attr(href)').getall() if rank_link(u) >= 0]
                links.sort(key=rank_link, reverse=True)
                for link in links[:6]:
                    img = page_image(link)
                    if img:
                        found = (img, link)
                        break
                    time.sleep(1)
                if found:
                    break
            except Exception as e:
                print('  qfail ' + type(e).__name__, flush=True)
                continue
            time.sleep(1)
        if not found:
            print(r['nameEn'] + ': NO IMAGE', flush=True)
            continue
        err = download(found[0], IMG_DIR / ('ta_' + lid + '.jpg'))
        if err:
            print(r['nameEn'] + ': FAIL ' + err, flush=True)
            continue
        r['coverImageUrl'] = '/images/restaurants/ta_' + lid + '.jpg'
        srcs = r.get('sourceImageUrls') or []
        if found[1] not in srcs:
            srcs.append(found[1])
        r['sourceImageUrls'] = srcs
        print(r['nameEn'] + ': OK <- ' + found[1][:55], flush=True)
        time.sleep(1.5 + random.random())
    SEED.write_text(json.dumps(seed, ensure_ascii=False, indent=1), encoding='utf-8')
    missing = [r for r in seed['restaurants'] if not r.get('coverImageUrl')]
    print('remaining: ' + str(len(missing)), flush=True)
    for r in missing:
        print('  - ' + r['locationId'] + ' ' + r['nameEn'], flush=True)


if __name__ == '__main__':
    main()
