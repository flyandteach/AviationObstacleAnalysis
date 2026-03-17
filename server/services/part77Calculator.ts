import type { Airport, ObstacleInput, Part77Result, SurfaceType } from '@shared/schema';
import { getRunwaysForAirport, getRunwayApproachType, getBestApproachTypeForAirport } from './airportData';

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
  
  // User clarification: MSL comparison is the correct way to determine penetrations
  // obstacleHeightRelativeToAirport = obstacleMSL - airportMSL
  const obstacleMSL = obstacle.heightMSL || 0;
  const airportElevationMSL = airport.elevation_ft || 0;
  const obstacleHeightRelativeToAirport = obstacleMSL - airportElevationMSL;
  
  
  // Get runways for this airport
  // Note: Due to ID format mismatch between airports (integer IDs) and runways (GUID IDs),
  // we may not be able to match runways by ID. However, we can still determine approach
  // types using the runway_approach_types file which uses airport identifiers.
  const runways = getRunwaysForAirport(airport.id);
  const hasRunways = runways && runways.length > 0;
  
  let runwayLength = 0;
  let isUtilityRunway = false; // Default to non-utility (more conservative)
  
  if (hasRunways) {
    const longestRunway = runways.reduce((max, r) => r.length > max.length ? r : max, runways[0]);
    runwayLength = longestRunway?.length || 0;
    // Determine runway category based on Part 77.17
    // Utility runway: < 3200 ft
    // Other than utility: >= 3200 ft
    isUtilityRunway = runwayLength < 3200;
  }
  
  // Part 77 Surface Definitions per 14 CFR Part 77.17-77.29
  
  // 1. PRIMARY SURFACE (Part 77.25)
  // Rectangle centered on runway, extends 200 ft beyond EACH runway end
  const primarySurfaceWidth = isUtilityRunway ? 250 : 500; // feet (each side of centerline)
  const primarySurfaceHalfLength = (runwayLength + 400) / 2; // 200 ft beyond each end = 400 ft total
  
  // 2. APPROACH SURFACE (Part 77.25)
  // Trapezoidal surface extending from runway ends
  // Slopes and lengths vary by runway/approach type per 14 CFR Part 77.25
  let approachType = "VISUAL";
  
  if (isUtilityRunway) {
    approachType = "UTILITY";
  } else {
    let approachTypeFound = false;
    
    if (hasRunways) {
      for (const runway of runways) {
        const ends = runway.designator.split('/');
        for (const end of ends) {
          const type = getRunwayApproachType(airport.ident, end.trim(), runway);
          if (type) {
            approachTypeFound = true;
            if (type === "PREC") { approachType = "PREC"; break; }
            if (type === "NONPREC" && approachType !== "PREC") approachType = "NONPREC";
          }
        }
        if (approachType === "PREC") break;
      }
    } else {
      // No runway records matched — scan entire approach types file for this airport
      const best = getBestApproachTypeForAirport(airport.ident);
      if (best) {
        approachTypeFound = true;
        approachType = best;
      }
    }
    
    if (!approachTypeFound) approachType = "NONPREC"; // conservative default
  }

  /**
   * Per 14 CFR §77.25(d) — Approach surface slopes and lengths:
   *   Utility (any approach type):         20:1 slope,  5,000 ft
   *   Other-than-utility, visual:          20:1 slope,  5,000 ft
   *   Other-than-utility, non-precision:   34:1 slope, 10,000 ft
   *   Other-than-utility, precision (ILS): 50:1 for first 10,000 ft
   *                                        then 40:1 for next 40,000 ft (50,000 ft total)
   * Returns null when distFromEnd exceeds the surface length (obstacle is beyond the surface).
   */
  function approachSurfaceHeightAtDistance(distFromEnd: number): number | null {
    if (distFromEnd <= 0) return 0;
    switch (approachType) {
      case "UTILITY":
        // Utility runway (any approach type): 20:1 slope, 5,000 ft length
        if (distFromEnd > 5000) return null;
        return distFromEnd / 20;
      case "VISUAL":
        // Other-than-utility visual runway: 20:1 slope, 5,000 ft length (§77.25(d))
        if (distFromEnd > 5000) return null;
        return distFromEnd / 20;
      case "NONPREC":
        // Non-precision instrument: 34:1 slope, 10,000 ft length
        if (distFromEnd > 10000) return null;
        return distFromEnd / 34;
      case "PREC": {
        // Precision instrument (ILS): two-segment slope per §77.25(d)
        // Inner 10,000 ft: 50:1; outer 40,000 ft: 40:1 (50,000 ft total)
        if (distFromEnd > 50000) return null;
        if (distFromEnd <= 10000) return distFromEnd / 50;
        return (10000 / 50) + (distFromEnd - 10000) / 40;
      }
      default:
        if (distFromEnd > 10000) return null;
        return distFromEnd / 34;
    }
  }

  // Check primary and approach surfaces
  // Note: distanceFeet is from obstacle to ARP; approach surfaces extend in runway direction.
  // Without runway heading/position data this is a conservative directional approximation.
  const distanceFromRunwayEnd = distanceFeet - primarySurfaceHalfLength;
  const approachHeight = approachSurfaceHeightAtDistance(distanceFromRunwayEnd);
  
  if (distanceFromRunwayEnd <= 0) {
    // Within primary surface — penetrates if above airport elevation
    if (obstacleHeightRelativeToAirport > 0) {
      return {
        penetrates: true,
        surfaceType: "Primary Surface",
        penetrationHeight: obstacleHeightRelativeToAirport,
      };
    }
  } else if (approachHeight !== null) {
    // Within approach surface bounds
    if (obstacleHeightRelativeToAirport > approachHeight) {
      return {
        penetrates: true,
        surfaceType: "Approach Surface",
        penetrationHeight: obstacleHeightRelativeToAirport - approachHeight,
      };
    }
  }

  // 4. HORIZONTAL SURFACE (§77.25(a))
  // 150 ft above airport elevation; radius depends on runway category per §77.25(a):
  //   5,000 ft — utility runways (< 3,200 ft) OR visual runways (no instrument approaches)
  //   10,000 ft — all other runways (non-precision or precision instrument)
  const horizontalRadius = (isUtilityRunway || approachType === "VISUAL") ? 5000 : 10000;
  const horizontalHeight = 150; // feet above airport elevation
  
  if (distanceFeet < horizontalRadius) {
    if (obstacleHeightRelativeToAirport > horizontalHeight) {
      return {
        penetrates: true,
        surfaceType: "Horizontal Surface",
        penetrationHeight: obstacleHeightRelativeToAirport - horizontalHeight,
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
    if (obstacleHeightRelativeToAirport > conicalHeight) {
      return {
        penetrates: true,
        surfaceType: "Conical Surface",
        penetrationHeight: obstacleHeightRelativeToAirport - conicalHeight,
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
    nearestAirport: airport.local_code || airport.ident,
    airportName: airport.name,
    airportLatitude: airport.latitude_deg,
    airportLongitude: airport.longitude_deg,
    distance: distanceNM,
    obstacleHeight: obstacle.heightAGL || 0,
    surfaceType: penetration.surfaceType,
    status,
    latitude: obstacle.latitude,
    longitude: obstacle.longitude,
  };
}
