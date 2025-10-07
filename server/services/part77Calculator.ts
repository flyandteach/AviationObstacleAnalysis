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
  
  // Height is already AGL (Above Ground Level) from FAA data
  const obstacleAGL = obstacle.height || 0;
  const airportElevation = airport.elevation_ft || 0;
  
  // Get runways for this airport
  const runways = getRunwaysForAirport(airport.id);
  
  // If no runways, can't perform analysis
  if (!runways || runways.length === 0) {
    return {
      penetrates: false,
      surfaceType: "Horizontal Surface",
    };
  }
  
  const longestRunway = runways.reduce((max, r) => r.length > max.length ? r : max, runways[0]);
  const runwayLength = longestRunway?.length || 0;

  // Determine runway category based on Part 77.17
  // Utility runway: < 3200 ft
  // Other than utility: >= 3200 ft
  // Large aircraft (> 12,500 lbs): additional considerations
  const isUtilityRunway = runwayLength < 3200;
  
  // Part 77 Surface Definitions per 14 CFR Part 77.17-77.29
  
  // 1. PRIMARY SURFACE (Part 77.25)
  // Rectangle centered on runway, width varies by runway type
  const primarySurfaceWidth = isUtilityRunway ? 250 : 500; // feet (each side of centerline)
  const primarySurfaceLength = runwayLength + 200; // 200 ft beyond each end
  
  // 2. APPROACH SURFACE (Part 77.25)
  // Trapezoidal surface extending from runway ends
  // Slopes vary by runway type per Part 77.25(a)
  let approachSlope: number;
  let approachLength: number;
  
  if (isUtilityRunway) {
    // Utility runways: 20:1 slope, 5,000 ft length
    approachSlope = 20;
    approachLength = 5000;
  } else {
    // Other than utility: varies by approach type
    // Visual runway: 20:1, non-precision: 34:1, precision: 50:1
    // Using 34:1 as conservative default
    approachSlope = 34;
    approachLength = 10000;
  }
  
  // Check approach surface
  if (distanceFeet < approachLength + primarySurfaceLength / 2) {
    const distanceFromRunwayEnd = distanceFeet - primarySurfaceLength / 2;
    if (distanceFromRunwayEnd > 0) {
      const approachSurfaceHeight = distanceFromRunwayEnd / approachSlope;
      if (obstacleAGL > approachSurfaceHeight) {
        return {
          penetrates: true,
          surfaceType: "Approach Surface",
          penetrationHeight: obstacleAGL - approachSurfaceHeight,
        };
      }
    } else {
      // Within primary surface - obstacle penetrates if above runway elevation
      // Primary surface is at runway elevation (assume airport elevation for simplicity)
      if (obstacleAGL > 0) {
        return {
          penetrates: true,
          surfaceType: "Primary Surface",
          penetrationHeight: obstacleAGL,
        };
      }
    }
  }

  // 3. TRANSITIONAL SURFACE (Part 77.25)
  // 7:1 slope from sides of primary and approach surfaces
  const transitionalSlope = 7;
  const maxTransitionalHeight = 150; // Limited by horizontal surface
  
  if (distanceFeet < approachLength) {
    // Simplified: assume lateral offset equals distance from runway
    const transitionalHeight = Math.min(distanceFeet / transitionalSlope, maxTransitionalHeight);
    if (obstacleAGL > transitionalHeight) {
      return {
        penetrates: true,
        surfaceType: "Transitional Surface",
        penetrationHeight: obstacleAGL - transitionalHeight,
      };
    }
  }

  // 4. HORIZONTAL SURFACE (Part 77.25)
  // Circular surface at 150 ft above airport elevation
  const horizontalRadius = isUtilityRunway ? 5000 : 10000; // feet
  const horizontalHeight = 150; // feet above airport elevation
  
  if (distanceFeet < horizontalRadius) {
    if (obstacleAGL > horizontalHeight) {
      return {
        penetrates: true,
        surfaceType: "Horizontal Surface",
        penetrationHeight: obstacleAGL - horizontalHeight,
      };
    }
  }

  // 5. CONICAL SURFACE (Part 77.25)
  // 20:1 slope extending beyond horizontal surface
  const conicalInnerRadius = horizontalRadius;
  const conicalOuterRadius = horizontalRadius + 4000; // 4,000 ft beyond horizontal
  const conicalSlope = 20;
  
  if (distanceFeet >= conicalInnerRadius && distanceFeet < conicalOuterRadius) {
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
    surfaceType: "Horizontal Surface",
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
