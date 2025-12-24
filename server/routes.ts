import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { obstacleInputSchema, part77ResultSchema } from "@shared/schema";
import { findNearestAirport } from "./services/distanceCalculator";
import { createPart77Result } from "./services/part77Calculator";
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
  
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  
  return decimal;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Analyze obstacles against Part 77 surfaces
  app.post("/api/analyze-obstacles", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text input is required" });
      }

      // Parse obstacle data from text
      const lines = text.split('\n').filter(line => line.trim());
      const obstacles = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip if contains "Determined" (case insensitive)
        if (line.toLowerCase().includes('determined')) {
          continue;
        }
        
        // Extract coordinates using regex for DMS format
        const latMatch = line.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"\s*([NS])/);
        const lonMatch = line.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"\s*([EW])/);
        
        if (latMatch && lonMatch) {
          const latitude = dmsToDecimal(latMatch[0]);
          const longitude = dmsToDecimal(lonMatch[0]);
          
          if (latitude !== null && longitude !== null) {
            // Extract obstacle ID (first word/sequence)
            const obstacleId = line.split(/\s+/)[0] || `OBS-${i + 1}`;
            
            // Extract numbers from the portion AFTER coordinates
            // User clarified: second to last number = MSL, last number = AGL
            const coordEndIndex = Math.max(
              line.indexOf(lonMatch[0]) + lonMatch[0].length,
              line.indexOf(latMatch[0]) + latMatch[0].length
            );
            const afterCoords = line.substring(coordEndIndex);
            const numbersAfterCoords = afterCoords.match(/\d+/g);
            
            let heightMSL = 0;
            let heightAGL = 0;
            
            if (numbersAfterCoords && numbersAfterCoords.length >= 2) {
              // Last number = AGL (height above ground)
              heightAGL = parseInt(numbersAfterCoords[numbersAfterCoords.length - 1], 10);
              // Second to last number = Ground Elevation (site elevation MSL)
              const groundElevation = parseInt(numbersAfterCoords[numbersAfterCoords.length - 2], 10);
              // Obstacle top MSL = Ground Elevation + AGL
              heightMSL = groundElevation + heightAGL;
            } else if (numbersAfterCoords && numbersAfterCoords.length === 1) {
              // If only one number, treat it as AGL
              heightAGL = parseInt(numbersAfterCoords[0], 10);
            }
            
            obstacles.push({
              id: `${i + 1}`,
              obstacleId,
              latitude,
              longitude,
              heightMSL,
              heightAGL,
              status: '', // Placeholder
            });
          }
        }
      }

      if (obstacles.length === 0) {
        return res.status(400).json({ error: "No valid obstacles found in text" });
      }

      // Analyze each obstacle
      const results = [];
      for (let i = 0; i < obstacles.length; i++) {
        let obstacle = obstacles[i];
        
        // Find nearest airport
        const nearestResult = findNearestAirport(obstacle);
        if (!nearestResult) {
          continue;
        }

        // If we only have AGL but not MSL, calculate MSL from AGL + airport elevation
        if ((!obstacle.heightMSL || obstacle.heightMSL === 0) && obstacle.heightAGL) {
          const airportElevation = nearestResult.airport.elevation_ft || 0;
          obstacle = {
            ...obstacle,
            heightMSL: obstacle.heightAGL + airportElevation
          };
        }

        // Perform Part 77 analysis
        const result = createPart77Result(
          obstacle,
          nearestResult.airport,
          nearestResult.distance,
          i
        );
        
        results.push(result);
      }

      // Validate results
      const validatedResults = z.array(part77ResultSchema).parse(results);
      
      res.json({ 
        success: true,
        count: validatedResults.length,
        results: validatedResults 
      });

    } catch (error) {
      console.error("Error analyzing obstacles:", error);
      res.status(500).json({ 
        error: "Failed to analyze obstacles",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
