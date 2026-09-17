// ===== CONFIG: Hotel's actual coordinates =====
export const HOTEL_LAT = 28.64574210;
export const HOTEL_LNG = 77.21535140;
export const ALLOWED_RADIUS_METERS = 80;

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
}

// ===== Robust location fetch (fixes the "random error on refresh" issue) =====
export function verifyStaffLocation(): Promise<StaffLocationSuccess> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject("Geolocation not supported on this device");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        const distance = getDistanceMeters(
          latitude,
          longitude,
          HOTEL_LAT,
          HOTEL_LNG
        );

        // IMPORTANT: GPS accuracy ko buffer ke tor pe add karo
        // Agar phone ki GPS accuracy hi 50m hai, to usko galti se fail mat karo
        const effectiveDistance = Math.max(0, distance - accuracy);

        console.log(`Raw distance: ${distance.toFixed(1)}m, GPS accuracy: ±${accuracy.toFixed(1)}m`);

        if (accuracy > 100) {
          // GPS signal weak hai, staff ko bolo dobara try kare
          reject(`Location signal weak (accuracy ±${accuracy.toFixed(0)}m). Please move to open area or enable GPS and retry.`);
          return;
        }

        if (effectiveDistance <= ALLOWED_RADIUS_METERS) {
          resolve({
            allowed: true,
            distance: distance.toFixed(0),
            latitude,
            longitude,
            accuracy,
          });
        } else {
          reject(`Access Denied: You are ${distance.toFixed(0)}m away from hotel premises.`);
        }
      },
      (error) => {
        let msg = `Location error: ${error.message}`;
        if (error.code === 1) { // PERMISSION_DENIED
          msg = 'Location Permission Denied: Please allow location access in your browser settings so we can verify you are within 80m of hotel premises.';
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          msg = 'Device GPS is OFF: Please turn ON GPS / Location in your device settings to verify you are on hotel premises.';
        } else if (error.code === 3) { // TIMEOUT
          msg = 'GPS Signal Timeout: Could not detect your location. Please ensure device GPS is turned ON and retry.';
        }
        reject(msg);
      },
      {
        enableHighAccuracy: true,  // ⚠️ ye critical hai — false hone par WiFi-based location use hoti hai jo 1-2km tak off ho sakti hai
        timeout: 15000,
        maximumAge: 0              // ⚠️ cached location kabhi use mat karo
      }
    );
  });
}
