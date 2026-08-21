import type { Airport, ObstacleInput, Part77Result, SurfaceType } from './schema';
import {
  getBestApproachTypeForAirport,
  getRunwayApproachType,
  getRunwayEndsForAirport,
  getRunwayLengthsForAirport,
  type RunwayEndData,
} from './airportData';

// ─── Constants ────────────────────────────────────────────────────────────────

const FT_PER_DEG_LAT = 364566;          // feet per degree of latitude (≈ 1 NM = 6076.12 ft)
const HORIZONTAL_SURFACE_HEIGHT = 150;  // feet above airport elevation (§77.25(a))
const PRIMARY_EXTENSION_FT = 200;       // feet the primary surface extends beyond each threshold

// ─── Geometry Helpers ─────────────────────────────────────────────────────────

/**
 * Convert a lat/lon offset to a local flat-earth coordinate pair (feet).
 * East is +dx, North is +dy.  Uses the reference latitude to scale longitude.
 */
function latLonToFt(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
): { dx: number; dy: number } {
  const ftPerDegLon = FT_PER_DEG_LAT * Math.cos(fromLat * Math.PI / 180);
  return {
    dx: (toLon - fromLon) * ftPerDegLon,
    dy: (toLat - fromLat) * FT_PER_DEG_LAT,
  };
}

/**
 * Convert a true-north-referenced heading (degrees, clockwise) into a unit vector
 * expressed in the (East, North) plane.
 */
function headingToVec(headingDeg: number): { ex: number; ey: number } {
  const rad = headingDeg * Math.PI / 180;
  return { ex: Math.sin(rad), ey: Math.cos(rad) };
}

/**
 * Project an obstacle onto the approach-surface axis defined by a runway-end threshold
 * and the approach heading (the direction FROM the runway that the surface extends).
 *
 * Returns:
 *   along   – feet from the threshold in the approach direction (positive = outbound from runway)
 *   lateral – perpendicular feet from the centerline (always ≥ 0)
 */
function projectOntoApproach(
  obsLat: number, obsLon: number,
  threshLat: number, threshLon: number,
  approachHeadingDeg: number,
): { along: number; lateral: number } {
  const { dx, dy } = latLonToFt(threshLat, threshLon, obsLat, obsLon);
  const { ex, ey } = headingToVec(approachHeadingDeg);
  return {
    along: dx * ex + dy * ey,
    lateral: Math.abs(dx * ey - dy * ex),
  };
}

/**
 * Compute the closest distance from an obstacle to the line SEGMENT between two runway ends.
 * Also returns the normalized projection parameter t (0 = at end1, 1 = at end2).
 */
function distToSegmentFt(
  obsLat: number, obsLon: number,
  end1Lat: number, end1Lon: number,
  end2Lat: number, end2Lon: number,
): { dist: number; t: number } {
  const { dx: px, dy: py } = latLonToFt(end1Lat, end1Lon, obsLat, obsLon);
  const { dx: vx, dy: vy } = latLonToFt(end1Lat, end1Lon, end2Lat, end2Lon);
  const lenSq = vx * vx + vy * vy;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / lenSq)) : 0;
  const ex = px - t * vx;
  const ey = py - t * vy;
  return { dist: Math.sqrt(ex * ex + ey * ey), t };
}

// ─── Approach Surface Parameters (§77.25) ────────────────────────────────────

interface ApproachParams {
  length: number;         // total surface length in feet
  innerHalfWidth: number; // half-width at inner edge (feet each side of CL)
  outerHalfWidth: number; // half-width at outer edge (feet)
  expansion: number;      // half-width feet gained per foot along the surface
}

/**
 * Return approach surface geometry parameters for a given approach category.
 * All dimensions per 14 CFR §77.25(d) and the NGS OIS specification table.
 *
 *  UTILITY  – utility runway (any approach type): 20:1, 5 000 ft, 250→750 ft half-width
 *  VISUAL   – other-than-utility visual:          20:1, 5 000 ft, 500→750 ft half-width
 *  NONPREC  – non-precision instrument:           34:1,10 000 ft, 500→2 000 ft half-width
 *  PREC     – precision instrument (ILS):         50:1+40:1, 50 000 ft, 500→8 000 ft half-width
 */
