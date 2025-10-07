# FAA Part 77 Obstacle Analysis Application

## Overview

This is a specialized aviation compliance tool that analyzes obstacle data against FAA Part 77 imaginary surfaces for Washington State airports. The application helps determine if structures or obstacles penetrate protected airspace around airports by calculating distances to nearest airports and checking against various Part 77 surface types (Approach, Horizontal, Transitional, etc.).

Users can input obstacle data via text/CSV format, and the system processes this against a database of Washington State airports and runways to generate compliance analysis reports with visual map representations.

## User Preferences

Preferred communication style: Simple, everyday language.

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

**Business Logic Services:**
- `airportData.ts`: CSV parsing and filtering for Washington State airports/runways
- `distanceCalculator.ts`: Haversine formula implementation for geographic distance calculations
- `part77Calculator.ts`: FAA Part 77 surface penetration analysis following 14 CFR Part 77 regulations

**Data Processing:**
- In-memory storage implementation (MemStorage class)
- CSV data loaded from attached_assets directory
- Real-time obstacle analysis against regulatory surfaces

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