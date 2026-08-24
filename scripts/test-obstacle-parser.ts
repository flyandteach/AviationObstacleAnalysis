import assert from "node:assert/strict";
import { parseObstacleText } from "../server/services/obstacleParser";

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

const markdownPaste = `
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
[2021-ANM-5006-OE](https://oeaaa.faa.gov/oeaaa/asn-display/asn-case-display-page.html?asn=2021-ANM-5006-OE&encryptedID=x)
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
[2026-ANM-456-OE](https://oeaaa.faa.gov/oeaaa/asn-display/asn-case-display-page.html?asn=2026-ANM-456-OE&encryptedID=x)
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

const markdown = parseObstacleText(markdownPaste);
assert.equal(markdown.sourceFormat, "oeaaa-table");
assert.equal(markdown.detectedAsnCount, 2);
assert.equal(markdown.skippedDetermined, 1);
assert.equal(markdown.obstacles.length, 1);
assert.equal(markdown.unparsedLines.length, 0);
assert.equal(markdown.obstacles[0].obstacleId, "2026-ANM-456-OE");
assert.equal(markdown.obstacles[0].heightAGL, 17);
assert.equal(markdown.obstacles[0].heightMSL, 520);
assert.equal(markdown.obstacles[0].type, "Parking");
assert.equal(markdown.obstacles[0].status, "Pending");
assert.ok(Math.abs(markdown.obstacles[0].latitude - 47.65225) < 0.00001);
assert.ok(Math.abs(markdown.obstacles[0].longitude - (-122.7344194)) < 0.00001);

const plainTextPaste = `
ASN
Status
Structure
Duration
City
State
Latitude
Longitude
Elevation
AGL
2021-ANM-5006-OE
Determined - No Hazard
Building
Permanent
Renton
WA
47° 29' 13.00" N
122° 10' 40.10" W
328
30
2026-ANM-456-OE
Pending
Parking
Permanent
Silverdale
WA
47° 39' 08.10" N
122° 44' 03.91" W
503
17
`;

const plain = parseObstacleText(plainTextPaste);
assert.equal(plain.sourceFormat, "oeaaa-table");
assert.equal(plain.detectedAsnCount, 2);
assert.equal(plain.skippedDetermined, 1);
assert.equal(plain.obstacles.length, 1);
assert.equal(plain.unparsedLines.length, 0);
assert.equal(plain.obstacles[0].obstacleId, "2026-ANM-456-OE");
assert.equal(plain.obstacles[0].heightMSL, 520);

const tabPaste = [
  "ASN\tStatus\tStructure\tDuration\tCity\tState\tLatitude\tLongitude\tElevation\tAGL",
  "2026-ANM-456-OE\tPending\tParking\tPermanent\tSilverdale\tWA\t47° 39' 08.10\" N\t122° 44' 03.91\" W\t503\t17",
].join("\n");

const tab = parseObstacleText(tabPaste);
assert.equal(tab.sourceFormat, "oeaaa-table");
assert.equal(tab.obstacles.length, 1);
assert.equal(tab.obstacles[0].heightMSL, 520);

const collapsedPaste = "ASN Status Structure Duration City State Latitude Longitude Elevation AGL 2026-ANM-456-OE Pending Parking Permanent Silverdale WA 47° 39' 08.10\" N 122° 44' 03.91\" W 503 17";
const collapsed = parseObstacleText(collapsedPaste);
assert.equal(collapsed.sourceFormat, "oeaaa-table");
assert.equal(collapsed.obstacles.length, 1);
assert.equal(collapsed.obstacles[0].obstacleId, "2026-ANM-456-OE");
assert.equal(collapsed.obstacles[0].heightMSL, 520);
assert.equal(collapsed.obstacles[0].heightAGL, 17);

// Some clipboard paths include a visible ASN followed by the same ASN again in a raw URL.
// The parser must not treat that duplicate as a second record boundary.
const rawUrlDuplicate = `
2026-ANM-456-OE https://oeaaa.faa.gov/oeaaa/asn-display/asn-case-display-page.html?asn=2026-ANM-456-OE&encryptedID=x
Pending
Parking
Permanent
Silverdale
WA
47° 39' 08.10" N
122° 44' 03.91" W
503
17
`;
const duplicate = parseObstacleText(rawUrlDuplicate);
assert.equal(duplicate.detectedAsnCount, 1);
assert.equal(duplicate.obstacles.length, 1);
assert.equal(duplicate.obstacles[0].obstacleId, "2026-ANM-456-OE");
assert.equal(duplicate.obstacles[0].heightMSL, 520);

const bad = parseObstacleText("this is not obstacle data");
assert.equal(bad.obstacles.length, 0);
assert.equal(bad.unparsedLines.length, 1);

console.log("Obstacle parser regression tests passed.");
