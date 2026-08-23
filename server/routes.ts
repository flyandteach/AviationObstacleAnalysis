import type { Express } from "express";
import { createServer, type Server } from "http";
import { part77ResultSchema, type ObstacleInput, type Part77Result } from "@shared/schema";
import { findNearestAirport, findAirportsWithinRadius } from "./services/distanceCalculator";
import { createPart77Result } from "./services/part77Calculator";
import { z } from "zod";

interface CoordinateMatch {
  value: number;
  start: number;
  end: number;
}

interface ParsedCoordinates {
  latitude: number;
  longitude: number;
  endIndex: number;
  format: "dms" | "decimal-hemisphere" | "decimal";
}

function normalizeCoordinateText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[º]/g, "°")
    .replace(/[′’`]/g, "'")
    .replace(/[″”]/g, '"');
}

function dmsPartsToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  direction: string,
): number | null {
  if (!Number.isFinite(degrees) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;

  const maxDegrees = /[NS]/i.test(direction) ? 90 : 180;
  if (degrees < 0 || degrees > maxDegrees) return null;

  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (/[SW]/i.test(direction)) decimal = -decimal;
  return decimal;
}

function findDmsCoordinate(line: string, latitude: boolean): CoordinateMatch | null {
  const hemisphere = latitude ? "NS" : "EW";
  const patterns = [
    // 47° 27' 00.72" N, 47º27'00.72N, 47-27-00.72N
    new RegExp(`(\\d{1,3})\\s*(?:°|-)\\s*(\\d{1,2})\\s*(?:'|-)\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*(?:\")?\\s*([${hemisphere}])`, "i"),
    // 47 27 00.72 N
    new RegExp(`(\\d{1,3})\\s+(\\d{1,2})\\s+(\\d{1,2}(?:\\.\\d+)?)\\s*([${hemisphere}])`, "i"),
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match || match.index === undefined) continue;

    const value = dmsPartsToDecimal(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      match[4],
    );
    if (value === null) continue;

    return {
      value,
      start: match.index,
      end: match.index + match[0].length,
    };
  }

  return null;
}

function findDecimalHemisphereCoordinate(line: string, latitude: boolean): CoordinateMatch | null {
  const hemisphere = latitude ? "NS" : "EW";
  const pattern = new RegExp(`(-?\\d{1,3}(?:\\.\\d+)?)\\s*°?\\s*([${hemisphere}])`, "i");
  const match = line.match(pattern);
  if (!match || match.index === undefined) return null;

  let value = Math.abs(Number(match[1]));
  if (!Number.isFinite(value)) return null;

  const max = latitude ? 90 : 180;
  if (value > max) return null;
  if (/[SW]/i.test(match[2])) value = -value;

  return {
    value,
    start: match.index,
    end: match.index + match[0].length,
  };
}

function parseCoordinates(rawLine: string): ParsedCoordinates | null {
  const line = normalizeCoordinateText(rawLine);

  const latDms = findDmsCoordinate(line, true);
  const lonDms = findDmsCoordinate(line, false);
  if (latDms && lonDms) {
    return {
      latitude: latDms.value,
      longitude: lonDms.value,
      endIndex: Math.max(latDms.end, lonDms.end),
      format: "dms",
    };
  }

  // Decimal degrees with hemisphere, e.g. 47.4502 N, 122.3088 W
  const latHemisphere = findDecimalHemisphereCoordinate(line, true);
  const lonHemisphere = findDecimalHemisphereCoordinate(line, false);
  if (latHemisphere && lonHemisphere) {
    return {
      latitude: latHemisphere.value,
      longitude: lonHemisphere.value,
      endIndex: Math.max(latHemisphere.end, lonHemisphere.end),
      format: "decimal-hemisphere",
    };
  }

  // Signed decimal-degree pair, comma/tab/semicolon/pipe/space delimited.
  // Examples: 47.4502,-122.3088 or 47.4502\t-122.3088
  const decimalPair = /(-?\d{1,2}(?:\.\d+))\s*[,;\t| ]+\s*(-?\d{1,3}(?:\.\d+))/g;
  let match: RegExpExecArray | null;
  while ((match = decimalPair.exec(line)) !== null) {
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180
    ) {
      return {
        latitude,
        longitude,
        endIndex: match.index + match[0].length,
        format: "decimal",
      };
    }
  }

  return null;
}

function extractObstacleId(line: string, index: number): string {
  const firstField = line.trim().split(/[,;\t|\s]+/)[0]?.trim();
  return firstField || `OBS-${index + 1}`;
}

function extractHeights(line: string, coordinateEndIndex: number): { heightMSL: number; heightAGL: number } {
  const afterCoordinates = normalizeCoordinateText(line).slice(coordinateEndIndex);
  const numericValues = Array.from(afterCoordinates.matchAll(/-?\d+(?:\.\d+)?/g))
    .map(match => Number(match[0]))
    .filter(Number.isFinite);

  // Preserve the original application's input convention:
  // two or more trailing numbers -> second-to-last is MSL, last is AGL;
  // one trailing number -> treat as AGL.
  if (numericValues.length >= 2) {
    return {
      heightMSL: numericValues[numericValues.length - 2],
      heightAGL: numericValues[numericValues.length - 1],
    };
  }
  if (numericValues.length === 1) {
    return { heightMSL: 0, heightAGL: numericValues[0] };
  }
  return { heightMSL: 0, heightAGL: 0 };
}

