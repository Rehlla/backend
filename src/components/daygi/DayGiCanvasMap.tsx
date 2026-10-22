import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DayGiCanvasItem } from '../../shared/types/daygi';
import { cartoTileUrl, CARTO_SUBDOMAINS, CARTO_ATTRIBUTION } from '../../lib/mapTiles';

/**
 * The plan canvas's map: numbered pins for the items that resolved to a known
 * Dahab spot, mirroring TripAdvisor's canvas (results beside the chat, map
 * beside the results). Imperative Leaflet — deliberately not react-leaflet,
 * the same call the accommodations map already made for React 19.
 *
 * Only items with a resolved `spot` reach this component; the panel renders
 * it conditionally, so a plan of unplaced items simply shows no map.
 */

const DAHAB_CENTER: [number, number] = [28.5130, 34.5220];

function numberIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: 'daygi-canvas-map-pin',
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:#0f766e;color:#fff;font:700 12px/24px system-ui,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.35);">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

/** Escapes text interpolated into Leaflet popup innerHTML — the values are our
 *  own API data, not user input, but this is cheap insurance against a stray
 *  "<" or "&" in a title breaking the markup. Entities are assembled by
 *  concatenation so no tooling along the way can unescape them. */
function esc(s: string): string {
  return s
    .split('&').join('&' + 'amp;')
    .split('<').join('&' + 'lt;')
    .split('>').join('&' + 'gt;')
    .split('"').join('&' + 'quot;');
}

function popupHtml(item: DayGiCanvasItem, index: number, priceLabel: string): string {
  const blurb = item.blurb ? `<div style="margin-top:4px;font-size:11px;color:#475569;">${esc(item.blurb)}</div>` : '';
  const price = typeof item.priceEGP === 'number' && item.priceEGP > 0
    ? `<div style="margin-top:6px;font-size:12px;font-weight:700;color:#0f172a;">${esc(priceLabel)}</div>`
    : '';
  return `
    <div style="min-width:180px;max-width:240px;" data-item-id="${esc(item.id)}">
      <div style="font-size:13px;font-weight:700;color:#0f172a;">${index + 1}. ${esc(item.name)}</div>
      ${blurb}${price}
    </div>
  `;
}

export interface DayGiCanvasMapProps {
  items: DayGiCanvasItem[];
  priceLabelFor: (item: DayGiCanvasItem) => string;
  onAskAboutItem?: (item: DayGiCanvasItem) => void;
  /** Container height in px. Defaults to the inline-card height. */
  height?: number;
}

export const DayGiCanvasMap: React.FC<DayGiCanvasMapProps> = ({ items, priceLabelFor, onAskAboutItem, height = 220 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const propsRef = useRef({ items, priceLabelFor, onAskAboutItem });
  propsRef.current = { items, priceLabelFor, onAskAboutItem };

  // Map instance lifecycle — created once, destroyed on unmount.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DAHAB_CENTER,
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: false
    });

    // CARTO Voyager with the dashboard key from VITE_CARTO_MAPS_API_KEY —
    // the same keyless-tiles fallback the accommodations map uses when no
    // LocationIQ token is configured.
    L.tileLayer(cartoTileUrl('streets'), {
      attribution: CARTO_ATTRIBUTION,
      subdomains: CARTO_SUBDOMAINS,
      maxZoom: 19
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // One delegated listener for every popup's "ask about this" affordance.
    const onPopupClick = (e: Event) => {
      const target = (e.target as HTMLElement)?.closest('[data-item-id]') as HTMLElement | null;
      const itemId = target?.dataset.itemId;
      if (!itemId) return;
      const item = propsRef.current.items.find(candidate => candidate.id === itemId);
      if (item) propsRef.current.onAskAboutItem?.(item);
    };
    containerRef.current.addEventListener('click', onPopupClick);

    return () => {
      containerRef.current?.removeEventListener('click', onPopupClick);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw pins whenever the visible plan changes (day-tab filtering).
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const placed = items.filter(item => item.spot && Number.isFinite(item.spot.lat) && Number.isFinite(item.spot.lng));
    for (const [index, item] of placed.entries()) {
      const marker = L.marker([item.spot!.lat, item.spot!.lng], {
        icon: numberIcon(index),
        title: item.name,
        riseOnHover: true
      });
      marker.bindPopup(popupHtml(item, index, propsRef.current.priceLabelFor(item)), { maxWidth: 240 });
      marker.addTo(layer);
    }

    if (placed.length > 0) {
      const bounds = L.latLngBounds(placed.map(item => [item.spot!.lat, item.spot!.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    }
  }, [items]);

  return (
    <div
      ref={containerRef}
      dir="ltr"
      data-testid="daygi-canvas-map"
      className="w-full rounded-xl overflow-hidden border border-[var(--dg-line)]"
      style={{ height }}
    />
  );
};
