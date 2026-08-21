import { z } from "zod";

// Airport data schema (from CSV)
export const airportSchema = z.object({
  id: z.string(),
  ident: z.string(),
  type: z.string(),
  name: z.string(),
  latitude_deg: z.number(),
  longitude_deg: z.number(),
  elevation_ft: z.number().nullable(),
  icao_code: z.string().nullable(),
  iata_code: z.string().nullable(),
  local_code: z.string().nullable(),
  iso_region: z.string().nullable(),
});

export type Airport = z.infer<typeof airportSchema>;

// Parsed obstacle from text input
export const obstacleInputSchema = z.object({
  id: z.string(),
  obstacleId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  heightMSL: z.number().optional(), // Mean Sea Level - second to last number
  heightAGL: z.number().optional(), // Above Ground Level - last number
  type: z.string().optional(),
  status: z.string().optional(), // To filter out "determined"
});

export type ObstacleInput = z.infer<typeof obstacleInputSchema>;

// Part 77 Surface Types
export type SurfaceType =
  | "Primary Surface"
  | "Approach Surface"
  | "Transitional Surface"
  | "Horizontal Surface"
  | "Conical Surface";

// Part 77 Analysis Result
export const part77ResultSchema = z.object({
  id: z.string(),
  obstacleId: z.string(),
  nearestAirport: z.string(),
  airportName: z.string(),
  airportLatitude: z.number(),
  airportLongitude: z.number(),
  distance: z.number(), // in nautical miles
  obstacleHeight: z.number(),
  obstacleHeightMSL: z.number().optional(), // MSL height used for analysis
  surfaceType: z.string(),
  status: z.enum(["penetration", "warning", "clear"]),
  penetrationHeight: z.number().optional(), // feet above the surface
  latitude: z.number(),
  longitude: z.number(),
  // Surface geometry for map visualization
  horizontalRadiusFt: z.number(), // radius of horizontal surface in feet
  conicalOuterRadiusFt: z.number(), // outer radius of conical surface in feet
  approachType: z.string(), // UTILITY | VISUAL | NONPREC | PREC
});

export type Part77Result = z.infer<typeof part77ResultSchema>;
