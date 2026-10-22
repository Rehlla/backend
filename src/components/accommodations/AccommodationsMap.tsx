import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './accommodationsMap.css';
import { clusterPoints } from '../../lib/mapClustering';
import type { AccommodationEntity } from '../../shared/types/commerce';

const DAHAB_CENTER: [number, number] = [28.4991, 34.5158];
const SELECTED_CLASS = 'accommodations-price-pin--selected';

const HOTEL_IMAGES: Record<string, string> = {
  'jaz-dahabeya': '/images/hotels/le-meridien.jpg',
  'safir-dahab-resort': '/images/hotels/le-meridien-2.jpg',
  'the-bridge-dahab-hotel': '/images/hotels/el-primo.jpg',
  'brother-hotel-dahab': '/images/hotels/ganet-sinai.jpg',
  'dahab-paradise-hotel': '/images/hotels/dahab-paradise.jpg',
  'sheikh-ali-dahab-resort': '/images/hotels/bedouin-moon.jpg',
  'tree-house-hotel-dahab': '/images/hotels/daniela-village.jpg',
  'tropitel-dahab-oasis': '/images/hotels/tropitel-dahab-oasis.jpg',
  'dahab-lagoon-club-resort': '/images/hotels/ibis-styles-lagoon.jpg',
  'swiss-inn-resort-dahab': '/images/hotels/swiss-inn-resort.jpg',
  'penguin-village-dahab': '/images/hotels/ghazala-hotel.jpg',
  'carmine-hotel-dahab': '/images/hotels/red-rock.jpg',
  'golden-europe-hotel': '/images/hotels/sindbad-camp.jpg',
};
const FALLBACK_IMAGE = '/images/hotels/swiss-inn-resort.jpg';

/** Escapes text dropped into a Leaflet popup's innerHTML — the values are
 *  our own API data, not user input, but this is cheap insurance against a
 *  stray "<"/"&" in editorial copy breaking the markup. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A rounded "EGP 2,400" price pill — the map-marker convention travelers
 *  already know from Airbnb/Booking/Google Hotels, and a much larger, easier
 *  click target than a generic pin. */
function priceIcon(priceEGP: number, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: `accommodations-price-pin${selected ? ` ${SELECTED_CLASS}` : ''}`,
    html: `<div class="accommodations-price-pin__label">${priceEGP.toLocaleString()}</div>`,
    iconSize: [1, 1] // real size comes from the CSS on the inner label, which auto-sizes to content
  });
}

function clusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: 'accommodations-cluster-icon',
    html: `<div class="accommodations-cluster-icon__badge">${count}</div>`,
    iconSize: [34, 34]
  });
}

function popupHtml(a: AccommodationEntity, isAr: boolean): string {
  const image = a.coverImageUrl || HOTEL_IMAGES[a.slug] || FALLBACK_IMAGE;
  const name = isAr ? a.nameAr : a.name;
  const area = isAr ? a.areaNameAr : a.areaName;
  const cta = isAr ? 'عرض الإقامة' : 'View stay';
  return `
    <div class="accommodations-popup" dir="${isAr ? 'rtl' : 'ltr'}">
      <img src="${esc(image)}" alt="${esc(name)}" class="accommodations-popup__image" />
      <div class="accommodations-popup__body">
        <div class="accommodations-popup__title">${esc(name)}</div>
        <div class="accommodations-popup__meta">
          <span>★ ${a.rating.toFixed(1)} (${a.reviewCount})</span>
          <span>${esc(area)}</span>
        </div>
        <div class="accommodations-popup__price">${a.perNightEGP.toLocaleString()} EGP <span>/ ${isAr ? 'الليلة' : 'night'}</span></div>
        <button type="button" class="accommodations-popup__cta" data-slug="${esc(a.slug)}">${cta}</button>
      </div>
    </div>
  `;
}

interface AccommodationsMapProps {
  accommodations: AccommodationEntity[];
  isDark: boolean;
  isAr?: boolean;
  onSelect: (slug: string) => void;
  className?: string;
}

