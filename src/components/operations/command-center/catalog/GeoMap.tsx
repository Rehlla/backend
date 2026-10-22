import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cartoTileUrl, CARTO_SUBDOMAINS, CARTO_ATTRIBUTION } from '../../../../lib/mapTiles';

/**
 * A small pick-a-point map for the form engine's `geo` field. Loaded lazily
 * (Leaflet stays out of the entry chunk); a click moves the pin and reports
 * the new coordinates. Imperative Leaflet, as the other maps in the app.
 */

const DAHAB_CENTER: [number, number] = [28.513, 34.522];

const PIN = L.divIcon({
  className: 'catalog-geo-pin',
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#0E7C7A;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function GeoMap({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const start: [number, number] = typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : DAHAB_CENTER;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(start, 14);
    L.tileLayer(cartoTileUrl('streets'), { subdomains: CARTO_SUBDOMAINS, attribution: CARTO_ATTRIBUTION, maxZoom: 19 }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      const la = Math.round(e.latlng.lat * 1e6) / 1e6;
      const ln = Math.round(e.latlng.lng * 1e6) / 1e6;
      pick.current(la, ln);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (marker.current) marker.current.setLatLng([lat, lng]);
    else marker.current = L.marker([lat, lng], { icon: PIN }).addTo(m);
  }, [lat, lng]);

  return <div ref={el} className="h-48 w-full rounded-xl overflow-hidden border border-[var(--border-subtle)]" />;
}
