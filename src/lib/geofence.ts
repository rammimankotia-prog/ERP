// ===== CONFIG: Godwin Hotels actual coordinates =====
export const HOTEL_LAT = 28.64574210;
export const HOTEL_LNG = 77.21535140;
export const ALLOWED_RADIUS_METERS = 80;

export const HOTEL_CAMPUS_LOCATIONS = [
  { name: 'Hotel Grand Godwin', lat: 28.64574210, lng: 77.21535140, radiusMeters: 80 },
  { name: 'Hotel Godwin Deluxe', lat: 28.6445, lng: 77.2142, radiusMeters: 80 },
];

// Test user accounts that are allowed for remote QA / testing
export const TEST_STAFF_IDENTIFIERS = [
  'test-001',
  'test.staff',
  'test.staff@godwinhotels.com',
  'demo@godwinhotels.com',
  'samrat',
  'samratsamratsingh25@gmail.com',
  'ksareen@godwinhotels.com',
  'vsareen@godwinhotels.com',
];

export function isTestStaffAccount(identifier?: string | null): boolean {
  if (!identifier) return false;
  const clean = identifier.trim().toLowerCase();
  return (
    TEST_STAFF_IDENTIFIERS.includes(clean) ||
    clean.includes('test') ||
    clean.includes('demo') ||
    clean.includes('samrat')
  );
}

// ===== Correct Haversine distance formula =====
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface StaffLocationSuccess {
  allowed: boolean;
  distance: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  nearestHotel?: string;
}

// ===== Robust location fetch supporting both properties, progressive GPS locking, and indoor tolerance =====
export function verifyStaffLocation(identifier?: string): Promise<StaffLocationSuccess> {
  return new Promise((resolve, reject) => {
    // 1. If this is a designated test user or remote tester, bypass location requirement
    if (identifier && isTestStaffAccount(identifier)) {
      console.log('🧪 Test/Admin account detected: Bypassing geofence for QA testing.');
      resolve({
        allowed: true,
        distance: '0',
        latitude: HOTEL_LAT,
        longitude: HOTEL_LNG,
        accuracy: 5,
        nearestHotel: 'Hotel Grand Godwin (Test Mode)',
      });
      return;
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject('Geolocation not supported on this device');
      return;
    }

    let settled = false;
    let watchId: number | null = null;
    let timerId: any = null;
    let bestPosition: GeolocationPosition | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch {}
        watchId = null;
      }
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const evaluatePosition = (position: GeolocationPosition, forceFinal = false) => {
      if (settled) return;
      const { latitude, longitude, accuracy } = position.coords;

      // Keep track of best reading (lowest accuracy value = highest precision)
      if (!bestPosition || accuracy < bestPosition.coords.accuracy) {
        bestPosition = position;
      }

      // Check distance to both properties in the Godwin campus
      const distances = HOTEL_CAMPUS_LOCATIONS.map((loc) => {
        const rawDist = getDistanceMeters(latitude, longitude, loc.lat, loc.lng);
        // Indoor tolerance: buffer up to 250m for hotel corridors/reception
        const effectiveDist = Math.max(0, rawDist - Math.min(accuracy || 0, 250));
        return {
          name: loc.name,
          rawDistance: rawDist,
          effectiveDistance: effectiveDist,
          radius: loc.radiusMeters || ALLOWED_RADIUS_METERS,
        };
      });

      // Pick closest property
      const closest = distances.reduce((prev, curr) =>
        curr.effectiveDistance < prev.effectiveDistance ? curr : prev
      );

      console.log(`📍 GPS Sample:`, {
        latitude,
        longitude,
        accuracy: `±${accuracy?.toFixed(1)}m`,
        closestHotel: closest.name,
        rawDistance: `${closest.rawDistance.toFixed(1)}m`,
        effectiveDistance: `${closest.effectiveDistance.toFixed(1)}m`,
        forceFinal,
      });

      // Early success: within hotel radius with indoor tolerance (accuracy <= 350m)
      if (closest.effectiveDistance <= closest.radius && accuracy <= 350) {
        settled = true;
        cleanup();
        resolve({
          allowed: true,
          distance: closest.rawDistance.toFixed(0),
          latitude,
          longitude,
          accuracy,
          nearestHotel: closest.name,
        });
        return;
      }

      // If not forced final and accuracy is still coarse (> 100m), allow watchPosition another sample to lock GPS
      if (!forceFinal && accuracy > 100) {
        return;
      }

      // Final evaluation
      if (forceFinal) {
        settled = true;
        cleanup();

        // Android Approximate location detected (typically ~2000m)
        if (accuracy >= 1000) {
          reject(
            `Precise GPS is OFF (accuracy ±${accuracy.toFixed(0)}m). In Android Chrome, tap the 🎛️ icon next to the address bar -> Permissions -> Turn ON "Use precise location".`
          );
          return;
        }

        // Weak signal (> 350m)
        if (accuracy > 350) {
          const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
          if (!isMobile) {
            reject(
              `Location signal weak (accuracy ±${accuracy.toFixed(0)}m). Desktop PCs use Wi-Fi/IP location (${closest.rawDistance.toFixed(0)}m away). For live punches, please use your mobile phone with GPS turned ON, or log in with test credentials.`
            );
          } else {
            reject(
              `Location signal weak (accuracy ±${accuracy.toFixed(0)}m). Please move closer to a window or enable high-accuracy GPS and retry.`
            );
          }
          return;
        }

        if (closest.effectiveDistance <= closest.radius) {
          resolve({
            allowed: true,
            distance: closest.rawDistance.toFixed(0),
            latitude,
            longitude,
            accuracy,
            nearestHotel: closest.name,
          });
        } else {
          reject(
            `Access Denied: You are ${closest.rawDistance.toFixed(0)}m away from ${closest.name}. (Accuracy ±${accuracy.toFixed(0)}m, must be within ${closest.radius}m)`
          );
        }
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      if (settled) return;
      settled = true;
      cleanup();
      let msg = `Location error: ${error.message}`;
      if (error.code === 1) {
        msg =
          'Location Permission Denied: Please allow location access in your browser settings so we can verify you are within hotel premises.';
      } else if (error.code === 2) {
        msg =
          'Device GPS is OFF: Please turn ON GPS / Location in your device settings to verify you are on hotel premises.';
      } else if (error.code === 3) {
        msg =
          'GPS Signal Timeout: Could not detect your location. Please ensure device GPS is turned ON and retry.';
      }
      reject(msg);
    };

    // Use watchPosition for up to 5.5 seconds to acquire high-accuracy satellite fix
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => evaluatePosition(pos, false),
        (err) => handleError(err),
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        }
      );

      timerId = setTimeout(() => {
        if (!settled) {
          if (bestPosition) {
            evaluatePosition(bestPosition, true);
          } else {
            settled = true;
            cleanup();
            reject('GPS Signal Timeout: Unable to acquire GPS lock. Please turn ON GPS / Location and retry.');
          }
        }
      }, 5500);
    } catch {
      navigator.geolocation.getCurrentPosition(
        (pos) => evaluatePosition(pos, true),
        (err) => handleError(err),
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        }
      );
    }
  });
}
