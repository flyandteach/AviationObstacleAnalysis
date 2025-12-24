import type { Airport, ObstacleInput, Part77Result, SurfaceType } from '@shared/schema';
import { getRunwaysForAirport, getRunwayApproachType } from './airportData';

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
    // Other than utility: determine approach type from runway data
    // Visual runway: 20:1, non-precision: 34:1, precision: 50:1
    
    // Determine best approach type for this airport
    // Start with least restrictive (VISUAL) and escalate when more demanding types are found
    let bestApproachType = "VISUAL";
    let approachTypeFound = false;
    
    // If we have runway records, check each runway end
    if (hasRunways) {
      for (const runway of runways) {
        // Runway designators like "16/34" have two ends
        const ends = runway.designator.split('/');
        
        for (const end of ends) {
          // Pass runway data so US_LOW/US_HIGH can be used as secondary source
          const approachType = getRunwayApproachType(airport.ident, end.trim(), runway);
          
          if (approachType) {
            approachTypeFound = true;
            
            // Escalate to most demanding approach type found
            if (approachType === "PREC") {
              bestApproachType = "PREC";
              break; // Precision is most demanding, no need to check further
            } else if (approachType === "NONPREC" && bestApproachType !== "PREC") {
              bestApproachType = "NONPREC";
            }
            // If VISUAL, keep current bestApproachType (VISUAL only if no NONPREC/PREC found yet)
          }
        }
        
        if (bestApproachType === "PREC") break;
      }
    } else {
      // No runway records found - try to infer from approach type data
      // Only check a limited set of common runway ends to reduce false positives
      const commonEnds = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', 
        '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', 
        '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36'];
      
      for (const end of commonEnds) {
        const approachType = getRunwayApproachType(airport.ident, end);
        
        if (approachType) {
          approachTypeFound = true;
          
          // Escalate to most demanding approach type found
          if (approachType === "PREC") {
            bestApproachType = "PREC";
            break;
          } else if (approachType === "NONPREC" && bestApproachType !== "PREC") {
            bestApproachType = "NONPREC";
          }
        }
      }
    }
    
    // If no approach type data was found, use conservative default
    if (!approachTypeFound) {
      bestApproachType = "NONPREC"; // 34:1 as conservative middle ground
    }
    
    // Apply slope based on approach type per 14 CFR Part 77.25
    switch (bestApproachType) {
      case "PREC":
        approachSlope = 50; // Precision instrument approach
        approachLength = 10000;
        break;
      case "NONPREC":
        approachSlope = 34; // Non-precision instrument approach
        approachLength = 10000;
        break;
      case "VISUAL":
      default:
        approachSlope = 20; // Visual approach
        approachLength = 10000;
        break;
    }
  }
  
  // Check approach and transitional surfaces
  // These can be checked even if runway records aren't available via ID matching,
  // as long as we've determined an approach type
  if (hasRunways || !isUtilityRunway) {
    // Check approach surface
    if (distanceFeet < approachLength + primarySurfaceLength / 2) {
      const distanceFromRunwayEnd = distanceFeet - primarySurfaceLength / 2;
      const approachSurfaceHeight = distanceFromRunwayEnd > 0 ? distanceFromRunwayEnd / approachSlope : 0;
      
      if (distanceFromRunwayEnd > 0) {
        if (obstacleHeightRelativeToAirport > approachSurfaceHeight) {
          return {
            penetrates: true,
            surfaceType: "Approach Surface",
            penetrationHeight: obstacleHeightRelativeToAirport - approachSurfaceHeight,
          };
        }
      } else {
        // Within primary surface - obstacle penetrates if above runway elevation
        // Primary surface is at runway elevation (assume airport elevation for simplicity)
        if (obstacleHeightRelativeToAirport > 0) {
          return {
            penetrates: true,
            surfaceType: "Primary Surface",
            penetrationHeight: obstacleHeightRelativeToAirport,
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
      if (obstacleHeightRelativeToAirport > transitionalHeight) {
        return {
          penetrates: true,
          surfaceType: "Transitional Surface",
          penetrationHeight: obstacleHeightRelativeToAirport - transitionalHeight,
        };
      }
    }
  }

  // 4. HORIZONTAL SURFACE (Part 77.25)
  // Circular surface at 150 ft above airport elevation
  const horizontalRadius = isUtilityRunway ? 5000 : 10000; // feet
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

  // 6. FAA NOTIFICATION SURFACE (14 CFR Part 77.9)
  // 100:1 slope for runways > 3,200 feet, extends 50,000 feet from runway
  // This is a notification trigger, not a Part 77.25 imaginary surface
  const notificationDistance = 50000; // feet (approximately 8.2 NM)
  const notificationSlope = 100; // 100:1 horizontal to vertical
  
  // Only applies to runways longer than 3,200 feet
  if (!isUtilityRunway && distanceFeet < notificationDistance) {
    // 100:1 slope means height = distance / 100
    const notificationSurfaceHeight = distanceFeet / notificationSlope;
    
    if (obstacleHeightRelativeToAirport > notificationSurfaceHeight) {
      return {
        penetrates: true,
        surfaceType: "Notification Surface (77.9)",
        penetrationHeight: obstacleHeightRelativeToAirport - notificationSurfaceHeight,
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
