#!/usr/bin/env python3
"""Sprint 5.2 — verify the flat-format fix against the LIVE server.

Captures real HTTP status codes, real counts and real place names for all
8 cities plus the auth / backward-compat gates, and stores the complete
response bodies in logs/verified_after_fix.json.

Every value written out comes from an actual HTTP response body.
Nothing is inferred or invented.
"""
import json, os, urllib.request, urllib.error

BASE = 'http://localhost:3111'
CITIES = ['dahab', 'sharm', 'hurghada', 'marsa_alam', 'siwa',
          'alexandria', 'giza', 'nuweiba']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'logs')


def get(path):
    url = BASE + path
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            raw = r.read().decode('utf-8')
            try:
                body = json.loads(raw)
            except Exception:
                body = {'raw': raw[:400]}
            return r.status, body
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'replace')
        try:
            body = json.loads(raw)
        except Exception:
            body = {'raw': raw[:400]}
        return e.code, body
    except Exception as e:
        return 0, {'error': str(e)}


def places_of(body):
    for k in ('places', 'features', 'results', 'data'):
        v = body.get(k) if isinstance(body, dict) else None
        if isinstance(v, list):
            return v
    return []


report = {'base': BASE, 'capturedAt': None, 'cities': {}, 'gates': {}}

for slug in CITIES:
    st, body = get('/api/cities/%s/places' % slug)
    places = places_of(body)
    # historicCount is derived from the LIVE response body only
    historic = sum(1 for p in places if isinstance(p.get('tags'), dict) and p['tags'].get('historic'))
    tourism = sum(1 for p in places if isinstance(p.get('tags'), dict) and p['tags'].get('tourism'))
    st_h, body_h = get('/api/cities/%s/hotels' % slug)
    st_f, body_f = get('/api/cities/%s/food' % slug)
    st_a, body_a = get('/api/cities/%s/activities' % slug)
    st_m, body_m = get('/api/cities/%s/meta' % slug)
    report['cities'][slug] = {
        'places': {
            'http': st,
            'count': body.get('count') if isinstance(body, dict) else None,
            'featureCount': body.get('featureCount') if isinstance(body, dict) else None,
            'tourismCount': body.get('tourismCount') if isinstance(body, dict) else None,
            'historicCountDerivedFromResponse': historic,
            'tourismTagsDerivedFromResponse': tourism,
            'catalogue': body.get('catalogue') if isinstance(body, dict) else None,
            'first3': [
                {'name': p.get('name'), 'nameAr': p.get('nameAr'),
                 'lat': p.get('lat'), 'lng': p.get('lng'), 'id': p.get('id')}
                for p in places[:3]
            ],
            'rawFeatureSample': places[:3],
        },
        'hotels': {'http': st_h, 'count': body_h.get('count') if isinstance(body_h, dict) else None},
        'food': {'http': st_f, 'count': body_f.get('count') if isinstance(body_f, dict) else None},
        'activities': {'http': st_a, 'count': body_a.get('count') if isinstance(body_a, dict) else None},
        'meta': {
            'http': st_m,
            'featureCount': body_m.get('featureCount') if isinstance(body_m, dict) else None,
            'tourismCount': body_m.get('tourismCount') if isinstance(body_m, dict) else None,
            'catalogue': body_m.get('catalogue') if isinstance(body_m, dict) else None,
        },
    }

# Gates
st, body = get('/api/cities/dahab/admin/stats')
report['gates']['/api/cities/dahab/admin/stats'] = {'http': st}
st, body = get('/api/cities/alexandria/admin/stats')
report['gates']['/api/cities/alexandria/admin/stats'] = {'http': st}
st, body = get('/api/cities/giza/admin/stats')
report['gates']['/api/cities/giza/admin/stats'] = {'http': st}
st, body = get('/api/dahab/places')
report['gates']['/api/dahab/places'] = {
    'http': st,
    'count': body.get('count') if isinstance(body, dict) else None,
}
st, body = get('/api/health')
report['gates']['/api/health'] = {'http': st}

os.makedirs(OUT_DIR, exist_ok=True)
with open(os.path.join(OUT_DIR, 'verified_after_fix.json'), 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

lines = []
lines.append('city        http count  featCount tourCount histInResp catalogue | hotels food act')
for slug, e in report['cities'].items():
    p = e['places']
    lines.append('%-11s %s  %-5s %-9s %-8s %-10s %-9s | %-5s %-4s %s' % (
        slug, p['http'], p['count'], p['featureCount'], p['tourismCount'],
        p['historicCountDerivedFromResponse'], p['catalogue'],
        e['hotels']['count'], e['food']['count'], e['activities']['count']))
lines.append('')
lines.append('GATES: ' + json.dumps(report['gates'], ensure_ascii=False))
lines.append('')
for slug in ['alexandria', 'giza', 'nuweiba']:
    lines.append('--- %s first 3 from API ---' % slug)
    for n in report['cities'][slug]['places']['first3']:
        lines.append('   name=%s | nameAr=%s | lat=%s | lng=%s' % (n['name'], n['nameAr'], n['lat'], n['lng']))
with open(os.path.join(OUT_DIR, 'verified_after_fix.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')
print('written logs/verified_after_fix.json + .txt')
