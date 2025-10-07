import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import type { Airport, Runway } from '@shared/schema';

let airports: Airport[] | null = null;
let runways: Runway[] | null = null;

/**
 * Load and parse airport data from CSV
 * Filters for Washington state airports only
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

  // Filter for Washington state airports and map to our schema
  airports = records
    .filter((row: any) => row.iso_region === 'US-WA')
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
      iso_region: row.iso_region,
    }));

  console.log(`Loaded ${airports.length} Washington state airports`);
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

  // Map to our runway schema
  runways = records.map((row: any) => ({
    airport_id: row.AIRPORT_ID,
    designator: row.DESIGNATOR,
    length: row.LENGTH ? parseFloat(row.LENGTH) : 0,
    width: row.WIDTH ? parseFloat(row.WIDTH) : 0,
    surface: row.COMP_CODE || null,
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
