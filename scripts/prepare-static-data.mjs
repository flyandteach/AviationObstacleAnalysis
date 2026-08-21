// One-time data prep: converts the large source CSVs in attached_assets/ into
// small pre-filtered JSON files bundled into the client build. Mirrors the
// filtering that server/services/airportData.ts used to do at request time.
import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const assetsDir = path.join(root, "attached_assets");
const outDir = path.join(root, "client", "src", "data");
mkdirSync(outDir, { recursive: true });

function isMilitaryAirport(name) {
  const militaryKeywords = [
    "air force base", "afb", "air force",
    "army", "aaf", "army airfield",
    "navy", "nas", "naval",
    "marine", "mcas", "marine corps",
    "coast guard", "uscg",
    "joint base", "military",
    "air national guard", "ang", "air natl guard",
  ];
  const lowerName = name.toLowerCase();
  return militaryKeywords.some((k) => lowerName.includes(k));
}

// ── Airports (from FAA NTAD Aviation Facilities CSV) ────────────────────────
const airportsCsvPath = path.join(
  assetsDir,
  "NTAD_Aviation_Facilities_7163558772200366310_1759859539047.csv",
);
const airportsRecords = parse(readFileSync(airportsCsvPath, "utf-8"), {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_quotes: true,
  relax_column_count: true,
});

const airports = airportsRecords
  .filter((row) => {
    if (row.STATE_CODE !== "WA") return false;
    if (row.FACILITY_USE_CODE !== "PU") return false;
    if (row.SITE_TYPE_CODE !== "A") return false;
    if (isMilitaryAirport(row.ARPT_NAME || "")) return false;
    return true;
  })
  .map((row) => ({
    id: row.SITE_NO || row.OBJECTID,
    ident: row.ARPT_ID,
    type: "small_airport",
    name: row.ARPT_NAME,
    latitude_deg: parseFloat(row.LAT_DECIMAL),
    longitude_deg: parseFloat(row.LONG_DECIMAL),
    elevation_ft: row.ELEV ? parseFloat(row.ELEV) : null,
    icao_code: null,
    iata_code: null,
    local_code: row.ARPT_ID,
    iso_region: "US-WA",
  }));

writeFileSync(path.join(outDir, "airports.json"), JSON.stringify(airports));
console.log(`airports.json: ${airports.length} WA public-use airports`);

// ── Runway approach types (small curated CSV) ────────────────────────────────
const approachCsvPath = path.join(
  assetsDir,
  "runway_approach_types.final_1759859516606.csv",
);
const approachRecords = parse(readFileSync(approachCsvPath, "utf-8"), {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const runwayApproachTypes = {};
for (const row of approachRecords) {
  const { AirportID, RunwayEnd, Category } = row;
  if (AirportID && RunwayEnd && Category) {
    runwayApproachTypes[`${AirportID}-${RunwayEnd}`] = Category;
  }
}
writeFileSync(
  path.join(outDir, "runwayApproachTypes.json"),
  JSON.stringify(runwayApproachTypes),
);
console.log(
  `runwayApproachTypes.json: ${Object.keys(runwayApproachTypes).length} entries`,
);

// ── NASR runway-end / runway-length data (already pre-filtered JSON) ────────
for (const file of ["wa_nasr_rwy_ends.json", "wa_nasr_runways.json"]) {
  const data = readFileSync(path.join(assetsDir, file), "utf-8");
  writeFileSync(path.join(outDir, file), data);
  console.log(`${file}: copied (${JSON.parse(data).length} records)`);
}
