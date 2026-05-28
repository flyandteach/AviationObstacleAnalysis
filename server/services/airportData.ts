import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import type { Airport, Runway } from '@shared/schema';

let airports: Airport[] | null = null;
let runways: Runway[] | null = null;
let runwayApproachTypes: Map<string, string> | null = null;

export interface RunwayEndData {
  arptId: string;
  rwdId: string;
  endId: string;
  trueAlignment: number | null;
  ilsType: string;
  lat: number;
  lon: number;
  elev: number | null;
}

export interface RunwayLengthData {
  arptId: string;
  rwdId: string;
  lengthFt: number | null;
  widthFt: number | null;
}

let nasrRunwayEndsCache: RunwayEndData[] | null = null;
let nasrRunwaysCache: RunwayLengthData[] | null = null;

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

export function loadAirports(): Airport[] {
  if (airports) return airports;

  const csvPath = path.join(process.cwd(), 'attached_assets', 'NTAD_Aviation_Facilities_7163558772200366310_1759859539047.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  airports = records
    .filter((row: any) => {
      if (row.STATE_CODE !== 'WA') return false;
      if (row.FACILITY_USE_CODE !== 'PU') return false;
      if (row.SITE_TYPE_CODE !== 'A') return false;
      if (isMilitaryAirport(row.ARPT_NAME || '')) return false;
      return true;
    })
    .map((row: any) => ({
      id: row.SITE_NO || row.OBJECTID,
      ident: row.ARPT_ID,
      type: 'small_airport',
      name: row.ARPT_NAME,
      latitude_deg: parseFloat(row.LAT_DECIMAL),
      longitude_deg: parseFloat(row.LONG_DECIMAL),
      elevation_ft: row.ELEV ? parseFloat(row.ELEV) : null,
      icao_code: null,
      iata_code: null,
      local_code: row.ARPT_ID,
      iso_region: 'US-WA',
    }));

  console.log(`Loaded ${airports.length} Washington state public-use airports from FAA NTAD data`);
  return airports;
}

export function loadRunways(): Runway[] {
  if (runways) return runways;

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

  return runways;
}

export function getRunwaysForAirport(airportId: string): Runway[] {
  const allRunways = loadRunways();
  return allRunways.filter(r => r.airport_id === airportId);
}

export function loadRunwayApproachTypes(): Map<string, string> {
  if (runwayApproachTypes) return runwayApproachTypes;

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
    const category = row.Category;
    if (airportId && runwayEnd && category) {
      runwayApproachTypes.set(`${airportId}-${runwayEnd}`, category);
    }
  }

  return runwayApproachTypes;
}

export function getRunwayApproachType(airportIdent: string, runwayEnd: string, runway?: Runway): string | null {
  const approachTypes = loadRunwayApproachTypes();
  const ident = (airportIdent.startsWith('K') && airportIdent.length === 4)
    ? airportIdent.substring(1)
    : airportIdent;

  const result = approachTypes.get(`${ident}-${runwayEnd}`);
  if (result) return result;

  if (runway && (runway.us_low || runway.us_high)) return 'NONPREC';
  return null;
}

export function getBestApproachTypeForAirport(airportIdent: string): string | null {
  const approachTypes = loadRunwayApproachTypes();
  const ident = (airportIdent.startsWith('K') && airportIdent.length === 4)
    ? airportIdent.substring(1)
    : airportIdent;

  const prefix = `${ident}-`;
  let best: string | null = null;

  for (const [key, category] of approachTypes.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (category === 'PREC') return 'PREC';
    if (category === 'NONPREC') best = 'NONPREC';
    if (category === 'VISUAL' && best === null) best = 'VISUAL';
  }

  return best;
}

/**
 * Load NASR APT_RWY_END data for Washington state airports.
 * Pre-filtered and saved as JSON during data preparation.
 */
function loadNasrRunwayEnds(): RunwayEndData[] {
  if (nasrRunwayEndsCache) return nasrRunwayEndsCache;
  const filePath = path.join(process.cwd(), 'attached_assets', 'wa_nasr_rwy_ends.json');
  nasrRunwayEndsCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Loaded ${nasrRunwayEndsCache!.length} NASR runway end records for WA`);
  return nasrRunwayEndsCache!;
}

/**
 * Load NASR APT_RWY data for Washington state airports.
 * Pre-filtered and saved as JSON during data preparation.
 */
function loadNasrRunways(): RunwayLengthData[] {
  if (nasrRunwaysCache) return nasrRunwaysCache;
  const filePath = path.join(process.cwd(), 'attached_assets', 'wa_nasr_runways.json');
  nasrRunwaysCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Loaded ${nasrRunwaysCache!.length} NASR runway records for WA`);
  return nasrRunwaysCache!;
}

/**
 * Get NASR runway end records for a specific airport (by FAA local code / ARPT_ID).
 */
export function getRunwayEndsForAirport(arptId: string): RunwayEndData[] {
  return loadNasrRunwayEnds().filter(e => e.arptId === arptId);
}

/**
 * Get NASR runway length records for a specific airport (by FAA local code / ARPT_ID).
 */
export function getRunwayLengthsForAirport(arptId: string): RunwayLengthData[] {
  return loadNasrRunways().filter(r => r.arptId === arptId);
}

export function getWashingtonAirports(): Airport[] {
  return loadAirports();
}

export function findAirportByCode(code: string): Airport | undefined {
  const allAirports = loadAirports();
  const upperCode = code.toUpperCase();
  return allAirports.find(a => a.ident === upperCode || a.local_code === upperCode);
}