function getApproachParams(approachType: string): ApproachParams {
  switch (approachType) {
    case 'UTILITY':
      return { length: 5000,  innerHalfWidth: 250, outerHalfWidth: 750,  expansion: (750  - 250) / 5000  };
    case 'VISUAL':
      return { length: 5000,  innerHalfWidth: 500, outerHalfWidth: 750,  expansion: (750  - 500) / 5000  };
    case 'NONPREC':
      return { length: 10000, innerHalfWidth: 500, outerHalfWidth: 2000, expansion: (2000 - 500) / 10000 };
    case 'PREC':
      return { length: 50000, innerHalfWidth: 500, outerHalfWidth: 8000, expansion: (8000 - 500) / 50000 };
    default:
      return { length: 10000, innerHalfWidth: 500, outerHalfWidth: 2000, expansion: (2000 - 500) / 10000 };
  }
}

/**
 * Height of the approach surface above airport elevation at distance d from the approach
 * surface's inner edge (= PRIMARY_EXTENSION_FT beyond the threshold).
 * Returns null when d exceeds the surface length (obstacle is beyond the surface).
 */
function approachHeightAtDist(d: number, approachType: string): number | null {
  if (d <= 0) return 0;
  switch (approachType) {
    case 'UTILITY':
    case 'VISUAL':
      return d > 5000  ? null : d / 20;
    case 'NONPREC':
      return d > 10000 ? null : d / 34;
    case 'PREC':
      if (d > 50000) return null;
      return d <= 10000 ? d / 50 : 200 + (d - 10000) / 40;
    default:
      return d > 10000 ? null : d / 34;
  }
}

// ─── Penetration Tracking ─────────────────────────────────────────────────────

interface SurfacePenetration {
  penetrates: boolean;
  surfaceType: SurfaceType;
  penetrationHeight?: number;
}

const SURFACE_SEVERITY: Record<string, number> = {
  'Primary Surface':      5,
  'Approach Surface':     4,
  'Transitional Surface': 3,
  'Horizontal Surface':   2,
  'Conical Surface':      1,
};

/** Return whichever penetration is more significant. */
function worsePenetration(
  a: SurfacePenetration | null,
  b: SurfacePenetration,
): SurfacePenetration {
  if (!a) return b;
  if (!a.penetrates && !b.penetrates) return a;
  if (!a.penetrates) return b;
  if (!b.penetrates) return a;
  // Both penetrate — largest depth wins; ties broken by surface severity
  const aD = a.penetrationHeight ?? 0;
  const bD = b.penetrationHeight ?? 0;
  if (bD > aD) return b;
  if (aD > bD) return a;
  return (SURFACE_SEVERITY[b.surfaceType] ?? 0) >= (SURFACE_SEVERITY[a.surfaceType] ?? 0) ? b : a;
}

// ─── Approach-Type Determination per Runway End ───────────────────────────────

/**
 * Determine the approach category for a single runway end.
 *
 * Priority:
 *   1. Utility runway (length < 3 200 ft) → UTILITY
 *   2. NASR ILS_TYPE contains "ILS", "MLS", or "GLS" → PREC
 *   3. Curated approach-types CSV for this airport/end → PREC | NONPREC | VISUAL
 *   4. Conservative default → NONPREC
 */
function endApproachType(
  airportIdent: string,
  endId: string,
  ilsType: string,
  isUtility: boolean,
): string {
  if (isUtility) return 'UTILITY';
  if (ilsType && /\b(ILS|MLS|GLS)\b/i.test(ilsType)) return 'PREC';
  const fileType = getRunwayApproachType(airportIdent, endId);
  return fileType ?? 'NONPREC';
}

// ─── Airport-level approach type ordering ─────────────────────────────────────

const APPROACH_RANK: Record<string, number> = { VISUAL: 0, UTILITY: 1, NONPREC: 2, PREC: 3 };

function moreRestrictiveApproach(a: string, b: string): string {
  return (APPROACH_RANK[b] ?? 0) > (APPROACH_RANK[a] ?? 0) ? b : a;
}

// ─── Full Analysis Result ─────────────────────────────────────────────────────

interface AnalysisResult {
  penetration: SurfacePenetration;
  airportBestApproachType: string;
  horizontalRadiusFt: number;
  conicalOuterRadiusFt: number;
}

// ─── Main Part 77 Analysis ────────────────────────────────────────────────────

