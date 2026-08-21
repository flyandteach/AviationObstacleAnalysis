import { part77ResultSchema, type Part77Result } from "./schema";
import { findNearestAirport, findAirportsWithinRadius } from "./distanceCalculator";
import { createPart77Result } from "./part77Calculator";
import { z } from "zod";

// Parse DMS (Degrees Minutes Seconds) to decimal degrees
function dmsToDecimal(dmsString: string): number | null {
  const match = dmsString.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"\s*([NSEW])/);
  if (!match) return null;

  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4];

  let decimal = degrees + minutes / 60 + seconds / 3600;

  if (direction === "S" || direction === "W") {
    decimal = -decimal;
  }

  return decimal;
}

/**
 * Status severity rank — higher is worse.
 */
function statusRank(status: string): number {
  if (status === "penetration") return 2;
  if (status === "warning") return 1;
  return 0;
}

/**
 * Pick the most restrictive Part 77 result across multiple airports.
 * Priority: penetration > warning > clear.
 * Within the same status, higher penetration height wins.
 * Ties broken by closest airport (lowest distance).
 */
function pickWorstResult(results: Part77Result[]): Part77Result {
  return results.reduce((worst, r) => {
    const wRank = statusRank(worst.status);
    const rRank = statusRank(r.status);
    if (rRank > wRank) return r;
    if (rRank < wRank) return worst;
    const wDepth = (worst as any).penetrationHeight ?? 0;
    const rDepth = (r as any).penetrationHeight ?? 0;
    if (rDepth > wDepth) return r;
    if (rDepth < wDepth) return worst;
    return r.distance < worst.distance ? r : worst;
  });
}

/**
 * Maximum search radius (NM) to cover all Part 77 surfaces.
 *   Horizontal surface: 10,000 ft ≈ 1.65 NM
 *   Conical surface:   14,000 ft ≈ 2.30 NM
 *   Precision approach: 50,000 ft from runway end ≈ up to ~9 NM from ARP
 * Use 10 NM to ensure full coverage including long precision approach surfaces.
 */
const PART77_SEARCH_RADIUS_NM = 10;

export class ObstacleAnalysisError extends Error {}

/**
 * Analyze pasted obstacle text against FAA Part 77 surfaces for Washington
 * state airports. Runs entirely client-side — a straight port of what used
 * to be the POST /api/analyze-obstacles Express route.
 */
export function analyzeObstacles(text: string): Part77Result[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const obstacles = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.toLowerCase().includes("determined")) {
      continue;
    }

    const latMatch = line.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"\s*([NS])/);
    const lonMatch = line.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"\s*([EW])/);

    if (latMatch && lonMatch) {
      const latitude = dmsToDecimal(latMatch[0]);
      const longitude = dmsToDecimal(lonMatch[0]);

      if (latitude !== null && longitude !== null) {
        const obstacleId = line.split(/\s+/)[0] || `OBS-${i + 1}`;

        const coordEndIndex = Math.max(
          line.indexOf(lonMatch[0]) + lonMatch[0].length,
          line.indexOf(latMatch[0]) + latMatch[0].length,
        );
        const afterCoords = line.substring(coordEndIndex);
        const numbersAfterCoords = afterCoords.match(/\d+/g);

        let heightMSL = 0;
        let heightAGL = 0;

        if (numbersAfterCoords && numbersAfterCoords.length >= 2) {
          heightAGL = parseInt(numbersAfterCoords[numbersAfterCoords.length - 1], 10);
          heightMSL = parseInt(numbersAfterCoords[numbersAfterCoords.length - 2], 10);
        } else if (numbersAfterCoords && numbersAfterCoords.length === 1) {
          heightAGL = parseInt(numbersAfterCoords[0], 10);
        }

        obstacles.push({
          id: `${i + 1}`,
          obstacleId,
          latitude,
          longitude,
          heightMSL,
          heightAGL,
          status: "",
        });
      }
    }
  }

  if (obstacles.length === 0) {
    throw new ObstacleAnalysisError("No valid obstacles found in text");
  }

  const results: Part77Result[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    let obstacle = obstacles[i];

    const nearestResult = findNearestAirport(obstacle);
    if (!nearestResult) continue;

    if ((!obstacle.heightMSL || obstacle.heightMSL === 0) && obstacle.heightAGL) {
      const airportElevation = nearestResult.airport.elevation_ft || 0;
      obstacle = {
        ...obstacle,
        heightMSL: obstacle.heightAGL + airportElevation,
      };
    }

    let nearbyAirports = findAirportsWithinRadius(obstacle, PART77_SEARCH_RADIUS_NM);

    const nearestIncluded = nearbyAirports.some(
      (a) => a.airport.ident === nearestResult.airport.ident,
    );
    if (!nearestIncluded) {
      nearbyAirports = [nearestResult, ...nearbyAirports];
    }

    const candidateResults: Part77Result[] = nearbyAirports.map(({ airport, distance }, j) =>
      createPart77Result(obstacle, airport, distance, i),
    );

    const worstResult = pickWorstResult(candidateResults);
    results.push(worstResult);
  }

  return z.array(part77ResultSchema).parse(results);
}
