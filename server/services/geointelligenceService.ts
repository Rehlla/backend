import { AreaProfileEntity, PlaceEntity } from '../db/schema';
import { db } from '../db/database';

export interface RouteEstimate {
  fromZone: string;
  toZone: string;
  distanceKm: number;
  durationMinutes: number;
  transitMode: 'WALK' | 'SHORE' | 'VEHICLE' | '4X4' | 'BOAT' | 'CAMEL' | 'HIKE';
  transitModeAr: string;
  isWalkable: boolean;
  notes?: string;
}

export class GeointelligenceService {
  // Dahab & South Sinai Geographical Bounding Box
  private readonly SINAI_BOUNDS = {
    minLat: 27.50,
    maxLat: 29.50,
    minLng: 33.50,
    maxLng: 35.50
  };

  /**
   * Validate coordinates to detect anomalies
   */
  public validateCoordinates(lat: number, lng: number): {
    isValid: boolean;
    anomalyType?: 'OUT_OF_BOUNDS' | 'ZERO_COORDINATES' | 'SUSPICIOUS_CLUSTERING' | 'SEA_INVERSION';
    error?: string;
  } {
    if (lat === 0 && lng === 0) {
      return { isValid: false, anomalyType: 'ZERO_COORDINATES', error: 'Null island coordinates (0, 0)' };
    }

    if (
      lat < this.SINAI_BOUNDS.minLat ||
      lat > this.SINAI_BOUNDS.maxLat ||
      lng < this.SINAI_BOUNDS.minLng ||
      lng > this.SINAI_BOUNDS.maxLng
    ) {
      return {
        isValid: false,
        anomalyType: 'OUT_OF_BOUNDS',
        error: `Coordinates (${lat}, ${lng}) fall outside the South Sinai destination bounding box.`
      };
    }

    return { isValid: true };
  }

  /**
   * Geodesic Distance in meters between coordinates
   */
  public getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Determine containing area by proximity / radius
   */
  public getContainingArea(lat: number, lng: number): AreaProfileEntity | undefined {
    let bestArea: AreaProfileEntity | undefined;
    let minDistance = Infinity;

    for (const area of db.areaProfiles) {
      const dist = this.getDistanceMeters(lat, lng, area.coordinates.lat, area.coordinates.lng);
      if (dist <= area.radiusMeters && dist < minDistance) {
        minDistance = dist;
        bestArea = area;
      }
    }

    return bestArea;
  }

