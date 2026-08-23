import assert from "node:assert/strict";
import { parseObstacleText } from "../server/routes";

function first(text: string) {
  const parsed = parseObstacleText(text);
  assert.equal(parsed.obstacles.length, 1, `Expected one obstacle from: ${text}`);
  return parsed.obstacles[0];
}

const decimal = first("OBS-001,47.4502,-122.3088,485,Tower");
assert.equal(decimal.obstacleId, "OBS-001");
assert.equal(decimal.latitude, 47.4502);
assert.equal(decimal.longitude, -122.3088);
assert.equal(decimal.heightAGL, 485);

const symbolicDms = first(`OBS-002 47° 27' 00.72\" N 122° 18' 31.68\" W 650 120`);
assert.ok(Math.abs(symbolicDms.latitude - 47.4502) < 0.00001);
assert.ok(Math.abs(symbolicDms.longitude - (-122.3088)) < 0.00001);
assert.equal(symbolicDms.heightMSL, 650);
assert.equal(symbolicDms.heightAGL, 120);

const faaDms = first("OBS-003 47-27-00.72N 122-18-31.68W 650 120");
assert.ok(Math.abs(faaDms.latitude - 47.4502) < 0.00001);
assert.ok(Math.abs(faaDms.longitude - (-122.3088)) < 0.00001);

const decimalHemisphere = first("OBS-004 47.4502 N 122.3088 W 485");
assert.equal(decimalHemisphere.latitude, 47.4502);
assert.equal(decimalHemisphere.longitude, -122.3088);
assert.equal(decimalHemisphere.heightAGL, 485);

const withHeader = parseObstacleText(
  "ObstacleID,Latitude,Longitude,Height,Type\nOBS-005,47.6199,-117.5339,328,Building",
);
assert.equal(withHeader.obstacles.length, 1);
assert.equal(withHeader.unparsedLines.length, 0);

const oeaaaPaste = `
**ASN**
|   |
| - |
**Status**
|   |
| - |
**Structure**
|   |
| - |
**Duration**
|   |
| - |
**City**
|   |
| - |
**State**
|   |
| - |
**Latitude**
|   |
| - |
**Longitude**
|   |
| - |
**Elevation**
|   |
| - |
**AGL**
|   |
| - |
[2021-ANM-5006-OE](https://oeaaa.faa.gov/oeaaa/asn-display/asn-case-display-page.html?asn=2021-ANM-5006-OE)
|   |
| - |
Determined - No Hazard
|   |
| - |
Building
|   |
| - |
Permanent
|   |
| - |
Renton
|   |
| - |
WA
|   |
| - |
47° 29' 13.00" N
|   |
| - |
122° 10' 40.10" W
|   |
| - |
328
|   |
| - |
30
|   |
| - |
[2026-ANM-456-OE](https://oeaaa.faa.gov/oeaaa/asn-display/asn-case-display-page.html?asn=2026-ANM-456-OE)
|   |
| - |
Pending
|   |
| - |
Parking
|   |
| - |
Permanent
|   |
| - |
Silverdale
|   |
| - |
WA
|   |
| - |
47° 39' 08.10" N
|   |
| - |
122° 44' 03.91" W
|   |
| - |
503
|   |
| - |
17
`;

const oeaaa = parseObstacleText(oeaaaPaste);
assert.equal(oeaaa.sourceFormat, "oeaaa-table");
assert.equal(oeaaa.skippedDetermined, 1);
assert.equal(oeaaa.obstacles.length, 1);
assert.equal(oeaaa.unparsedLines.length, 0);
assert.equal(oeaaa.obstacles[0].obstacleId, "2026-ANM-456-OE");
assert.equal(oeaaa.obstacles[0].heightAGL, 17);
assert.equal(oeaaa.obstacles[0].heightMSL, 520); // FAA site elevation 503 + 17 AGL
assert.equal(oeaaa.obstacles[0].type, "Parking");
assert.equal(oeaaa.obstacles[0].status, "Pending");
assert.ok(Math.abs(oeaaa.obstacles[0].latitude - 47.65225) < 0.00001);
assert.ok(Math.abs(oeaaa.obstacles[0].longitude - (-122.7344194)) < 0.00001);

const bad = parseObstacleText("this is not obstacle data");
assert.equal(bad.obstacles.length, 0);
assert.equal(bad.unparsedLines.length, 1);

console.log("Obstacle parser regression tests passed.");
