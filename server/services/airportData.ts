import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import type { Airport, Runway } from '@shared/schema';

let airports: Airport[] | null = null;
let runways: Runway[] | null = null;
let runwayApproachTypes: Map<string, string> | null = null; // Map of "AIRPORTID-RUNWAYEND" -> "PREC"|"NONPREC"|"VISUAL"

/**
 * Check if an airport is military based on name/keywords
 * 
 * Keywords cover various military installation naming conventions including:
 * - Full names (Air Force Base, Army Airfield, etc.)
 * - Common abbreviations (AFB, AAF, NAS, MCAS, etc.)
 * - Service-specific terms (Joint Base, USCG, Air National Guard, etc.)
 */
function isMilitaryAirport(name: string): boolean {
  const militaryKeywords = [
    // Air Force
    'air force base', 'afb', 'air force',
    // Army
    'army', 'aaf', 'army airfield',
    // Navy
    'navy', 'nas', 'naval',
    // Marine Corps
    'marine', 'mcas', 'marine corps',
    // Coast Guard
    'coast guard', 'uscg',
    // Joint/Combined
    'joint base', 'military',
    // Air National Guard
    'air national guard', 'ang', 'air natl guard'
  ];
  
  const lowerName = name.toLowerCase();
  return militaryKeywords.some(keyword => lowerName.includes(keyword));
}

/**
 * Check if airport type should be excluded
 * Excludes: heliports, seaplane bases
 * Includes: small_airport, medium_airport, large_airport, closed (for reference)
 */
function isExcludedAirportType(type: string): boolean {
  const excludedTypes = ['heliport', 'seaplane_base'];
  return excludedTypes.includes(type?.toLowerCase());
}

/**
 * Load and parse airport data from CSV
 * Filters for Washington state airports only
 * Includes: All public use airports (both publicly and privately owned)
 * Excludes: Heliports, seaplane bases, military airports
 */
export function loadAirports(): Airport[] {
  if (airports) {
    return airports;
  }

  const csvPath = path.join(process.cwd(), 'attached_assets', 'airports_1759859539048.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Filter for Washington state airports
  // Include all public use airports (both publicly and privately owned)
  // Exclude heliports, seaplane bases, and military airports
  airports = records
    .filter((row: any) => {
      if (row.iso_region !== 'US-WA') return false;
      if (isExcludedAirportType(row.type)) return false;
      if (isMilitaryAirport(row.name)) return false;
      return true;
    })
    .map((row: any) => ({
      id: row.id,
      ident: row.ident,
      type: row.type,
      name: row.name,
      latitude_deg: parseFloat(row.latitude_deg),
      longitude_deg: parseFloat(row.longitude_deg),
      elevation_ft: row.elevation_ft ? parseFloat(row.elevation_ft) : null,
      icao_code: row.icao_code || null,
      iata_code: row.iata_code || null,
      local_code: row.local_code || null,
      iso_region: row.iso_region,
    }));

  console.log(`Loaded ${airports.length} Washington state airports (excluding heliports, seaplane bases, and military)`);
  return airports;
}

/**
 * Load and parse runway data from CSV
 */
export function loadRunways(): Runway[] {
  if (runways) {
    return runways;
  }

  const csvPath = path.join(process.cwd(), 'attached_assets', 'Runways_1759859539049.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Map to our runway schema including instrument approach indicators
  runways = records.map((row: any) => ({
    airport_id: row.AIRPORT_ID,
    designator: row.DESIGNATOR,
    length: row.LENGTH ? parseFloat(row.LENGTH) : 0,
    width: row.WIDTH ? parseFloat(row.WIDTH) : 0,
    surface: row.COMP_CODE || null,
    us_low: row.US_LOW === '1',   // Indicates instrument approach on US Low charts
    us_high: row.US_HIGH === '1', // Indicates instrument approach on US High charts
  }));

  console.log(`Loaded ${runways.length} runway records`);
  return runways;
}

/**
 * Get runways for a specific airport
 */
export function getRunwaysForAirport(airportId: string): Runway[] {
  const allRunways = loadRunways();
  return allRunways.filter(r => r.airport_id === airportId);
}

/**
 * Load and parse runway approach types from CSV
 * Maps airport identifier + runway end to approach category (PREC/NONPREC/VISUAL)
 */
export function loadRunwayApproachTypes(): Map<string, string> {
  if (runwayApproachTypes) {
    return runwayApproachTypes;
  }

  const csvPath = path.join(process.cwd(), 'attached_assets', 'runway_approach_types.final_1759859516606.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  runwayApproachTypes = new Map();
  
  for (const row of records as any[]) {
    const airportId = row.AirportID;
    const runwayEnd = row.RunwayEnd;
    const category = row.Category; // PREC, NONPREC, or VISUAL
    
    if (airportId && runwayEnd && category) {
      const key = `${airportId}-${runwayEnd}`;
      runwayApproachTypes.set(key, category);
    }
  }

  return runwayApproachTypes;
}

/**
 * Get approach type for a specific runway at an airport
 * Checks multiple sources:
 * 1. Curated approach types file (primary source)
 * 2. Runway US_LOW/US_HIGH indicators (secondary source)
 * Returns "PREC", "NONPREC", "VISUAL", or null if not found
 */
export function getRunwayApproachType(airportIdent: string, runwayEnd: string, runway?: Runway): string | null {
  const approachTypes = loadRunwayApproachTypes();
  
  // Primary source: Try the curated approach types file
  let key = `${airportIdent}-${runwayEnd}`;
  let result = approachTypes.get(key);
  
  if (result) {
    return result;
  }
  
  // If not found and identifier starts with 'K', try without the ICAO prefix
  // (e.g., "KS50" -> "S50", "KSEA" -> "SEA")
  if (airportIdent.startsWith('K') && airportIdent.length === 4) {
    const identWithoutK = airportIdent.substring(1);
    key = `${identWithoutK}-${runwayEnd}`;
    result = approachTypes.get(key);
    
    if (result) {
      return result;
    }
  }
  
  // Secondary source: Check runway US_LOW/US_HIGH indicators
  // If runway data is provided and has instrument approach indicators,
  // treat it as non-precision (conservative assumption)
  if (runway) {
    if (runway.us_low || runway.us_high) {
      return "NONPREC"; // Assume non-precision if has instrument approach indicator
    }
  }
  
  return null;
}

/**
 * Get all Washington state airports with their runways
 */
export function getWashingtonAirports(): Airport[] {
  return loadAirports();
}

/**
 * Find airport by code (ICAO, IATA, or ident)
 */
export function findAirportByCode(code: string): Airport | undefined {
  const allAirports = loadAirports();
  const upperCode = code.toUpperCase();
  return allAirports.find(
    a => a.icao_code === upperCode || 
         a.iata_code === upperCode || 
         a.ident === upperCode
  );
}