/**
 * Analyze an obstacle against all 14 CFR Part 77 imaginary surfaces for a given airport.
 *
 * Uses FAA NASR APT_RWY_END coordinates for:
 *   • Directional approach surface corridors (proper trapezoid, not radial arc)
 *   • Transitional surfaces (7:1 from primary and approach edges)
 *   • Horizontal surface oval (distance to each runway segment, not circle from ARP)
 *
 * Falls back to a conservative radial approximation when NASR data is unavailable.
 */
export function analyzePart77(
  obstacle: ObstacleInput,
  airport: Airport,
  distanceNM: number,
): AnalysisResult {
  const distanceFt  = distanceNM * 6076.12;
  const obstacleMSL = obstacle.heightMSL ?? 0;
  const airportMSL  = airport.elevation_ft ?? 0;
  const obstRel     = obstacleMSL - airportMSL;  // obstacle height relative to airport elevation
  const obsLat      = obstacle.latitude;
  const obsLon      = obstacle.longitude;

  // ── Load NASR runway data ──────────────────────────────────────────────────
  const nasrEnds    = getRunwayEndsForAirport(airport.ident);
  const nasrLengths = getRunwayLengthsForAirport(airport.ident);

  // Build per-runway map: rwdId → { lengthFt, ends[] }
  interface RwyRecord { lengthFt: number | null; ends: RunwayEndData[] }
  const runwayMap = new Map<string, RwyRecord>();

  for (const rwy of nasrLengths) {
    runwayMap.set(rwy.rwdId, { lengthFt: rwy.lengthFt, ends: [] });
  }
  for (const end of nasrEnds) {
    if (!runwayMap.has(end.rwdId)) {
      runwayMap.set(end.rwdId, { lengthFt: null, ends: [] });
    }
    runwayMap.get(end.rwdId)!.ends.push(end);
  }

  const hasNasrData = runwayMap.size > 0;

  // ── No NASR data — conservative radial fallback ───────────────────────────
  if (!hasNasrData) {
    return radialFallback(obstacle, airport, distanceFt, obstRel);
  }

  // ── Process each runway ───────────────────────────────────────────────────
  let bestPen: SurfacePenetration | null = null;
  let airportBestApproach = 'VISUAL';

  for (const [, { lengthFt, ends }] of runwayMap) {
    if (ends.length < 2) continue; // Need both ends for geometry

    const isUtility     = lengthFt !== null && lengthFt > 0 && lengthFt < 3200;
    const primaryHW     = isUtility ? 250 : 500;  // primary surface half-width (ft)
    const [end1, end2]  = ends;

    // ── Primary Surface — runway body ──────────────────────────────────────
    // Rectangle centered on runway centerline segment.
    if (end1.lat && end2.lat) {
      const { dist, t } = distToSegmentFt(obsLat, obsLon, end1.lat, end1.lon, end2.lat, end2.lon);

      if (t >= 0 && t <= 1) {
        if (dist <= primaryHW) {
          // Inside primary surface
          if (obstRel > 0) {
            bestPen = worsePenetration(bestPen, {
              penetrates: true,
              surfaceType: 'Primary Surface',
              penetrationHeight: obstRel,
            });
          }
        } else if (obstRel > 0 && obstRel < HORIZONTAL_SURFACE_HEIGHT) {
          // Transitional surface from primary edge (7:1 lateral slope)
          const transH = (dist - primaryHW) / 7;
          if (obstRel > transH) {
            bestPen = worsePenetration(bestPen, {
              penetrates: true,
              surfaceType: 'Transitional Surface',
              penetrationHeight: obstRel - transH,
            });
          }
        }
      }
    }

    // ── Per-end approach + transitional + primary extension checks ─────────
    for (const end of ends) {
      if (end.trueAlignment === null) continue;

      // The approach surface extends FROM the runway in the inbound direction.
      // If trueAlignment is the course FROM this end toward the other end,
      // then the approach extends in the OPPOSITE direction: trueAlignment + 180°.
      const approachHdg   = (end.trueAlignment + 180) % 360;
      const appType       = endApproachType(airport.ident, end.endId, end.ilsType, isUtility);
      airportBestApproach = moreRestrictiveApproach(airportBestApproach, appType);

      const params = getApproachParams(appType);
      const { along, lateral } = projectOntoApproach(obsLat, obsLon, end.lat, end.lon, approachHdg);

      // Primary surface extension (200 ft beyond threshold, on the approach side)
      // along is measured FROM the threshold; negative = on the runway side (already handled above)
      if (along >= 0 && along <= PRIMARY_EXTENSION_FT) {
        if (lateral <= primaryHW) {
          if (obstRel > 0) {
            bestPen = worsePenetration(bestPen, {
              penetrates: true,
              surfaceType: 'Primary Surface',
              penetrationHeight: obstRel,
            });
          }
        } else if (obstRel > 0 && obstRel < HORIZONTAL_SURFACE_HEIGHT) {
          const transH = (lateral - primaryHW) / 7;
          if (obstRel > transH) {
            bestPen = worsePenetration(bestPen, {
              penetrates: true,
              surfaceType: 'Transitional Surface',
              penetrationHeight: obstRel - transH,
            });
          }
        }
      }

      // Approach surface — trapezoid extending from primary-surface end (beyond the 200 ft extension)
      const approachDist = along - PRIMARY_EXTENSION_FT;   // distance from approach inner edge
      if (approachDist >= 0 && approachDist <= params.length) {
        const halfW     = params.innerHalfWidth + approachDist * params.expansion;
        const surfaceH  = approachHeightAtDist(approachDist, appType);

        if (surfaceH !== null) {
          if (lateral <= halfW) {
            // Inside approach corridor
            if (obstRel > surfaceH) {
              bestPen = worsePenetration(bestPen, {
                penetrates: true,
                surfaceType: 'Approach Surface',
                penetrationHeight: obstRel - surfaceH,
              });
            }
          } else if (obstRel > 0 && obstRel < HORIZONTAL_SURFACE_HEIGHT) {
            // Transitional surface from approach corridor edge (7:1)
            const transH = (lateral - halfW) / 7;
            if (obstRel > transH) {
              bestPen = worsePenetration(bestPen, {
                penetrates: true,
                surfaceType: 'Transitional Surface',
                penetrationHeight: obstRel - transH,
              });
            }
          }
        }
      }
    }
  }

  // ── Horizontal surface — oval shape ───────────────────────────────────────
  // Per §77.25(a), radius = 5 000 ft for utility/visual, 10 000 ft for instrument runways.
  // Oval = union of discs of radius R centered at each primary-surface end, connected by
  // tangent strips.  We approximate by checking distance to each runway-centerline SEGMENT.
  const horizontalRadiusFt = (airportBestApproach === 'VISUAL' || airportBestApproach === 'UTILITY')
    ? 5000 : 10000;

  let insideHorizontal = false;
  for (const [, { ends }] of runwayMap) {
    if (ends.length < 2) continue;
    const { dist } = distToSegmentFt(obsLat, obsLon, ends[0].lat, ends[0].lon, ends[1].lat, ends[1].lon);
    if (dist <= horizontalRadiusFt) { insideHorizontal = true; break; }
  }
  // Also check individual runway-end arcs (handles endpoints precisely)
  if (!insideHorizontal) {
    for (const { ends } of runwayMap.values()) {
      for (const end of ends) {
        const { dx, dy } = latLonToFt(end.lat, end.lon, obsLat, obsLon);
        if (Math.sqrt(dx * dx + dy * dy) <= horizontalRadiusFt) {
          insideHorizontal = true;
          break;
        }
      }
      if (insideHorizontal) break;
    }
  }

  if (insideHorizontal && obstRel > HORIZONTAL_SURFACE_HEIGHT) {
    bestPen = worsePenetration(bestPen, {
      penetrates: true,
      surfaceType: 'Horizontal Surface',
      penetrationHeight: obstRel - HORIZONTAL_SURFACE_HEIGHT,
    });
  }

  // ── Conical surface (§77.25(b)) ───────────────────────────────────────────
  // 20:1 slope extending 4 000 ft beyond the horizontal surface.
  // Approximated as a circle from the ARP — conservative for typical runway lengths
  // relative to the 4 000 ft conical width.
  const conicalOuterRadiusFt = horizontalRadiusFt + 4000;
  if (!insideHorizontal && distanceFt < conicalOuterRadiusFt) {
    // We're outside the horizontal oval but within the conical band.
    // Use radial distance from ARP as a conservative proxy for distance from horizontal edge.
    const radialDistFromHorizontal = Math.max(0, distanceFt - horizontalRadiusFt);
    const conicalH = HORIZONTAL_SURFACE_HEIGHT + radialDistFromHorizontal / 20;
    if (obstRel > conicalH) {
      bestPen = worsePenetration(bestPen, {
        penetrates: true,
        surfaceType: 'Conical Surface',
        penetrationHeight: obstRel - conicalH,
      });
    }
  }

  return {
    penetration:              bestPen ?? { penetrates: false, surfaceType: 'Horizontal Surface' },
    airportBestApproachType:  airportBestApproach,
    horizontalRadiusFt,
    conicalOuterRadiusFt,
  };
}

