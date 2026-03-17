import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import type { Airport, Runway } from '@shared/schema';

let airports: Airport[] | null = null;
let runways: Runway[] | null = null;
let runwayApproachTypes: Map<string, string> | null = null; // Map of "AIRPORTID-RUNWAYEND" -> "PREC"|"NONPREC"|"VISUAL"

/**
 * Check if an airport is military based on name/keywords
 */
function isMilitaryAirport(name: string): boolean {
  const militaryKeywords = [
    'air force base', 'afb', 'air force',
    'army', 'aaf', 'army airfield',
    'navy', 'nas', 'naval',
    'marine', 'mcas', 'marine corps',
    'coast guard', 'uscg',
    'joint base', 'military',
    'air national guard', 'ang', 'air natl guard'
  ];
  const lowerName = name.toLowerCase();
  return militaryKeywords.some(keyword => lowerName.includes(keyword));
}

/**
 * Load and parse airport data from the FAA NTAD Aviation Facilities CSV.
 * This is the authoritative FAA source for public vs private use designation.
 *
 * Filters:
 *   STATE_CODE = 'WA'           — Washington state only
 *   FACILITY_USE_CODE = 'PU'    — Public use only (authoritative FAA field)
 *   SITE_TYPE_CODE = 'A'        — Fixed-wing airports only (excludes C=seaplane, H=helipad)
 *   Name keywords               — Excludes military airports
 */
export function loadAirports(): Airport[] {
  if (airports) {
    return airports;
  }

  const csvPath = path.join(process.cwd(), 'attached_assets', 'NTAD_Aviation_Facilities_7163558772200366310_1759859539047.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,      // Handle unescaped quotes in airport names (e.g., FLY "N" BUY)
    relax_column_count: true, // Handle rows with varying column counts
  });

  airports = records
    .filter((row: any) => {
      if (row.STATE_CODE !== 'WA') return false;
      if (row.FACILITY_USE_CODE !== 'PU') return false;     // Public use only
      if (row.SITE_TYPE_CODE !== 'A') return false;          // Fixed-wing airports only (excludes seaplanes C, heliports H)
      if (isMilitaryAirport(row.ARPT_NAME || '')) return false;
      return true;
    })
    .map((row: any) => ({
      id: row.SITE_NO || row.OBJECTID,
      ident: row.ARPT_ID,          // Local FAA code (e.g., SEA, BFI, S50) — matches approach types file
      type: 'small_airport',       // NTAD doesn't distinguish small/medium/large; not needed for analysis
      name: row.ARPT_NAME,
      latitude_deg: parseFloat(row.LAT_DECIMAL),
      longitude_deg: parseFloat(row.LONG_DECIMAL),
      elevation_ft: row.ELEV ? parseFloat(row.ELEV) : null,
      icao_code: null,
      iata_code: null,
      local_code: row.ARPT_ID,     // Use FAA local code as display identifier
      iso_region: 'US-WA',
    }));

  console.log(`Loaded ${airports.length} Washington state public-use airports from FAA NTAD data`);
  return airports;
}

/**
 * Load and parse runway data from CSV.
 * NOTE: The FAA Runways CSV uses GUID AIRPORT_IDs that do not match the NTAD
 * SITE_NO or ARPT_ID fields. Runway length lookup is therefore not available
 * via this method; approach types are determined from the curated approach types file.
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

  runways = records.map((row: any) => ({
    airport_id: row.AIRPORT_ID,
    designator: row.DESIGNATOR,
    length: row.LENGTH ? parseFloat(row.LENGTH) : 0,
    width: row.WIDTH ? parseFloat(row.WIDTH) : 0,
    surface: row.COMP_CODE || null,
    us_low: row.US_LOW === '1',
    us_high: row.US_HIGH === '1',
  }));

  console.log(`Loaded ${runways.length} runway records`);
  return runways;
}

/**
 * Get runways for a specific airport.
 * Currently non-functional due to GUID/SITE_NO mismatch between data sources.
 * Approach types are obtained from loadRunwayApproachTypes() instead.
 */
export function getRunwaysForAirport(airportId: string): Runway[] {
  const allRunways = loadRunways();
  return allRunways.filter(r => r.airport_id === airportId);
}

/**
 * Load and parse runway approach types from the curated CSV.
 * Maps "AIRPORTID-RUNWAYEND" -> "PREC" | "NONPREC" | "VISUAL"
 * Airport IDs in this file use FAA local codes (SEA, BFI, S50, etc.)
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
 * Get the most demanding approach type for a specific runway end at an airport.
 * Returns "PREC", "NONPREC", "VISUAL", or null if not found.
 */
export function getRunwayApproachType(airportIdent: string, runwayEnd: string, runway?: Runway): string | null {
  const approachTypes = loadRunwayApproachTypes();
  const ident = (airportIdent.startsWith('K') && airportIdent.length === 4)
    ? airportIdent.substring(1)
    : airportIdent;

  const key = `${ident}-${runwayEnd}`;
  const result = approachTypes.get(key);
  if (result) return result;

  // Secondary: US_LOW/US_HIGH instrument approach chart indicators
  if (runway && (runway.us_low || runway.us_high)) {
    return 'NONPREC';
  }

  return null;
}

/**
 * Get the most demanding approach type for ANY runway at an airport.
 * Scans all entries in the approach types file for the given airport ident.
 * This is used when specific runway ends are unknown (no runway records matched).
 * Returns "PREC", "NONPREC", "VISUAL", or null if airport not found in file.
 */
export function getBestApproachTypeForAirport(airportIdent: string): string | null {
  const approachTypes = loadRunwayApproachTypes();
  const ident = (airportIdent.startsWith('K') && airportIdent.length === 4)
    ? airportIdent.substring(1)
    : airportIdent;

  const prefix = `${ident}-`;
  let best: string | null = null;

  for (const [key, category] of approachTypes.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (category === 'PREC') return 'PREC';       // Precision is most demanding — stop scanning
    if (category === 'NONPREC') best = 'NONPREC';
    if (category === 'VISUAL' && best === null) best = 'VISUAL';
  }

  return best;
}

/**
 * Get all Washington state public-use airports
 */
export function getWashingtonAirports(): Airport[] {
  return loadAirports();
}

/**
 * Find airport by code (ident or local code)
 */
export function findAirportByCode(code: string): Airport | undefined {
  const allAirports = loadAirports();
  const upperCode = code.toUpperCase();
  return allAirports.find(
    a => a.ident === upperCode || a.local_code === upperCode
  );
}
