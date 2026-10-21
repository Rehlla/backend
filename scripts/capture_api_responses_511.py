#!/usr/bin/env python3
"""Sprint 5.1 — capture REAL API responses for the multi-city surface.

Hits the running server (PORT 3111) and writes the observed status codes,
counts and first place names to logs/api_responses_sprint5_1.json.
No values are invented: every number below comes from the live response body.
"""
import json, os, urllib.request, urllib.error

BASE = 'http://localhost:3111'
CITIES = ['dahab', 'sharm', 'hurghada', 'marsa_alam', 'siwa',
          'alexandria', 'giza', 'nuweiba']
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')


def get(path):
    url = BASE + path
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.status, json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'raw': body[:200]}
    except Exception as e:
        return 0, {'error': str(e)}


def arr_of(body, *keys):
    for k in keys:
        v = body.get(k) if isinstance(body, dict) else None
        if isinstance(v, list):
            return v
    return []


report = {'base': BASE, 'cities': {}}

for slug in CITIES:
    entry = {}
    st, body = get('/api/cities/%s/places' % slug)
    places = arr_of(body, 'places', 'results', 'data')
    entry['places'] = {
        'http': st,
        'count': body.get('count', len(places)) if isinstance(body, dict) else len(places),
        'returned': len(places),
        'firstName': places[0].get('name') if places else None,
        'firstLat': places[0].get('lat') if places else None,
        'firstLng': places[0].get('lng') if places else None,
        'catalogue': body.get('catalogue') if isinstance(body, dict) else None,
    }
    st, body = get('/api/cities/%s/hotels' % slug)
    entry['hotels'] = {'http': st, 'count': body.get('count') if isinstance(body, dict) else None}
    st, body = get('/api/cities/%s/food' % slug)
    entry['food'] = {'http': st, 'count': body.get('count') if isinstance(body, dict) else None}
    st, body = get('/api/cities/%s/activities' % slug)
    entry['activities'] = {'http': st, 'count': body.get('count') if isinstance(body, dict) else None}
    st, body = get('/api/cities/%s/meta' % slug)
    entry['meta'] = {
        'http': st,
        'featureCount': body.get('featureCount') if isinstance(body, dict) else None,
        'tourismCount': body.get('tourismCount') if isinstance(body, dict) else None,
        'catalogue': body.get('catalogue') if isinstance(body, dict) else None,
    }
    report['cities'][slug] = entry

# Backward-compat + auth gates
st, body = get('/api/dahab/places')
report['backcompat'] = {
    '/api/dahab/places': {'http': st, 'count': body.get('count') if isinstance(body, dict) else None},
}
st, _ = get('/api/cities/dahab/admin/stats')
report['backcompat']['/api/cities/dahab/admin/stats'] = {'http': st}
st, _ = get('/api/cities/alexandria/admin/stats')
report['backcompat']['/api/cities/alexandria/admin/stats'] = {'http': st}
st, body = get('/api/health')
report['health'] = {'http': st}

os.makedirs(OUT_DIR, exist_ok=True)
path = os.path.join(OUT_DIR, 'api_responses_sprint5_1.json')
with open(path, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

with open(os.path.join(OUT_DIR, 'api_responses_sprint5_1.txt'), 'w', encoding='utf-8') as f:
    f.write('city        places(http/count/first)                    hotels food act  meta fc/tc/cat\n')
    for slug, e in report['cities'].items():
        p = e['places']
        f.write('%-11s %s/%-6s %-34s %-5s %-4s %-4s %s/%s/%s\n' % (
            slug, p['http'], p['count'], (p['firstName'] or '-')[:32],
            e['hotels']['count'], e['food']['count'], e['activities']['count'],
            e['meta']['featureCount'], e['meta']['tourismCount'], e['meta']['catalogue']))
    f.write('\nbackcompat: %s\n' % json.dumps(report['backcompat'], ensure_ascii=False))
    f.write('health: %s\n' % report['health']['http'])
print('written', path)
