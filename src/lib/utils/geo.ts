/**
 * Haversine formula to calculate distance between two points on Earth.
 * Returns distance in miles.
 */
export function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Estimates driving time in minutes based on straight-line distance.
 * Rough approximation: assumes 30 mph average in urban areas.
 */
export function estimateEtaMinutes(distMiles: number): number {
  return Math.round((distMiles / 30) * 60);
}
