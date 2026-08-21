# Self-hosting Aviation Obstacle Analysis

This branch removes the Replit runtime dependency and can be hosted anywhere that can run Docker or Node.js 20.

## Fastest option: Docker Compose

Requirements:
- Docker Desktop (Windows/macOS) or Docker Engine + Compose (Linux)
- This repository cloned locally

Run:

```bash
git checkout self-hosted-app
docker compose up -d --build
```

Open:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/healthz
```

Stop the app:

```bash
docker compose down
```

Update after pulling changes:

```bash
git pull
docker compose up -d --build
```

## Run directly with Node.js

Requirements:
- Node.js 20+
- npm

Install and develop:

```bash
npm ci
npm run dev
```

Production build:

```bash
npm ci
npm run build
```

On Linux/macOS, start production with:

```bash
NODE_ENV=production npm start
```

The Docker option is recommended because it sets the production environment consistently across operating systems.

## Hosting on another computer or server

The application listens on port 5000 by default. Docker Compose exposes that port to the host. On a LAN, browse to:

```text
http://SERVER_IP:5000
```

For internet-facing use, put the application behind a reverse proxy such as Caddy, Nginx, or Traefik and enable HTTPS. Do not expose an administrative Docker socket or other host services to the application.

## Input supported by the self-hosted UI

The application accepts:
- pasted obstacle text in the format already supported by the analysis API
- CSV files containing text rows in that same recognizable format
- TXT files containing those rows

The parser currently expects latitude/longitude in DMS notation and extracts the obstacle identifier plus elevation values from each row. Rows containing the word `Determined` are skipped, matching the existing behavior.

## Output

The application provides:
- controlling airport and distance
- evaluated Part 77 surface
- clear / warning / penetration status
- penetration depth where applicable
- interactive map
- CSV export of the analyzed results

## Data and scope

The current dataset and airport filtering are Washington-specific. The application uses the FAA/NTAD and NASR-derived files already bundled in `attached_assets` and evaluates nearby public-use, non-military Washington airports.

The calculation engine evaluates primary, approach, transitional, horizontal, and conical surfaces. Directional approach calculations use runway-end geometry where NASR data are available and fall back to a conservative radial method when they are not.

## Important limitation

This application is a planning and screening aid. It is not an FAA aeronautical study, obstruction evaluation, determination of hazard/no hazard, or substitute for filing with the FAA when notice is required under 14 CFR Part 77.

## Main application files

- `server/routes.ts` — obstacle parsing and multi-airport analysis
- `server/services/part77Calculator.ts` — Part 77 geometry and penetration calculations
- `server/services/airportData.ts` — Washington airport/runway datasets
- `client/src/pages/Home.tsx` — input, results, upload, export flow
- `client/src/components/ObstacleMap.tsx` — map display
- `Dockerfile` / `docker-compose.yml` — self-hosting
