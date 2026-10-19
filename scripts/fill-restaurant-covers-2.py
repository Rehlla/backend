"""Round 2: duplicate-pair covers + re-search with re-ranked sources.

- Known twin listings share the primary's cover (same physical venue) and get
  duplicateListings + reviewFlagged provenance for human review.
- Re-search prefers photo-rich directories over restaurantguru (whose default
  thumbnail is a 2.5KB placeholder) and accepts >= 8KB images.
"""
import json
import shutil
import time
import random
from pathlib import Path
from urllib.parse import urlparse

from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / 'data' / 'dahab_restaurants.json'
IMG_DIR = ROOT / 'public' / 'images' / 'restaurants'

DUPLICATE_PAIRS = [
    ('28228725', '32826332'),   # Miami Fish Restaurant x2
    ('28243211', '28243210'),   # Shabka (&) Senara
    ('22895166', '22906478'),   # Euphoria (x2)
    ('33160650', '33181839'),   # Asian King (x2)
    ('34158867', '34157499'),   # Ghazala (x2)
]

PREFER_HOSTS = ('dailydahab.com', 'wanderlog.com', 'sluurpy.com', 'mapquest.com',
                'wheree.com', 'evendo.com', 'onlybeaches.com', 'foodflo.app')
SKIP_HOSTS = ('tripadvisor.', 'facebook.', 'instagram.', 'google.', 'youtube.', 'tiktok.', 'x.com', 'twitter.')
BAD_IMG = ('logo', 'icon', 'sprite', 'avatar', 'banner', 'ad-', 'ads/', '.svg', 'placeholder')
MIN_BYTES = 8 * 1024


def fetch(url, **kw):
    return Fetcher.get(url, impersonate='chrome', stealthy_headers=True, timeout=30, **kw)


def rank_link(u):
    host = urlparse(u).netloc.lower()
    if any(h in host for h in SKIP_HOSTS):
        return -1
    if 'restaurantguru.com' in host:
        return 0
    if any(h in host for h in PREFER_HOSTS):
        return 2
    return 1


def page_image(url):
    try:
        page = fetch(url)
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
        page = fetch(url)
    except Exception as e:
        return f'fetch: {type(e).__name__}'
    if page.status != 200:
        return f'HTTP {page.status}'
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
        return 'empty body'
    if len(body) < MIN_BYTES:
        return f'too small ({len(body)}b)'
    if not body[:4].startswith((b'\xff\xd8', b'\x89PN', b'RIFF', b'GIF8')):
        return 'not an image'
    dest.write_bytes(body)
    return None


def main():
    seed = json.loads(SEED.read_text(encoding='utf-8'))
    by_id = {r['locationId']: r for r in seed['restaurants']}
    fixed_dupes = 0
    for a, b in DUPLICATE_PAIRS:
        ra, rb = by_id.get(a), by_id.get(b)
        if not ra or not rb:
            continue
        for x, y in ((ra, rb), (rb, ra)):
            dls = set(x.get('duplicateListings') or [])
            dls.add(y['locationId'])
            x['duplicateListings'] = sorted(dls)
            x['reviewFlagged'] = True
        # share cover from whichever twin has one
        src = ra if ra.get('coverImageUrl') else (rb if rb.get('coverImageUrl') else None)
        dst = rb if src is ra else (ra if src is rb else None)
        if src and dst and not dst.get('coverImageUrl'):
            src_file = IMG_DIR / f"ta_{src['locationId']}.jpg"
            dst_file = IMG_DIR / f"ta_{dst['locationId']}.jpg"
            if src_file.exists():
                shutil.copyfile(src_file, dst_file)
                dst['coverImageUrl'] = f"/images/restaurants/ta_{dst['locationId']}.jpg"
                fixed_dupes += 1
                print(f'dupe cover: {dst["nameEn"]} <- {src["nameEn"]}')
    print(f'duplicate pairs flagged, covers shared: {fixed_dupes}')

    missing = [r for r in seed['restaurants'] if not r.get('coverImageUrl')]
    print(f'still missing: {len(missing)}')
    done, failed = 0, []
    for i, r in enumerate(missing):
        lid, name = r['locationId'], r['nameEn']
        try:
            page = Fetcher.post('https://html.duckduckgo.com/html/', data={'q': f'{name} Dahab restaurant'},
                                impersonate='chrome', stealthy_headers=True, timeout=30)
            links = [u for u in page.css('.result__a::attr(href)').getall() if rank_link(u) >= 0]
            links.sort(key=rank_link, reverse=True)
            img_url, src_page = None, None
            for link in links[:6]:
                img_url = page_image(link)
                if img_url:
                    src_page = link
                    break
                time.sleep(1)
            if not img_url:
                failed.append((lid, name, 'no image'))
                print(f'[{i+1}/{len(missing)}] {name}: NO IMAGE')
                continue
            dest = IMG_DIR / f'ta_{lid}.jpg'
            err = download(img_url, dest)
            if err:
                failed.append((lid, name, err))
                print(f'[{i+1}/{len(missing)}] {name}: FAIL {err}')
                continue
            r['coverImageUrl'] = f'/images/restaurants/ta_{lid}.jpg'
            srcs = r.get('sourceImageUrls') or []
            if src_page and src_page not in srcs:
                srcs.append(src_page)
            r['sourceImageUrls'] = srcs
            done += 1
            print(f'[{i+1}/{len(missing)}] {name}: OK <- {src_page[:55]}')
        except Exception as e:
            failed.append((lid, name, type(e).__name__))
            print(f'[{i+1}/{len(missing)}] {name}: ERROR {type(e).__name__}')
        time.sleep(1.5 + random.random())
    SEED.write_text(json.dumps(seed, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'\nround2 done: {done} | still missing: {len(failed)}')
    for lid, name, why in failed:
        print(f'  - {lid} {name}: {why}')


if __name__ == '__main__':
    main()
