import type { Airport } from "./schema";
import airportsJson from "@/data/airports.json";
import runwayApproachTypesJson from "@/data/runwayApproachTypes.json";
import nasrRunwayEndsJson from "@/data/wa_nasr_rwy_ends.json";
import nasrRunwaysJson from "@/data/wa_nasr_runways.json";

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

const airports: Airport[] = airportsJson as Airport[];
const runwayApproachTypes: Map<string, string> = new Map(
  Object.entries(runwayApproachTypesJson as Record<string, string>),
);
const nasrRunwayEnds: RunwayEndData[] = nasrRunwayEndsJson as RunwayEndData[];
const nasrRunways: RunwayLengthData[] = nasrRunwaysJson as RunwayLengthData[];

export function getRunwayApproachType(
  airportIdent: string,
  runwayEnd: string,
): string | null {
  const ident =
    airportIdent.startsWith("K") && airportIdent.length === 4
      ? airportIdent.substring(1)
      : airportIdent;

  return runwayApproachTypes.get(`${ident}-${runwayEnd}`) ?? null;
}

export function getBestApproachTypeForAirport(
  airportIdent: string,
): string | null {
  const ident =
    airportIdent.startsWith("K") && airportIdent.length === 4
      ? airportIdent.substring(1)
      : airportIdent;

  const prefix = `${ident}-`;
  let best: string | null = null;

  for (const [key, category] of runwayApproachTypes.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (category === "PREC") return "PREC";
    if (category === "NONPREC") best = "NONPREC";
    if (category === "VISUAL" && best === null) best = "VISUAL";
  }

  return best;
}

/**
 * Get NASR runway end records for a specific airport (by FAA local code / ARPT_ID).
 */
export function getRunwayEndsForAirport(arptId: string): RunwayEndData[] {
  return nasrRunwayEnds.filter((e) => e.arptId === arptId);
}

/**
 * Get NASR runway length records for a specific airport (by FAA local code / ARPT_ID).
 */
export function getRunwayLengthsForAirport(arptId: string): RunwayLengthData[] {
  return nasrRunways.filter((r) => r.arptId === arptId);
}

export function getWashingtonAirports(): Airport[] {
  return airports;
}
