import type { Airport, ObstacleInput, Part77Result, SurfaceType } from '@shared/schema';
import { getRunwaysForAirport } from './airportData';

/**
 * Part 77 Surface Penetration Analysis
 * Based on 14 CFR Part 77 - Objects Affecting Navigable Airspace
 */

interface SurfacePenetration {
  penetrates: boolean;
  surfaceType: SurfaceType;
  penetrationHeight?: number;
}

/**
 * Analyze obstacle against Part 77 surfaces for a given airport
 */
export function analyzePart77(
  obstacle: ObstacleInput,
  airport: Airport,
  distanceNM: number
): SurfacePenetration {
  const distanceFeet = distanceNM * 6076.12; // Convert NM to feet
  const obstacleHeight = obstacle.height || 0;
  const airportElevation = airport.elevation_ft || 0;
  const obstacleAGL = obstacleHeight - airportElevation; // Above Ground Level
  
  // Get runways for this airport
  const runways = getRunwaysForAirport(airport.id);
  const longestRunway = runways.reduce((max, r) => r.length > max.length ? r : max, runways[0]);
  const runwayLength = longestRunway?.length || 0;

  // Determine runway category based on length
  const isLongRunway = runwayLength >= 3200; // Utility vs larger runways
  
  // Part 77 Surface Definitions (simplified)
  
  // 1. PRIMARY SURFACE
  // Rectangle centered on runway, width varies by runway type
  const primarySurfaceWidth = isLongRunway ? 1000 : 500; // feet
  const primarySurfaceLength = runwayLength + 400; // 200 ft beyond each end
  
  // If very close to airport, check primary surface
  if (distanceFeet < primarySurfaceLength / 2) {
    return {
      penetrates: obstacleAGL > 0,
      surfaceType: "Primary Surface",
      penetrationHeight: obstacleAGL > 0 ? obstacleAGL : undefined,
    };
  }

  // 2. APPROACH SURFACE
  // Trapezoidal surface extending from runway ends
  // Inner width = primary surface width
  // Outer width and length vary by runway type
  const approachLength = isLongRunway ? 10000 : 5000; // feet from runway end
  const approachSlope = 50; // 50:1 slope
  
  if (distanceFeet < approachLength) {
    const approachSurfaceHeight = (distanceFeet - primarySurfaceLength / 2) / approachSlope;
    if (obstacleAGL > approachSurfaceHeight) {
      return {
        penetrates: true,
        surfaceType: "Approach Surface",
        penetrationHeight: obstacleAGL - approachSurfaceHeight,
      };
    }
  }

  // 3. HORIZONTAL SURFACE
  // Circular surface at fixed height above airport
  const horizontalRadius = isLongRunway ? 10000 : 5000; // feet
  const horizontalHeight = 150; // feet AGL
  
  if (distanceFeet < horizontalRadius) {
    if (obstacleAGL > horizontalHeight) {
      return {
        penetrates: true,
        surfaceType: "Horizontal Surface",
        penetrationHeight: obstacleAGL - horizontalHeight,
      };
    }
  }

  // 4. TRANSITIONAL SURFACE
  // 7:1 slope from sides of primary/approach surfaces
  const transitionalSlope = 7;
  const lateralDistance = 250; // Approximate lateral distance check
  
  if (distanceFeet < approachLength && distanceFeet > primarySurfaceLength / 2) {
    const transitionalHeight = lateralDistance / transitionalSlope;
    if (obstacleAGL > transitionalHeight && obstacleAGL < horizontalHeight) {
      return {
        penetrates: true,
        surfaceType: "Transitional Surface",
        penetrationHeight: obstacleAGL - transitionalHeight,
      };
    }
  }

  // 5. CONICAL SURFACE
  // 20:1 slope extending beyond horizontal surface
  const conicalInnerRadius = horizontalRadius;
  const conicalOuterRadius = horizontalRadius + 4000; // 4,000 ft beyond horizontal
  const conicalSlope = 20;
  
  if (distanceFeet > conicalInnerRadius && distanceFeet < conicalOuterRadius) {
    const conicalHeight = horizontalHeight + (distanceFeet - conicalInnerRadius) / conicalSlope;
    if (obstacleAGL > conicalHeight) {
      return {
        penetrates: true,
        surfaceType: "Conical Surface",
        penetrationHeight: obstacleAGL - conicalHeight,
      };
    }
  }

  // No penetration detected
  return {
    penetrates: false,
    surfaceType: "Horizontal Surface", // Default to horizontal for clear obstacles
  };
}

/**
 * Determine status based on penetration analysis
 */
export function determinePenetrationStatus(
  penetration: SurfacePenetration
): "penetration" | "warning" | "clear" {
  if (penetration.penetrates) {
    if (penetration.penetrationHeight && penetration.penetrationHeight > 25) {
      return "penetration"; // Significant penetration
    }
    return "warning"; // Minor penetration
  }
  return "clear";
}

/**
 * Create Part 77 result for an obstacle
 */
export function createPart77Result(
  obstacle: ObstacleInput,
  airport: Airport,
  distanceNM: number,
  index: number
): Part77Result {
  const penetration = analyzePart77(obstacle, airport, distanceNM);
  const status = determinePenetrationStatus(penetration);

  return {
    id: `${index + 1}`,
    obstacleId: obstacle.obstacleId,
    nearestAirport: airport.ident,
    airportName: airport.name,
    distance: distanceNM,
    obstacleHeight: obstacle.height || 0,
    surfaceType: penetration.surfaceType,
    status,
    latitude: obstacle.latitude,
    longitude: obstacle.longitude,
  };
}
