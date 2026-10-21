#!/usr/bin/env python3
"""Sprint 6.1 — Sub-destinations: Ras Mohamed (sharm parent) + Colored Canyon (nuweiba parent)."""
import json, os
SOURCE = r'D:\prototype-full\data\egypt_output\egypt_nodes_full.jsonl'
BASE  = r'D:\dahab-—-travel-platform\Travel.eg'

CONFIG = {
    'ras_mohamed': {
        'parent':'sharm', 'slug':'ras_mohamed',
        'bounds':{'latMin':27.70,'latMax':27.85,'lngMin':34.15,'lngMax':34.30},
        'tags_whitelist':['tourism','historic','natural','protect_class','leisure','amenity'],
        'allowed_tag_vals':{'tourism':['attraction','diving','snorkeling','viewpoint','park',
                                        'wilderness_camp','picnic_site','aquarium','museum',
                                        'gallery','zoo','theme_park','artwork','hotel','hostel',
                                        'guest_house','camp_site','beach_resort'],
                             'historic':['ruins','archaeological_site','monastery','memorial','tomb'],
                             'natural':['reef','bay','cape','park','beach','waterfall','spring',
                                        'cave_entrance','volcano','rock','hill','saddle','crater'],
                             'leisure':['nature_reserve','park','garden','picnic_table'],
                             'amenity':['place_of_worship','shrine','grave_yard'],
                             'protect_class':['1','2','3','4','5','6','a','b','c','d','e','f']},
    },
    'colored_canyon': {
        'parent':'nuweiba', 'slug':'colored_canyon',
        'bounds':{'latMin':29.10,'latMax':29.20,'lngMin':34.55,'lngMax':34.70},
        'tags_whitelist':['tourism','natural','historic','leisure','amenity'],
        'allowed_tag_vals':{'tourism':['attraction','viewpoint','picnic_site','wilderness_camp',
                                        'camp_site','hotel','hostel','guest_house','museum',
                                        'gallery','artwork','zoo','beach_resort','park'],
                             'historic':['ruins','archaeological_site','monastery','memorial','tomb'],
                             'natural':['canyon','gorge','cliff','peak','mountain','hill','rock',
                                        'crater','spring','waterfall','saddle','cave_entrance',
                                        'bare_rock','valley','desert','beach','bay'],
                             'leisure':['nature_reserve','park','picnic_table','garden'],
                             'amenity':['place_of_worship','shrine']},
    },
}
WHITELIST_NAMES = {'Ras Mohamed','Colored Canyon','الوادي الملون','Shark Observatory','Yolanda Reef','Ain Furtaga','Wadi Watir'}

def extract(slug):
    cfg = CONFIG[slug]
    b = cfg['bounds']
    feats = []
    with open(SOURCE,'r',encoding='utf-8',errors='replace') as fh:
        for line in fh:
            line=line.strip()
            if not line or not line.startswith('{'): continue
            try: node=json.loads(line)
            except: continue
            lat=node.get('lat'); lng=node.get('lng')
            if lat is None or lng is None: continue
            if not (b['latMin']<=lat<=b['latMax'] and b['lngMin']<=lng<=b['lngMax']): continue
            tags=node.get('tags') or {}
            name=str(tags.get('name') or tags.get('name:ar') or tags.get('name:en') or '').strip()
            if not name: continue
            # whitelist filter (strong)
            has_ok = False
            for k in cfg['tags_whitelist']:
                v=tags.get(k)
                if isinstance(v,str) and v in cfg['allowed_tag_vals'].get(k,[]):
                    has_ok=True; break
            if not has_ok: continue
            # pollution exclusions
            if tags.get('addr:housenumber') or tags.get('shop') or tags.get('office'):
                continue
            flat_f = {
                'id':node.get('id'),
                'name':tags.get('name') or tags.get('name:ar') or tags.get('name:en') or name,
                'nameAr':tags.get('name:ar') or name,
                'nameEn':tags.get('name:en') or name,
                'lat':lat,'lng':lng,
                'tags':{k:v for k,v in tags.items() if v is not None and str(v)!=''},
                'parent':cfg['parent'],
            }
            feats.append(flat_f)
    out_dir=os.path.join(BASE,'data','cities','sub')
    os.makedirs(out_dir,exist_ok=True)
    out=os.path.join(out_dir,slug+'.json')
    meta={
        'slug':slug,'parent':cfg['parent'],'featureCount':len(feats),
        'tourismCount':sum(1 for f in feats if f['tags'].get('tourism')),
        'bounds':{'latMin':b['latMin'],'latMax':b['latMax'],'lngMin':b['lngMin'],'lngMax':b['lngMax']},
        'features':feats,
    }
    with open(out,'w',encoding='utf-8') as f: json.dump(meta, f, ensure_ascii=False, separators=(',',':'))
    sz=os.path.getsize(out)
    f0=feats[0] if feats else {}
    poll=sum(1 for f in feats if 'addr:housenumber' in (f.get('tags') or {}))
    print('%s -> %d B (%d features, tourism=%d, poll=%d) flat=%s lat=%s lng=%s parent=%s' % (
        slug, sz, len(feats), meta['tourismCount'], poll,
        'geometry' not in f0 and f0.get('lat') is not None,
        f0.get('lat'), f0.get('lng'), cfg['parent']))
    return sz, len(feats), meta['tourismCount'], meta['tourismCount']

if __name__=='__main__':
    for s in ['ras_mohamed','colored_canyon']:
        extract(s)
