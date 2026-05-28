# FAA Part 77 Obstacle Analysis Application

## Overview

This is a specialized aviation compliance tool that analyzes obstacle data against FAA Part 77 imaginary surfaces for Washington State airports. The application helps determine if structures or obstacles penetrate protected airspace around airports by calculating distances to nearest airports and checking against various Part 77 surface types (Approach, Horizontal, Transitional, etc.).

Users can input obstacle data via text/CSV format, and the system processes this against a database of Washington State airports and runways to generate compliance analysis reports with visual map representations.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Updates (October 2025)

### Critical Height Parsing Fix
- **Issue**: Application was not correctly extracting obstacle heights from pasted data
- **Fix**: Implemented proper MSL/AGL height extraction:
  - Second-to-last number in each line = MSL (Mean Sea Level)
  - Last number in each line = AGL (Above Ground Level)
  - Numbers extracted only from AFTER coordinates to avoid coordinate digits
  - Handles AGL-only data by calculating MSL = AGL + airport elevation

### Part 77 Penetration Calculation Fix
- **Issue**: Penetration analysis was using incorrect height comparisons
- **Fix**: Implemented proper MSL-based comparison:
  - obstacleHeightRelativeToAirport = obstacleMSL - airportMSL
  - This is the FAA-correct way to determine if an obstacle penetrates Part 77 surfaces
  - Ensures accurate penetration detection regardless of ground elevation differences

### Airport Without Runways Support
- **Issue**: Airports without runway data were incorrectly marked as "clear"
- **Fix**: Modified Part 77 calculator to:
  - Check horizontal and conical surfaces even when no runways exist
  - Only skip runway-dependent surfaces (primary, approach, transitional)
  - Prevents false negatives for seaplane bases

### Airport Data Source and Filtering
- **Primary source**: FAA NTAD Aviation Facilities CSV (authoritative FAA database)
  - Uses `FACILITY_USE_CODE = 'PU'` — the authoritative FAA field for public vs private use
  - Uses `SITE_TYPE_CODE = 'A'` — fixed-wing airports only (excludes C=seaplane, H=helipad)
  - Uses `STATE_CODE = 'WA'` — Washington state only
- **Excluded**:
  - Private-use airports (FACILITY_USE_CODE ≠ 'PU')
  - Seaplane bases (SITE_TYPE_CODE = 'C')
  - Heliports (SITE_TYPE_CODE ≠ 'A')
  - Military airports by name keyword match
- **Result**: 117 Washington state public-use airports

### Part 77 Surface Calculations (14 CFR §77.25)
- **Approach surface slopes and lengths** per §77.25(d):
  - Utility (any approach type): 20:1, 5,000 ft
  - Other-than-utility visual: 20:1, 5,000 ft
  - Other-than-utility non-precision: 34:1, 10,000 ft
  - Precision (ILS): 50:1 for first 10,000 ft + 40:1 for next 40,000 ft = 50,000 ft total
- **Horizontal surface radius** per §77.25(a):
  - 5,000 ft for utility runways (< 3,200 ft) OR visual runways
  - 10,000 ft for non-precision and precision instrument runways
- **Approach type detection**: Scans all runway ends in curated approach types file
  - Uses `getBestApproachTypeForAirport()` to handle parallel runway designators (14R/L, etc.)
  - Properly identifies BFI, SEA, GEG etc. as precision (PREC) airports

### Airport Identifiers
- **Feature**: Airport identifiers now use FAA local codes instead of ICAO codes
- **Implementation**: 
  - Prefer `local_code` (e.g., S50) over `ident` (e.g., KS50) for display
  - FAA local codes are what pilots typically use for smaller US airports
  - Falls back to `ident` if `local_code` is unavailable
- **Example**: Auburn Municipal Airport displays as "S50" not "KS50"

### Multi-Airport Evaluation (Critical Correctness Fix)
- **Issue**: App was only checking the nearest airport; obstacles between two airports could miss a more restrictive surface
- **Fix**: Now evaluates every airport within 10 NM of each obstacle
  - 10 NM radius covers all Part 77 surfaces: horizontal (≤1.65 NM), conical (≤2.3 NM), precision approach (≤9 NM)
  - Returns the most restrictive (worst-case) result across all airports checked
  - Worst-case priority: penetration > warning > clear; then by penetration depth; then by distance
  - Always falls back to nearest airport if no airports within 10 NM

### Part 77 Surface Visualization on Map
- **Feature**: Horizontal and conical surfaces are now drawn on the interactive map
  - Solid blue circle = horizontal surface (5,000 ft radius for visual/utility, 10,000 ft for instrument)
  - Dashed purple circle = outer edge of conical surface (horizontal + 4,000 ft)
  - Airport popup shows approach type, horizontal radius (NM), and conical outer edge (NM)