function looksLikeHeader(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    (lower.includes("latitude") && lower.includes("longitude")) ||
    (lower.includes("lat") && lower.includes("lon") && lower.includes("height")) ||
    lower.startsWith("obstacleid") ||
    lower.startsWith("obstacle id")
  );
}

export function parseObstacleText(text: string): {
  obstacles: ObstacleInput[];
  unparsedLines: Array<{ lineNumber: number; text: string }>;
  skippedDetermined: number;
} {
  const rawLines = text.split(/\r?\n/);
  const obstacles: ObstacleInput[] = [];
  const unparsedLines: Array<{ lineNumber: number; text: string }> = [];
  let skippedDetermined = 0;

  rawLines.forEach((rawLine, rawIndex) => {
    const line = rawLine.trim();
    if (!line) return;
    if (looksLikeHeader(line)) return;

    if (line.toLowerCase().includes("determined")) {
      skippedDetermined += 1;
      return;
    }

    const coordinates = parseCoordinates(line);
    if (!coordinates) {
      unparsedLines.push({ lineNumber: rawIndex + 1, text: line.slice(0, 180) });
      return;
    }

    const { heightMSL, heightAGL } = extractHeights(line, coordinates.endIndex);

    obstacles.push({
      id: `${rawIndex + 1}`,
      obstacleId: extractObstacleId(line, rawIndex),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      heightMSL,
      heightAGL,
      status: "",
    });
  });

  return { obstacles, unparsedLines, skippedDetermined };
}

/** Status severity rank — higher is worse. */
function statusRank(status: string): number {
  if (status === "penetration") return 2;
  if (status === "warning") return 1;
  return 0;
}

/** Pick the most restrictive Part 77 result across multiple airports. */
function pickWorstResult(results: Part77Result[]): Part77Result {
  return results.reduce((worst, r) => {
    const wRank = statusRank(worst.status);
    const rRank = statusRank(r.status);
    if (rRank > wRank) return r;
    if (rRank < wRank) return worst;
    const wDepth = worst.penetrationHeight ?? 0;
    const rDepth = r.penetrationHeight ?? 0;
    if (rDepth > wDepth) return r;
    if (rDepth < wDepth) return worst;
    return r.distance < worst.distance ? r : worst;
  });
}

/**
 * Maximum search radius (NM) to cover all Part 77 surfaces.
 * Precision approach surfaces can extend roughly 9 NM from the airport area.
 */
const PART77_SEARCH_RADIUS_NM = 10;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/analyze-obstacles", async (req, res) => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text input is required" });
      }

      const { obstacles, unparsedLines, skippedDetermined } = parseObstacleText(text);

      if (obstacles.length === 0) {
        return res.status(400).json({
          error: "No valid obstacles found in text",
          details: "No coordinate pairs were recognized. The app accepts decimal degrees and common DMS/FAA DMS formats.",
          supportedExamples: [
            "OBS-001,47.4502,-122.3088,485,Tower",
            "OBS-002 47° 27' 00.72\" N 122° 18' 31.68\" W 650 120",
            "OBS-003 47-27-00.72N 122-18-31.68W 650 120",
          ],
          unparsedLines: unparsedLines.slice(0, 8),
        });
      }

      const results: Part77Result[] = [];
      for (let i = 0; i < obstacles.length; i++) {
        let obstacle = obstacles[i];

        const nearestResult = findNearestAirport(obstacle);
        if (!nearestResult) continue;

        // When the source provides only AGL, retain the legacy fallback behavior.
        // This is an estimate, not surveyed site elevation.
        if ((!obstacle.heightMSL || obstacle.heightMSL === 0) && obstacle.heightAGL) {
          const airportElevation = nearestResult.airport.elevation_ft || 0;
          obstacle = {
            ...obstacle,
            heightMSL: obstacle.heightAGL + airportElevation,
          };
        }

        let nearbyAirports = findAirportsWithinRadius(obstacle, PART77_SEARCH_RADIUS_NM);
        const nearestIncluded = nearbyAirports.some(
          a => a.airport.ident === nearestResult.airport.ident,
        );
        if (!nearestIncluded) {
          nearbyAirports = [nearestResult, ...nearbyAirports];
        }

        const candidateResults: Part77Result[] = nearbyAirports.map(({ airport, distance }) =>
          createPart77Result(obstacle, airport, distance, i),
        );

        if (candidateResults.length > 0) {
          results.push(pickWorstResult(candidateResults));
        }
      }

      const validatedResults = z.array(part77ResultSchema).parse(results);

      res.json({
        success: true,
        count: validatedResults.length,
        parsedCount: obstacles.length,
        skippedDetermined,
        unparsedCount: unparsedLines.length,
        unparsedLines: unparsedLines.slice(0, 8),
        results: validatedResults,
      });
    } catch (error) {
      console.error("Error analyzing obstacles:", error);
      res.status(500).json({
        error: "Failed to analyze obstacles",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return createServer(app);
}
