"""Fill missing restaurant covers via web search (Scrapling) + download.

Per venue without coverImageUrl:
  1. DuckDuckGo HTML search "{name} Dahab restaurant" -> result links.
  2. Prefer dailydahab.com/listing/*, then restaurantguru.com, then any
     non-tripadvisor/facebook page (TA blocks plain HTTP; FB needs JS).
  3. Fetch page -> og:image (fallback: page images minus logos/ads).
  4. Download image (>15KB, image/*) -> public/images/restaurants/ta_<id>.jpg.
  5. Update data/dahab_restaurants.json (coverImageUrl + sourceImageUrls).

Run: python scripts/fill-restaurant-covers.py
"""
import json
import re
import time
import random
from pathlib import Path
from urllib.parse import urlparse

from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / 'data' / 'dahab_restaurants.json'
IMG_DIR = ROOT / 'public' / 'images' / 'restaurants'

SKIP_HOSTS = ('tripadvisor.', 'facebook.', 'instagram.', 'google.', 'youtube.', 'tiktok.', 'x.com', 'twitter.')
PREFER_PATHS = ('dailydahab.com/listing/', 'restaurantguru.com/')
BAD_IMG = ('logo', 'icon', 'sprite', 'avatar', 'banner', 'ad-', 'ads/', '.svg', 'placeholder')


def fetch(url, **kw):
    return Fetcher.get(url, impersonate='chrome', stealthy_headers=True, timeout=30, **kw)


def ddg_links(query, limit=8):
    page = Fetcher.post('https://html.duckduckgo.com/html/', data={'q': query},
                        impersonate='chrome', stealthy_headers=True, timeout=30)
    if page.status != 200:
        return []
    return page.css('.result__a::attr(href)').getall()[:limit]


def rank_link(u):
    host = urlparse(u).netloc.lower()
    if any(h in host for h in SKIP_HOSTS):
        return -1
    if any(p in u for p in PREFER_PATHS):
        return 2
    return 1


def page_image(url):
    try:
        page = fetch(url)
    except Exception:
        return None, None
    if page.status != 200:
        return None, None
    og = page.css('meta[property="og:image"]::attr(content)').get()
    if og and not any(b in og.lower() for b in BAD_IMG):
        return og, url
    for src in page.css('img::attr(src)').getall():
        if not src or any(b in src.lower() for b in BAD_IMG):
            continue
        if src.startswith('//'):
            src = 'https:' + src
        if src.startswith('/'):
            src = f'{urlparse(url).scheme}://{urlparse(url).netloc}{src}'
        if src.startswith('http'):
            return src, url
    return None, None


def download(url, dest):
    try:
        page = fetch(url)
    except Exception as e:
        return f'fetch: {type(e).__name__}'
    if page.status != 200:
        return f'HTTP {page.status}'
    ctype = ''
    try:
        ctype = str(page.headers.get('content-type', ''))
    except Exception:
        pass
    body = None
    for attr in ('content', 'body'):
        try:
            v = getattr(page, attr, None)
            if isinstance(v, (bytes, bytearray)) and len(v) > 0:
                body = bytes(v)
                break
            if isinstance(v, str) and len(v) > 0:
                body = v.encode('utf-8', 'ignore')
                break
        except Exception:
            continue
    if body is None:
        return 'empty body'
    if 'image' not in ctype and not body[:4].startswith((b'\xff\xd8', b'\x89PN', b'RIFF', b'GIF8')):
        return f'not an image ({ctype[:40]})'
    if len(body) < 15 * 1024:
        return f'too small ({len(body)}b)'
    dest.write_bytes(body)
    return None


def main():
    seed = json.loads(SEED.read_text(encoding='utf-8'))
    missing = [r for r in seed['restaurants'] if not r.get('coverImageUrl')]
    print(f'missing covers: {len(missing)}')
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    done, failed = 0, []
    for i, r in enumerate(missing):
        lid, name = r['locationId'], r['nameEn']
        query = f'{name} Dahab restaurant'
        try:
            links = [u for u in ddg_links(query) if rank_link(u) >= 0]
            links.sort(key=rank_link, reverse=True)
            img_url, src_page = None, None
            for link in links[:5]:
                img_url, src_page = page_image(link)
                if img_url:
                    break
                time.sleep(1)
            if not img_url:
                failed.append((lid, name, 'no image found'))
                print(f'[{i+1}/{len(missing)}] {name}: NO IMAGE')
                continue
            dest = IMG_DIR / f'ta_{lid}.jpg'
            err = download(img_url, dest)
            if err:
                failed.append((lid, name, err))
                print(f'[{i+1}/{len(missing)}] {name}: DOWNLOAD FAIL {err}')
                continue
            r['coverImageUrl'] = f'/images/restaurants/ta_{lid}.jpg'
            srcs = r.get('sourceImageUrls') or []
            if src_page and src_page not in srcs:
                srcs.append(src_page)
            r['sourceImageUrls'] = srcs
            done += 1
            print(f'[{i+1}/{len(missing)}] {name}: OK <- {src_page[:60] if src_page else img_url[:60]}')
        except Exception as e:
            failed.append((lid, name, f'{type(e).__name__}: {str(e)[:80]}'))
            print(f'[{i+1}/{len(missing)}] {name}: ERROR {type(e).__name__}')
        time.sleep(1.5 + random.random())
    seed['metadata'] = {**seed.get('metadata', {}),
                        'coversRefreshedAt': __import__('datetime').datetime.now().isoformat(),
                        'coversRefresher': 'scripts/fill-restaurant-covers.py (Scrapling web search)'}
    SEED.write_text(json.dumps(seed, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'\ndone: {done} | failed: {len(failed)}')
    for lid, name, why in failed:
        print(f'  - {lid} {name}: {why}')


if __name__ == '__main__':
    main()