// ─── Radial Fallback (no NASR runway end data) ────────────────────────────────

/**
 * Conservative radial approximation used when NASR data is unavailable.
 * Checks all Part 77 surfaces using distance from Airport Reference Point.
 */
function radialFallback(
  obstacle: ObstacleInput,
  airport: Airport,
  distanceFt: number,
  obstRel: number,
): AnalysisResult {
  const bestApproach  = getBestApproachTypeForAirport(airport.ident) ?? 'NONPREC';
  const isUtility     = false; // conservative — assume non-utility when no runway data
  const horizontalRadiusFt   = (bestApproach === 'VISUAL' || bestApproach === 'UTILITY') ? 5000 : 10000;
  const conicalOuterRadiusFt = horizontalRadiusFt + 4000;

  let bestPen: SurfacePenetration | null = null;

  // Approach surface — treat distance from ARP as an approximate approach distance
  // (assumes obstacle is roughly along the extended runway centerline)
  const approachDist = Math.max(0, distanceFt - 2500); // rough primary-surface offset
  const approachH    = approachHeightAtDist(approachDist, bestApproach);
  if (approachH !== null && obstRel > approachH) {
    bestPen = worsePenetration(bestPen, {
      penetrates: true,
      surfaceType: 'Approach Surface',
      penetrationHeight: obstRel - approachH,
    });
  }

  // Horizontal surface
  if (distanceFt < horizontalRadiusFt && obstRel > HORIZONTAL_SURFACE_HEIGHT) {
    bestPen = worsePenetration(bestPen, {
      penetrates: true,
      surfaceType: 'Horizontal Surface',
      penetrationHeight: obstRel - HORIZONTAL_SURFACE_HEIGHT,
    });
  }

  // Conical surface
  if (distanceFt >= horizontalRadiusFt && distanceFt < conicalOuterRadiusFt) {
    const conicalH = HORIZONTAL_SURFACE_HEIGHT + (distanceFt - horizontalRadiusFt) / 20;
    if (obstRel > conicalH) {
      bestPen = worsePenetration(bestPen, {
        penetrates: true,
        surfaceType: 'Conical Surface',
        penetrationHeight: obstRel - conicalH,
      });
    }
  }

  return {
    penetration:             bestPen ?? { penetrates: false, surfaceType: 'Horizontal Surface' },
    airportBestApproachType: bestApproach,
    horizontalRadiusFt,
    conicalOuterRadiusFt,
  };
}

