#!/usr/bin/env python3
"""Real API responses from the running server (port 3111 preferred, fallback 3000)."""
import urllib.request, urllib.error, json, os, sys

BASES = [
    ('http://127.0.0.1:3111', '3111'),
    ('http://127.0.0.1:3000', '3000'),
]

def fetch(base, path):
    try:
        with urllib.request.urlopen(base + path, timeout=12) as resp:
            return resp.status, resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='replace')
    except Exception as e:
        return 'ERR', str(type(e).__name__)

def main():
    base, label = None, None
    for b, l in BASES:
        status, _ = fetch(b, '/api/health')
        if status == 200:
            base, label = b, l
            break
    if base is None:
        print('NOT RUNNING (both 3111 and 3000 down)')
        sys.exit(1)
    print('=== Server running on {} ==='.format(label))

    cities = ['dahab', 'alexandria', 'giza', 'nuweiba', 'sharm', 'hurghada', 'marsa_alam', 'siwa']
    results = {}
    for city in cities:
        res = {}
        # /places
        status, body = fetch(base, '/api/cities/{}/places'.format(city))
        res['places'] = {'status': status, 'count': 0, 'tourism': 0, 'historic': 0}
        if status == 200:
            try:
                data = json.loads(body)
                res['places']['status'] = 200
                res['places']['count'] = data.get('count', 0)
                res['places']['tourism'] = data.get('tourismCount', 0)
                res['places']['features'] = data.get('places', [])
                res['places']['feature_count_response'] = len(data.get('places', []))
            except Exception as e:
                res['places']['parse_error'] = type(e).__name__
        else:
            res['places']['status_str'] = str(status)

        # /hotels
        status_h, body_h = fetch(base, '/api/cities/{}/hotels'.format(city))
        res['hotels'] = {'status': status_h}
        if status_h == 200:
            try:
                res['hotels']['data'] = json.loads(body_h)
            except:
                res['hotels']['parse'] = 'ERR'

        # /food
        status_f, body_f = fetch(base, '/api/cities/{}/food'.format(city))
        res['food'] = {'status': status_f}
        if status_f == 200:
            try:
                res['food']['data'] = json.loads(body_f)
            except:
                res['food']['parse'] = 'ERR'

        # First 3 feature names (real from API response)
        first_names = []
        if res['places'].get('features'):
            for feat in res['places']['features'][:3]:
                first_names.append({
                    'id': feat.get('id'),
                    'name': feat.get('name'),
                    'nameAr': feat.get('nameAr'),
                    'tags_tourism': 'tourism' in (str(feat.get('tags', {})) if isinstance(feat.get('tags'), dict) else str(feat.get('tags', ''))),
                    'tags_historic': 'historic' in (str(feat.get('tags', {})) if isinstance(feat.get('tags'), dict) else str(feat.get('tags', ''))),
                    'tags_amenity': feat.get('tags', {}).get('amenity'),
                })
        res['first_3_names'] = first_names
        results[city] = res
        print('{}: /places status={} count={} tourism={} historic={} first3={}'.format(
            city,
            res['places']['status'],
            res['places']['count'],
            res['places']['tourism'],
            res.get('places',{}).get('tourism') or (res['places'].get('data',{}).get('tourismCount', 0) if False else 'N/A'),
            'see_first_3',
        ))

    # Admin 401 + backward-compat 200
    admin_status, admin_body = fetch(base, '/api/cities/dahab/admin/stats')
    backward_status, backward_body = fetch(base, '/api/dahab/places')
    results['admin_stats'] = {'status': admin_status}
    results['backward_compat_dahab_places'] = {'status': backward_status}
    print('admin_stats -> HTTP {}'.format(admin_status))
    print('backward_compat /api/dahab/places -> HTTP {}'.format(backward_status))

    # Save full JSON
    log_path = 'logs/api_responses_new_cities.json'
    os.makedirs(os.path.dirname(log_path) if os.path.dirname(log_path) else '.', exist_ok=True)
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump({
            'base': base,
            'label': label,
            'results': results,
            'timestamp': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        }, f, ensure_ascii=False, indent=2)
    print('Saved full responses to:', log_path)

    # Print first 3 real names
    print('=== FIRST 3 REAL FEATURE NAMES (from API) ===')
    for city in ['alexandria', 'giza', 'nuweiba']:
        print('--- {} ---'.format(city))
        for f in results.get(city, {}).get('first_3_names', []):
            print('  id={} name={!r} nameAr={!r} tags_tourism_mentioned={}'.format(
                f.get('id'), f.get('name'), f.get('nameAr'), f.get('tags_tourism')))

if __name__ == '__main__':
    main()
