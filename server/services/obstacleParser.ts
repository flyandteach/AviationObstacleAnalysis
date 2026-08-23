import type { ObstacleInput } from "@shared/schema";

export interface ParsedObstacleText {
  obstacles: ObstacleInput[];
  unparsedLines: Array<{ lineNumber: number; text: string }>;
  skippedDetermined: number;
  sourceFormat: "oeaaa-table" | "rows";
}

interface CoordinateMatch {
  value: number;
  index: number;
  end: number;
  raw: string;
}

const ASN_PATTERN = /\b(\d{4}-[A-Z0-9]{3,4}-\d+-[A-Z0-9]+)\b/gi;

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[º]/g, "°")
    .replace(/[′’`]/g, "'")
    .replace(/[″”]/g, '"');
}

function dmsPartsToDecimal(degrees: number, minutes: number, seconds: number, direction: string): number | null {
  if (![degrees, minutes, seconds].every(Number.isFinite)) return null;
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;
  const max = /[NS]/i.test(direction) ? 90 : 180;
  if (degrees < 0 || degrees > max) return null;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (/[SW]/i.test(direction)) decimal = -decimal;
  return decimal;
}

function coordinateFromText(value: string, latitude: boolean): number | null {
  const normalized = normalizeText(value).trim();
  const hemisphere = latitude ? "NS" : "EW";
  const dmsPatterns = [
    new RegExp(`(\\d{1,3})\\s*(?:°|-)\\s*(\\d{1,2})\\s*(?:'|-)\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*(?:\")?\\s*([${hemisphere}])`, "i"),
    new RegExp(`(\\d{1,3})\\s+(\\d{1,2})\\s+(\\d{1,2}(?:\\.\\d+)?)\\s*([${hemisphere}])`, "i"),
  ];

  for (const pattern of dmsPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const decimal = dmsPartsToDecimal(Number(match[1]), Number(match[2]), Number(match[3]), match[4]);
    if (decimal !== null) return decimal;
  }

  const hemiDecimal = normalized.match(new RegExp(`(-?\\d{1,3}(?:\\.\\d+)?)\\s*°?\\s*([${hemisphere}])`, "i"));
  if (hemiDecimal) {
    let decimal = Math.abs(Number(hemiDecimal[1]));
    const max = latitude ? 90 : 180;
    if (!Number.isFinite(decimal) || decimal > max) return null;
    if (/[SW]/i.test(hemiDecimal[2])) decimal = -decimal;
    return decimal;
  }

  if (/^-?\d{1,3}(?:\.\d+)?$/.test(normalized)) {
    const decimal = Number(normalized);
    const max = latitude ? 90 : 180;
    if (Number.isFinite(decimal) && decimal >= -max && decimal <= max) return decimal;
  }

  return null;
}

function findHemisphereCoordinate(text: string, latitude: boolean, startAt = 0): CoordinateMatch | null {
  const source = normalizeText(text).slice(startAt);
  const hemisphere = latitude ? "NS" : "EW";
  const patterns = [
    new RegExp(`(\\d{1,3})\\s*(?:°|-)\\s*(\\d{1,2})\\s*(?:'|-)\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*(?:\")?\\s*([${hemisphere}])`, "i"),
    new RegExp(`(\\d{1,3})\\s+(\\d{1,2})\\s+(\\d{1,2}(?:\\.\\d+)?)\\s*([${hemisphere}])`, "i"),
    new RegExp(`(-?\\d{1,3}(?:\\.\\d+)?)\\s*°?\\s*([${hemisphere}])`, "i"),
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match || match.index === undefined) continue;
    const value = coordinateFromText(match[0], latitude);
    if (value === null) continue;
    const index = startAt + match.index;
    return { value, index, end: index + match[0].length, raw: match[0] };
  }

  return null;
}

function cleanCell(value: string): string {
  return value
    .trim()
    .replace(/^\|+\s*/, "")
    .replace(/\s*\|+$/, "")
    .replace(/^\*\*(.*?)\*\*$/, "$1")
    .replace(/^__(.*?)__$/, "$1")
    .trim();
}

function isNoiseCell(value: string): boolean {
  const cleaned = value.trim();
  return !cleaned || /^:?-+:?$/.test(cleaned) || /^\|?\s*:?-+:?\s*\|?$/.test(cleaned);
}

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^\n)]+\)/g, "$1");
}

function splitClipboardCells(text: string): string[] {
  return normalizeText(text)
    .split(/\n|\t+/)
    .map(cleanCell)
    .filter(cell => !isNoiseCell(cell));
}

function extractStatus(body: string, cells: string[]): string {
  const known = body.match(/Determined\s*-\s*(?:No\s+Hazard|Hazard)|Determined|Pending|Evaluating|Studying|Circularized|Withdrawn|Terminated/iu);
  if (known) return known[0].replace(/\s+/g, " ").trim();
  return cells[0] ?? "Unknown";
}

