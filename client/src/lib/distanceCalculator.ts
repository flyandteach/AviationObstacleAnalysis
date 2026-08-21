import type { Airport, ObstacleInput } from "./schema";
import { getWashingtonAirports } from "./airportData";

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 * Returns distance in nautical miles
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find the nearest airport to a given obstacle
 * Returns the airport and distance in nautical miles
 */
export function findNearestAirport(
  obstacle: ObstacleInput,
): { airport: Airport; distance: number } | null {
  const airports = getWashingtonAirports();

  if (airports.length === 0) {
    return null;
  }

  let nearestAirport = airports[0];
  let minDistance = haversineDistance(
    obstacle.latitude,
    obstacle.longitude,
    airports[0].latitude_deg,
    airports[0].longitude_deg,
  );

  for (let i = 1; i < airports.length; i++) {
    const airport = airports[i];
    const distance = haversineDistance(
      obstacle.latitude,
      obstacle.longitude,
      airport.latitude_deg,
      airport.longitude_deg,
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestAirport = airport;
    }
  }

  return {
    airport: nearestAirport,
    distance: parseFloat(minDistance.toFixed(2)),
  };
}

/**
 * Find all airports within a certain radius of an obstacle
 * Returns airports sorted by distance (closest first)
 */
export function findAirportsWithinRadius(
  obstacle: ObstacleInput,
  radiusNM: number,
): Array<{ airport: Airport; distance: number }> {
  const airports = getWashingtonAirports();

  const results = airports
    .map((airport) => ({
      airport,
      distance: haversineDistance(
        obstacle.latitude,
        obstacle.longitude,
        airport.latitude_deg,
        airport.longitude_deg,
      ),
    }))
    .filter((result) => result.distance <= radiusNM)
    .sort((a, b) => a.distance - b.distance);

  return results.map((r) => ({
    ...r,
    distance: parseFloat(r.distance.toFixed(2)),
  }));
}
