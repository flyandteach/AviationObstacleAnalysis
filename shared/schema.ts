import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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

// Runway data schema (from CSV)
export const runwaySchema = z.object({
  airport_id: z.string(),
  designator: z.string(),
  length: z.number(),
  width: z.number(),
  surface: z.string().nullable(),
  us_low: z.boolean().optional(),  // Indicates instrument approach on US Low charts
  us_high: z.boolean().optional(), // Indicates instrument approach on US High charts
});

export type Runway = z.infer<typeof runwaySchema>;

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
  | "Conical Surface"
  | "Notification Surface (77.9)";

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
  surfaceType: z.string(),
  status: z.enum(["penetration", "warning", "clear"]),
  latitude: z.number(),
  longitude: z.number(),
});

export type Part77Result = z.infer<typeof part77ResultSchema>;