  /**
   * Calculate route travel estimate between two Dahab areas
   */
  public calculateRouteEstimate(fromZoneId: string, toZoneId: string): RouteEstimate {
    const from = fromZoneId.toLowerCase();
    const to = toZoneId.toLowerCase();

    if (from === to) {
      return {
        fromZone: from,
        toZone: to,
        distanceKm: 0.3,
        durationMinutes: 5,
        transitMode: 'WALK',
        transitModeAr: 'مشي على الأقدام',
        isWalkable: true
      };
    }

    // Known Dahab transit matrix
    const routeKey = `${from}->${to}`;
    const reverseKey = `${to}->${from}`;

    const SPECIAL_ROUTES: Record<string, RouteEstimate> = {
      'lighthouse->masbat': {
        fromZone: 'lighthouse',
        toZone: 'masbat',
        distanceKm: 0.5,
        durationMinutes: 6,
        transitMode: 'WALK',
        transitModeAr: 'مشي عبر الممشى السياحي',
        isWalkable: true
      },
      'lighthouse->eel_garden': {
        fromZone: 'lighthouse',
        toZone: 'eel_garden',
        distanceKm: 0.8,
        durationMinutes: 10,
        transitMode: 'WALK',
        transitModeAr: 'مشي عبر الشاطئ',
        isWalkable: true
      },
      'lighthouse->mashraba': {
        fromZone: 'lighthouse',
        toZone: 'mashraba',
        distanceKm: 1.5,
        durationMinutes: 18,
        transitMode: 'WALK',
        transitModeAr: 'مشي أو تاكسي محلي (٥ دقائق)',
        isWalkable: true
      },
      'lighthouse->laguna': {
        fromZone: 'lighthouse',
        toZone: 'laguna',
        distanceKm: 4.2,
        durationMinutes: 12,
        transitMode: 'VEHICLE',
        transitModeAr: 'تاكسي أو بيك أب (١٢ دقيقة)',
        isWalkable: false
      },
      'lighthouse->assalah': {
        fromZone: 'lighthouse',
        toZone: 'assalah',
        distanceKm: 1.8,
        durationMinutes: 15,
        transitMode: 'WALK',
        transitModeAr: 'مشي أو تاكسي (٥ دقائق)',
        isWalkable: true
      },
      'lighthouse->canyon': {
        fromZone: 'lighthouse',
        toZone: 'canyon',
        distanceKm: 8.5,
        durationMinutes: 18,
        transitMode: 'VEHICLE',
        transitModeAr: 'سيارة جيب أو تاكسي (١٨ دقيقة)',
        isWalkable: false
      },
      'lighthouse->blue_hole': {
        fromZone: 'lighthouse',
        toZone: 'blue_hole',
        distanceKm: 11.5,
        durationMinutes: 25,
        transitMode: 'VEHICLE',
        transitModeAr: 'سيارة جيب أو تاكسي جبلي (٢٥ دقيقة)',
        isWalkable: false
      },
      'blue_hole->ras_abu_galum': {
        fromZone: 'blue_hole',
        toZone: 'ras_abu_galum',
        distanceKm: 5.5,
        durationMinutes: 20,
        transitMode: 'BOAT',
        transitModeAr: 'قارب بحري سريع (٢٠ دقيقة) أو جمال (١.٥ ساعة)',
        isWalkable: false,
        notes: 'Can also be reached via coastal camel trek or 1.5h hike'
      },
      'ras_abu_galum->blue_lagoon': {
        fromZone: 'ras_abu_galum',
        toZone: 'blue_lagoon',
        distanceKm: 7.0,
        durationMinutes: 25,
        transitMode: '4X4',
        transitModeAr: 'سيارة بدوية 4x4 عبر الشاطئ',
        isWalkable: false
      },
      'lighthouse->wadi_gnai': {
        fromZone: 'lighthouse',
        toZone: 'wadi_gnai',
        distanceKm: 14.0,
        durationMinutes: 30,
        transitMode: '4X4',
        transitModeAr: 'سيارة سفاري 4x4 (٣٠ دقيقة)',
        isWalkable: false
      }
    };

    if (SPECIAL_ROUTES[routeKey]) {
      return SPECIAL_ROUTES[routeKey];
    }

    if (SPECIAL_ROUTES[reverseKey]) {
      const rev = SPECIAL_ROUTES[reverseKey];
      return {
        ...rev,
        fromZone: from,
        toZone: to
      };
    }

    // Default calculation based on Area coordinates
    const fromArea = db.areaProfiles.find(a => a.id.toLowerCase() === from);
    const toArea = db.areaProfiles.find(a => a.id.toLowerCase() === to);

    if (fromArea && toArea) {
      const distM = this.getDistanceMeters(fromArea.coordinates.lat, fromArea.coordinates.lng, toArea.coordinates.lat, toArea.coordinates.lng);
      const distKm = distM / 1000;
      const isWalkable = distKm <= 2.0;
      const duration = isWalkable ? Math.round(distKm * 12) : Math.round(distKm * 2.5 + 5);

      return {
        fromZone: from,
        toZone: to,
        distanceKm: Number(distKm.toFixed(1)),
        durationMinutes: Math.max(5, duration),
        transitMode: isWalkable ? 'WALK' : 'VEHICLE',
        transitModeAr: isWalkable ? 'مشي' : 'سيارة / تاكسي',
        isWalkable
      };
    }

    return {
      fromZone: from,
      toZone: to,
      distanceKm: 3.0,
      durationMinutes: 15,
      transitMode: 'VEHICLE',
      transitModeAr: 'سيارة',
      isWalkable: false
    };
  }
}

export const geointelligenceService = new GeointelligenceService();