function parseOeaaaClipboard(text: string): ParsedObstacleText | null {
  const normalized = stripMarkdownLinks(normalizeText(text));

  ASN_PATTERN.lastIndex = 0;
  const starts: Array<{ index: number; end: number; asn: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = ASN_PATTERN.exec(normalized)) !== null) {
    starts.push({ index: match.index, end: match.index + match[0].length, asn: match[1].toUpperCase() });
  }

  // An FAA ASN is distinctive enough to use as the record delimiter. Do not depend
  // on Markdown, URLs, HTML, or a particular browser clipboard representation.
  if (starts.length === 0) return null;

  const obstacles: ObstacleInput[] = [];
  const unparsedLines: Array<{ lineNumber: number; text: string }> = [];
  let skippedDetermined = 0;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].index : normalized.length;
    const body = normalized.slice(start.end, end);
    const cells = splitClipboardCells(body);

    const latitudeMatch = findHemisphereCoordinate(body, true);
    const longitudeMatch = latitudeMatch ? findHemisphereCoordinate(body, false, latitudeMatch.end) : null;

    if (!latitudeMatch || !longitudeMatch) {
      unparsedLines.push({ lineNumber: i + 1, text: `${start.asn}: latitude/longitude fields were not recognized` });
      continue;
    }

    const beforeLatitude = body.slice(0, latitudeMatch.index);
    const stateMatches = Array.from(beforeLatitude.matchAll(/\b[A-Z]{2}\b/g));
    const state = stateMatches.length ? stateMatches[stateMatches.length - 1][0] : "";

    const afterLongitude = body.slice(longitudeMatch.end);
    const numericAfter = Array.from(afterLongitude.matchAll(/[-+]?\d+(?:\.\d+)?/g))
      .map(item => Number(item[0]))
      .filter(Number.isFinite);

    const siteElevation = numericAfter[0];
    const heightAGL = numericAfter[1];
    const status = extractStatus(body, cells);

    // When cells survive clipboard transfer, the second field is Structure.
    // If the browser collapses the table to a single text run, structure type is
    // intentionally left generic because it does not affect the Part 77 geometry.
    const structure = cells.length >= 6 ? cells[1] : "FAA OE/AAA Structure";

    if (
      !/^[A-Z]{2}$/.test(state) ||
      !Number.isFinite(siteElevation) ||
      !Number.isFinite(heightAGL)
    ) {
      unparsedLines.push({ lineNumber: i + 1, text: `${start.asn}: FAA elevation/AGL fields were incomplete or malformed` });
      continue;
    }

    if (/determined/i.test(status)) {
      skippedDetermined += 1;
      continue;
    }

    obstacles.push({
      id: String(i + 1),
      obstacleId: start.asn,
      latitude: latitudeMatch.value,
      longitude: longitudeMatch.value,
      heightMSL: siteElevation + heightAGL,
      heightAGL,
      type: structure,
      status,
    });
  }

  return { obstacles, unparsedLines, skippedDetermined, sourceFormat: "oeaaa-table" };
}

function parseRow(line: string, index: number): ObstacleInput | null {
  const normalized = normalizeText(line).trim();
  if (!normalized) return null;
  if (/latitude/i.test(normalized) && /longitude/i.test(normalized)) return null;
  if (/determined/i.test(normalized)) return null;

  const latMatch = findHemisphereCoordinate(normalized, true);
  const lonMatch = latMatch ? findHemisphereCoordinate(normalized, false, latMatch.end) : null;

  let latitude: number | null = null;
  let longitude: number | null = null;
  let coordinateEnd = -1;

  if (latMatch && lonMatch) {
    latitude = latMatch.value;
    longitude = lonMatch.value;
    coordinateEnd = lonMatch.end;
  } else {
    const decimalPair = normalized.match(/(-?\d{1,2}(?:\.\d+))\s*[,;\t| ]+\s*(-?\d{1,3}(?:\.\d+))/);
    if (decimalPair && decimalPair.index !== undefined) {
      latitude = coordinateFromText(decimalPair[1], true);
      longitude = coordinateFromText(decimalPair[2], false);
      coordinateEnd = decimalPair.index + decimalPair[0].length;
    }
  }

  if (latitude === null || longitude === null || coordinateEnd < 0) return null;

  const numbers = Array.from(normalized.slice(coordinateEnd).matchAll(/-?\d+(?:\.\d+)?/g)).map(item => Number(item[0]));
  let heightMSL = 0;
  let heightAGL = 0;
  if (numbers.length >= 2) {
    heightMSL = numbers[numbers.length - 2];
    heightAGL = numbers[numbers.length - 1];
  } else if (numbers.length === 1) {
    heightAGL = numbers[0];
  }

  const obstacleId = normalized.split(/[,;\t|\s]+/)[0] || `OBS-${index + 1}`;
  return { id: String(index + 1), obstacleId, latitude, longitude, heightMSL, heightAGL, status: "" };
}

function parseRows(text: string): ParsedObstacleText {
  const obstacles: ObstacleInput[] = [];
  const unparsedLines: Array<{ lineNumber: number; text: string }> = [];
  let skippedDetermined = 0;

  normalizeText(text).split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/determined/i.test(trimmed)) {
      skippedDetermined += 1;
      return;
    }
    if (/latitude/i.test(trimmed) && /longitude/i.test(trimmed)) return;
    const parsed = parseRow(trimmed, index);
    if (parsed) obstacles.push(parsed);
    else unparsedLines.push({ lineNumber: index + 1, text: trimmed.slice(0, 180) });
  });

  return { obstacles, unparsedLines, skippedDetermined, sourceFormat: "rows" };
}

export function parseObstacleText(text: string): ParsedObstacleText {
  return parseOeaaaClipboard(text) ?? parseRows(text);
}