- **Limitation**: Approach and transitional surfaces are directional (extend along runway centerline extended) and require runway heading/position data to draw accurately; they are evaluated mathematically but not drawn on the map

### Penetration Depth Reporting
- **Feature**: API now returns `penetrationHeight` — how many feet the obstacle exceeds the penetrating surface
- **Displayed**: Shown in the obstacle popup on the map (e.g. "Penetration depth: 260 ft")

### Airport Markers on Map
- **Feature**: Controlling airport is marked on the interactive map
- **Implementation**:
  - Blue markers with airplane icon show airport locations
  - Airport popup displays identifier, full name, approach type, and surface radii
  - Duplicate airports automatically merged
  - Map legend includes surface ring indicators

### Obstacle Filtering
- **Confirmed**: Application correctly filters "determined" status obstacles
- All other obstacles are analyzed and plotted on map as required

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React with TypeScript via Vite
- Single-page application using Wouter for client-side routing
- Component-based architecture with shadcn/ui design system (New York variant)

**State Management:**
- TanStack Query (React Query) for server state and API data fetching
- Local component state via React hooks
- Custom query client with standardized error handling and fetch patterns

**UI Component Library:**
- Radix UI primitives for accessible, unstyled components
- Tailwind CSS for styling with custom design tokens
- Dark mode by default with Material Design-inspired color system
- Leaflet for interactive map visualizations

**Design System Decisions:**
- Chose Material Design principles for data-heavy, technical aviation application
- Custom color palette optimized for dark mode with aviation blue as primary
- JetBrains Mono/Fira Code monospace fonts for coordinate/data display
- Emphasis on data clarity over visual flair (utility-focused design)

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript
- ESM module system throughout
- Custom Vite integration for development hot-reloading

**API Structure:**
- RESTful endpoint: `/api/analyze-obstacles` (POST)
- Text-based obstacle input parsing (supports DMS coordinate format)
- Synchronous processing with in-memory calculations
- Extracts MSL (Mean Sea Level) and AGL (Above Ground Level) heights from obstacle data
- Filters out obstacles with "determined" status (case-insensitive)

**Business Logic Services:**
- `airportData.ts`: CSV parsing and filtering for Washington State airports/runways (excludes military airports and heliports)
- `distanceCalculator.ts`: Haversine formula implementation for geographic distance calculations
- `part77Calculator.ts`: FAA Part 77 surface penetration analysis following 14 CFR Part 77 regulations

**Data Processing:**
- In-memory storage implementation (MemStorage class)
- CSV data loaded from attached_assets directory
- Real-time obstacle analysis against regulatory surfaces
- MSL-based penetration calculation: obstacleHeightRelativeToAirport = obstacleMSL - airportMSL
- Handles obstacles with both MSL+AGL or AGL-only heights
- Works with airports that have no runway data (checks horizontal/conical surfaces)

### Data Storage

**Database Technology:**
- PostgreSQL via Neon serverless driver
- Drizzle ORM for type-safe database access
- Schema-first approach with Zod validation

**Current Schema:**
- Users table (authentication stub - minimal implementation)
- Airport and runway data loaded from CSV files, not persisted to database
- Analysis results generated on-demand, not stored

**Storage Strategy Decision:**
- Static reference data (airports/runways) loaded from CSV files at runtime
- User-submitted obstacle data processed transiently without persistence
- Lightweight in-memory storage for user sessions
- Database prepared for future authentication/persistence features

### External Dependencies

**Third-Party Services:**
- Neon Database (PostgreSQL serverless hosting)
- No external APIs for obstacle or airport data (self-contained CSV datasets)

**Key Libraries:**
- `@neondatabase/serverless`: Serverless PostgreSQL driver
- `drizzle-orm`: Type-safe ORM with PostgreSQL dialect
- `csv-parse`: CSV file parsing for airport/runway data
- `leaflet` & `@types/leaflet`: Interactive mapping library
- `@tanstack/react-query`: Server state management
- `zod`: Schema validation and type inference
- `react-hook-form` & `@hookform/resolvers`: Form handling with Zod integration

**Asset Management:**
- Airport data: `attached_assets/airports_1759859539048.csv`
- Static assets bundled via Vite
- Leaflet CSS loaded from CDN
- Google Fonts (Inter, JetBrains Mono) loaded externally

**Development Tools:**
- Replit-specific plugins for dev banner and error overlay
- TypeScript for full type safety across stack
- Drizzle Kit for database schema migrations