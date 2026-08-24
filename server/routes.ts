import type { Express } from "express";
import { createServer, type Server } from "http";
import { part77ResultSchema, type Part77Result } from "@shared/schema";
import { findNearestAirport, findAirportsWithinRadius } from "./services/distanceCalculator";
import { createPart77Result } from "./services/part77Calculator";
import { parseObstacleText } from "./services/obstacleParser";
import { z } from "zod";

function statusRank(status: string): number {
  if (status === "penetration") return 2;
  if (status === "warning") return 1;
  return 0;
}

function pickWorstResult(results: Part77Result[]): Part77Result {
  return results.reduce((worst, result) => {
    const worstRank = statusRank(worst.status);
    const resultRank = statusRank(result.status);
    if (resultRank > worstRank) return result;
    if (resultRank < worstRank) return worst;

    const worstDepth = worst.penetrationHeight ?? 0;
    const resultDepth = result.penetrationHeight ?? 0;
    if (resultDepth > worstDepth) return result;
    if (resultDepth < worstDepth) return worst;

    return result.distance < worst.distance ? result : worst;
  });
}

const PART77_SEARCH_RADIUS_NM = 10;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/analyze-obstacles", async (req, res) => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text input is required" });
      }

      const parsed = parseObstacleText(text);
      const {
        obstacles,
        unparsedLines,
        skippedDetermined,
        sourceFormat,
        detectedAsnCount = 0,
      } = parsed;

      if (obstacles.length === 0) {
        return res.status(400).json({
          error: "No active obstacles found in text",
          details:
            sourceFormat === "oeaaa-table"
              ? `FAA scanner detected ${detectedAsnCount} ASN record(s), skipped ${skippedDetermined} Determined record(s), and produced 0 active records. ${unparsedLines.length} record(s) could not be completed.`
              : "No obstacle records were recognized. Paste the FAA OE/AAA results directly or use supported row data.",
          sourceFormat,
          detectedAsnCount,
          skippedDetermined,
          unparsedCount: unparsedLines.length,
          unparsedLines: unparsedLines.slice(0, 12),
          inputCharacters: text.length,
        });
      }

      const results: Part77Result[] = [];

      for (let i = 0; i < obstacles.length; i++) {
        let obstacle = obstacles[i];
        const nearestResult = findNearestAirport(obstacle);
        if (!nearestResult) continue;

        // For generic row input with only AGL, retain the legacy estimate.
        // FAA OE/AAA input already provides top-of-structure MSL in obstacle.heightMSL.
        if ((!obstacle.heightMSL || obstacle.heightMSL === 0) && obstacle.heightAGL) {
          const airportElevation = nearestResult.airport.elevation_ft || 0;
          obstacle = {
            ...obstacle,
            heightMSL: obstacle.heightAGL + airportElevation,
          };
        }

        let nearbyAirports = findAirportsWithinRadius(obstacle, PART77_SEARCH_RADIUS_NM);
        if (!nearbyAirports.some(item => item.airport.ident === nearestResult.airport.ident)) {
          nearbyAirports = [nearestResult, ...nearbyAirports];
        }

        const candidateResults = nearbyAirports.map(({ airport, distance }) =>
          createPart77Result(obstacle, airport, distance, i),
        );

        if (candidateResults.length > 0) {
          results.push(pickWorstResult(candidateResults));
        }
      }

      const validatedResults = z.array(part77ResultSchema).parse(results);

      return res.json({
        success: true,
        count: validatedResults.length,
        parsedCount: obstacles.length,
        detectedAsnCount,
        skippedDetermined,
        unparsedCount: unparsedLines.length,
        unparsedLines: unparsedLines.slice(0, 12),
        sourceFormat,
        results: validatedResults,
      });
    } catch (error) {
      console.error("Error analyzing obstacles:", error);
      return res.status(500).json({
        error: "Failed to analyze obstacles",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return createServer(app);
}