// ─── Status Determination ─────────────────────────────────────────────────────

export function determinePenetrationStatus(
  penetration: SurfacePenetration,
): 'penetration' | 'warning' | 'clear' {
  if (!penetration.penetrates) return 'clear';
  return (penetration.penetrationHeight ?? 0) > 25 ? 'penetration' : 'warning';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createPart77Result(
  obstacle: ObstacleInput,
  airport: Airport,
  distanceNM: number,
  index: number,
): Part77Result {
  const { penetration, airportBestApproachType, horizontalRadiusFt, conicalOuterRadiusFt } =
    analyzePart77(obstacle, airport, distanceNM);

  const status = determinePenetrationStatus(penetration);

  return {
    id:                   `${index + 1}`,
    obstacleId:           obstacle.obstacleId,
    nearestAirport:       airport.local_code || airport.ident,
    airportName:          airport.name,
    airportLatitude:      airport.latitude_deg,
    airportLongitude:     airport.longitude_deg,
    distance:             distanceNM,
    obstacleHeight:       obstacle.heightAGL ?? 0,
    obstacleHeightMSL:    obstacle.heightMSL ?? 0,
    surfaceType:          penetration.surfaceType,
    status,
    penetrationHeight:    penetration.penetrationHeight,
    latitude:             obstacle.latitude,
    longitude:            obstacle.longitude,
    horizontalRadiusFt,
    conicalOuterRadiusFt,
    approachType:         airportBestApproachType,
  };
}
