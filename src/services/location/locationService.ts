export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface DistanceAndBearing {
  distanceMeters: number;
  distanceKm: number;
  formattedDistance: string;
  bearingDegrees: number;
  cardinalDirection: string;
}

class LocationService {
  private currentPosition: GeoCoordinates | null = null;
  private watchId: number | null = null;
  private listeners: Set<(pos: GeoCoordinates) => void> = new Set();
  private lastBreadcrumbPos: GeoCoordinates | null = null;
  private lastBreadcrumbTime: number = 0;

  constructor() {
    // Default simulated location for local node A if real GPS is not yet acquired (e.g. 24.8607, 67.0011)
    this.currentPosition = {
      latitude: 24.8607,
      longitude: 67.0011,
      accuracy: 5.2,
      altitude: 12,
      timestamp: Date.now(),
    };
  }

  public getCurrentCoordinates(): GeoCoordinates {
    if (this.currentPosition) {
      return { ...this.currentPosition, timestamp: Date.now() };
    }
    return {
      latitude: 24.8607,
      longitude: 67.0011,
      accuracy: 8,
      timestamp: Date.now(),
    };
  }

  public subscribe(listener: (pos: GeoCoordinates) => void): () => void {
    this.listeners.add(listener);
    if (this.currentPosition) {
      listener(this.currentPosition);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(pos: GeoCoordinates) {
    this.currentPosition = pos;
    this.listeners.forEach((l) => {
      try {
        l(pos);
      } catch (err) {
        console.error('Location listener error:', err);
      }
    });
  }

  public async acquireFreshPosition(): Promise<GeoCoordinates> {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords: GeoCoordinates = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude || undefined,
              heading: position.coords.heading || undefined,
              speed: position.coords.speed || undefined,
              timestamp: position.timestamp,
            };
            this.notify(coords);
            resolve(coords);
          },
          (err) => {
            console.warn('Geolocation acquisition error, using fallback phone GNSS coords:', err.message);
            const fallback = this.getCurrentCoordinates();
            resolve(fallback);
          },
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          }
        );
      });
    }

    return this.getCurrentCoordinates();
  }

  public startWatching() {
    if (this.watchId !== null) return;

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const coords: GeoCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: position.timestamp,
          };
          this.notify(coords);
        },
        (err) => {
          console.warn('WatchPosition error:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
        }
      );
    }
  }

  public stopWatching() {
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Set manual coordinates (useful for testing or moving in field mock)
  public setMockPosition(latitude: number, longitude: number, accuracy = 4.5) {
    const coords: GeoCoordinates = {
      latitude,
      longitude,
      accuracy,
      timestamp: Date.now(),
    };
    this.notify(coords);
  }

  // --- Haversine Distance & Bearing ---
  public calculateDistanceAndBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): DistanceAndBearing {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    // Haversine formula
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;
    const distanceKm = distanceMeters / 1000;

    // Bearing formula
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    const bearingDegrees = ((theta * 180) / Math.PI + 360) % 360;

    // 16-point Cardinal Direction
    const cardinals = [
      'N', 'NNE', 'NE', 'ENE',
      'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW',
      'W', 'WNW', 'NW', 'NNW',
    ];
    const index = Math.round(bearingDegrees / 22.5) % 16;
    const cardinalDirection = cardinals[index];

    let formattedDistance: string;
    if (distanceMeters < 1000) {
      formattedDistance = `${Math.round(distanceMeters)} m`;
    } else {
      formattedDistance = `${distanceKm.toFixed(2)} km`;
    }

    return {
      distanceMeters,
      distanceKm,
      formattedDistance,
      bearingDegrees,
      cardinalDirection,
    };
  }

  // Check if position qualifies as an emergency breadcrumb waypoint based on distance threshold or time
  public checkBreadcrumbTrigger(
    currentPos: GeoCoordinates,
    thresholdMeters = 25,
    intervalSec = 30
  ): { shouldRecord: boolean; distance: number } {
    const now = Date.now();
    if (!this.lastBreadcrumbPos) {
      this.lastBreadcrumbPos = currentPos;
      this.lastBreadcrumbTime = now;
      return { shouldRecord: true, distance: 0 };
    }

    const { distanceMeters } = this.calculateDistanceAndBearing(
      this.lastBreadcrumbPos.latitude,
      this.lastBreadcrumbPos.longitude,
      currentPos.latitude,
      currentPos.longitude
    );

    const elapsedSeconds = (now - this.lastBreadcrumbTime) / 1000;

    if (distanceMeters >= thresholdMeters || elapsedSeconds >= intervalSec) {
      this.lastBreadcrumbPos = currentPos;
      this.lastBreadcrumbTime = now;
      return { shouldRecord: true, distance: distanceMeters };
    }

    return { shouldRecord: false, distance: distanceMeters };
  }
}

export const locationService = new LocationService();