/**
 * Imperative Leaflet map — deliberately not react-leaflet (React 19
 * compatibility for that wrapper is unverified) and not a marker-clustering
 * library (see mapClustering.ts). The full filtered list is passed in once;
 * panning/zooming only re-buckets the already-fetched array in memory, never
 * triggers a network request — Dahab's whole accommodation inventory is
 * small enough that this is simpler and cheaper than viewport queries.
 *
 * Markers are price pills (the Airbnb/Booking/Google-Hotels convention),
 * not generic pins: clicking one opens a rich preview popup (photo, rating,
 * area, price, a "View stay" button) rather than navigating immediately —
 * a traveler scanning the map gets a preview before committing to a page
 * load, and the larger pill is a much easier target than a thin pin.
 */
export const AccommodationsMap: React.FC<AccommodationsMapProps> = ({ accommodations, isDark, isAr = false, onSelect, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedMarkerRef = useRef<L.Marker | null>(null);

  // Map instance lifecycle — created once, destroyed on unmount.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DAHAB_CENTER,
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true
    });

    const token = import.meta.env.VITE_LOCATIONIQ_MAPS_TOKEN as string | undefined;
    const theme = isDark ? 'dark' : 'streets';
    if (token) {
      L.tileLayer(`https://{s}-tiles.locationiq.com/v3/${theme}/r/{z}/{x}/{y}.png?key=${token}`, {
        attribution: '&copy; <a href="https://locationiq.com">LocationIQ</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abc',
        maxZoom: 19
      }).addTo(map);
    } else {
      // CartoDB Voyager / Dark Matter tiles — modern, reliable, and unblocked
      const cartoTheme = isDark ? 'dark_all' : 'rastertiles/voyager';
      L.tileLayer(`https://{s}.basemaps.cartocdn.com/${cartoTheme}/{z}/{x}/{y}{r}.png`, {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);
    }

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // One delegated listener handles every popup's "View stay" button,
    // instead of re-binding per marker on every redraw.
    const onPopupClick = (e: Event) => {
      const target = (e.target as HTMLElement)?.closest('[data-slug]') as HTMLElement | null;
      if (target?.dataset.slug) onSelectRef.current(target.dataset.slug);
    };
    containerRef.current.addEventListener('click', onPopupClick);

    return () => {
      containerRef.current?.removeEventListener('click', onPopupClick);
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers/clusters whenever the filtered list or zoom changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    const redraw = () => {
      layer.clearLayers();
      selectedMarkerRef.current = null;
      const points = accommodations
        .filter(a => Number.isFinite(a.latitude) && Number.isFinite(a.longitude))
        .map(a => ({ id: a.id, lat: a.latitude as number, lng: a.longitude as number, accommodation: a }));

      const clusters = clusterPoints(points, map.getZoom());
      for (const cluster of clusters) {
        if (cluster.points.length === 1) {
          const a = cluster.points[0].accommodation;
          const marker = L.marker([cluster.lat, cluster.lng], { icon: priceIcon(a.perNightEGP, false), riseOnHover: true });
          marker.bindPopup(popupHtml(a, isAr), { closeButton: true, className: `accommodations-popup-wrap${isDark ? ' accommodations-popup-wrap--dark' : ''}`, maxWidth: 240 });
          marker.on('popupopen', () => {
            if (selectedMarkerRef.current && selectedMarkerRef.current !== marker) {
              const prevIcon = selectedMarkerRef.current.getElement();
              prevIcon?.classList.remove(SELECTED_CLASS);
            }
            marker.getElement()?.classList.add(SELECTED_CLASS);
            selectedMarkerRef.current = marker;
          });
          marker.on('popupclose', () => {
            marker.getElement()?.classList.remove(SELECTED_CLASS);
          });
          marker.addTo(layer);
        } else {
          const marker = L.marker([cluster.lat, cluster.lng], { icon: clusterIcon(cluster.points.length) });
          marker.on('click', () => {
            map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 18));
          });
          marker.addTo(layer);
        }
      }
    };

    redraw();
    map.on('zoomend', redraw);
    return () => { map.off('zoomend', redraw); };
  }, [accommodations, isAr, isDark]);

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={className || 'w-full h-full rounded-2xl overflow-hidden accommodations-map'}
      style={{ minHeight: 320 }}
    />
  );
};
