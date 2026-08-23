import type { ObstacleInput } from "@shared/schema";

export interface ParsedObstacleText {
  obstacles: ObstacleInput[];
  unparsedLines: Array<{ lineNumber: number; text: string }>;
  skippedDetermined: number;
  sourceFormat: "oeaaa-table" | "rows";
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

function dmsToDecimal(value: string, latitude: boolean): number | null {
  const normalized = normalizeText(value).trim();
  const hemisphere = latitude ? "NS" : "EW";
  const patterns = [
    new RegExp(`(\\d{1,3})\\s*(?:°|-)\\s*(\\d{1,2})\\s*(?:'|-)\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*(?:\")?\\s*([${hemisphere}])`, "i"),
    new RegExp(`(\\d{1,3})\\s+(\\d{1,2})\\s+(\\d{1,2}(?:\\.\\d+)?)\\s*([${hemisphere}])`, "i"),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const degrees = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (![degrees, minutes, seconds].every(Number.isFinite)) continue;
    if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) continue;
    const max = latitude ? 90 : 180;
    if (degrees < 0 || degrees > max) continue;
    let decimal = degrees + minutes / 60 + seconds / 3600;
    if (/[SW]/i.test(match[4])) decimal = -decimal;
    return decimal;
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
  // Keep the visible label and discard the URL. This prevents the ASN from
  // appearing twice when copied through a Markdown-aware client.
  return text.replace(/\[([^\]]+)\]\([^\n)]+\)/g, "$1");
}

function splitClipboardCells(text: string): string[] {
  return normalizeText(text)
    .split(/\n|\t+/)
    .map(cleanCell)
    .filter(cell => !isNoiseCell(cell));
}

function parseOeaaaClipboard(text: string): ParsedObstacleText | null {
  const normalized = stripMarkdownLinks(normalizeText(text));
  const headerText = normalized.toLowerCase();

  // Detect the actual FAA results structure, not a particular clipboard rendering.
  // This works for Markdown, plain text, and tab-delimited browser copies.
  const hasHeaders =
    /\basn\b/i.test(normalized) &&
    /\bstatus\b/i.test(normalized) &&
    /\blatitude\b/i.test(normalized) &&
    /\blongitude\b/i.test(normalized) &&
    /\belevation\b/i.test(normalized) &&
    /\bagl\b/i.test(normalized);

  ASN_PATTERN.lastIndex = 0;
  const starts: Array<{ index: number; end: number; asn: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = ASN_PATTERN.exec(normalized)) !== null) {
    starts.push({ index: match.index, end: match.index + match[0].length, asn: match[1].toUpperCase() });
  }

  if (starts.length === 0 || (!hasHeaders && !headerText.includes("oeaaa.faa.gov"))) return null;

  const obstacles: ObstacleInput[] = [];
  const unparsedLines: Array<{ lineNumber: number; text: string }> = [];
  let skippedDetermined = 0;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].index : normalized.length;
    const body = normalized.slice(start.end, end);
    const cells = splitClipboardCells(body);

    // Expected FAA results columns after ASN:
    // Status, Structure, Duration, City, State, Latitude, Longitude, Elevation, AGL.
    // Locate the coordinate cells semantically so harmless extra clipboard cells do not shift the record.
    const latIndex = cells.findIndex(cell => dmsToDecimal(cell, true) !== null && /[Nn]|^-?\d{1,2}(?:\.\d+)?$/.test(cell));
    const lonIndex = latIndex >= 0
      ? cells.findIndex((cell, idx) => idx > latIndex && dmsToDecimal(cell, false) !== null && /[EeWw]|^-?\d{1,3}(?:\.\d+)?$/.test(cell))
      : -1;

    if (latIndex < 5 || lonIndex <= latIndex) {
      unparsedLines.push({ lineNumber: i + 1, text: `${start.asn}: latitude/longitude fields were not recognized` });
      continue;
    }

    const status = cells[0] ?? "";
    const structure = cells[1] ?? "";
    const state = cells[latIndex - 1] ?? "";
    const latitude = dmsToDecimal(cells[latIndex], true);
    const longitude = dmsToDecimal(cells[lonIndex], false);

    const numericAfter = cells.slice(lonIndex + 1)
      .map(cell => cell.replace(/[^0-9+.-]/g, ""))
      .filter(cell => /^[-+]?\d+(?:\.\d+)?$/.test(cell))
      .map(Number)
      .filter(Number.isFinite);

    const siteElevation = numericAfter[0];
    const heightAGL = numericAfter[1];

    if (
      latitude === null ||
      longitude === null ||
      !/^[A-Z]{2}$/i.test(state) ||
      !Number.isFinite(siteElevation) ||
      !Number.isFinite(heightAGL)
    ) {
      unparsedLines.push({ lineNumber: i + 1, text: `${start.asn}: FAA record fields were incomplete or malformed` });
      continue;
    }

    if (status.toLowerCase().includes("determined")) {
      skippedDetermined += 1;
      continue;
    }

    obstacles.push({
      id: String(i + 1),
      obstacleId: start.asn,
      latitude,
      longitude,
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

  const latDms = normalized.match(/(\d{1,3})\s*(?:°|-)\s*(\d{1,2})\s*(?:'|-)\s*(\d{1,2}(?:\.\d+)?)\s*(?:")?\s*([NS])/i);
  const lonDms = normalized.match(/(\d{1,3})\s*(?:°|-)\s*(\d{1,2})\s*(?:'|-)\s*(\d{1,2}(?:\.\d+)?)\s*(?:")?\s*([EW])/i);

  let latitude: number | null = null;
  let longitude: number | null = null;
  let coordinateEnd = -1;

  if (latDms && lonDms && latDms.index !== undefined && lonDms.index !== undefined) {
    latitude = dmsToDecimal(latDms[0], true);
    longitude = dmsToDecimal(lonDms[0], false);
    coordinateEnd = Math.max(latDms.index + latDms[0].length, lonDms.index + lonDms[0].length);
  } else {
    const decimalPair = normalized.match(/(-?\d{1,2}(?:\.\d+))\s*[,;\t| ]+\s*(-?\d{1,3}(?:\.\d+))/);
    if (decimalPair && decimalPair.index !== undefined) {
      latitude = dmsToDecimal(decimalPair[1], true);
      longitude = dmsToDecimal(decimalPair[2], false);
      coordinateEnd = decimalPair.index + decimalPair[0].length;
    }
  }

  if (latitude === null || longitude === null || coordinateEnd < 0) return null;

  const numbers = Array.from(normalized.slice(coordinateEnd).matchAll(/-?\d+(?:\.\d+)?/g)).map(m => Number(m[0]));
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
