# Design Guidelines: FAA Part 77 Obstacle Analysis Application

## Design Approach

**Selected Approach:** Design System - Material Design with Carbon Design principles
**Justification:** This is a utility-focused, data-intensive aviation compliance tool requiring clarity, efficiency, and reliability. Material Design provides excellent data table components while Carbon Design System principles ensure optimal handling of complex enterprise data workflows.

**Key Design Principles:**
- Data clarity and readability above visual flair
- Efficient workflows for technical users
- Professional aviation industry aesthetic
- Immediate access to core functionality
- Clear information hierarchy for analysis results

---

## Core Design Elements

### A. Color Palette

**Primary Colors (Dark Mode):**
- Primary: 210 100% 60% (Aviation Blue - for primary actions, headers)
- Background: 220 15% 12% (Deep Navy - main background)
- Surface: 220 13% 18% (Elevated panels, cards)
- Surface Elevated: 220 12% 22% (Data tables, modals)

**Functional Colors:**
- Success: 142 70% 45% (Safe/No Penetration indicators)
- Warning: 38 92% 50% (Potential issues)
- Error: 0 84% 60% (Surface penetration alerts)
- Info: 199 89% 48% (Analysis information)

**Text & Borders:**
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 70%
- Border: 220 13% 25%
- Border Subtle: 220 13% 20%

### B. Typography

**Font Stack:** 
- Primary: "Inter", system-ui, sans-serif
- Monospace: "JetBrains Mono", "Fira Code", monospace (for data/coordinates)

**Type Scale:**
- Display: 2.25rem (36px), weight 700 - Page titles
- H1: 1.875rem (30px), weight 600 - Section headers
- H2: 1.5rem (24px), weight 600 - Subsection headers
- H3: 1.25rem (20px), weight 500 - Card titles
- Body: 0.875rem (14px), weight 400 - Primary content
- Small: 0.75rem (12px), weight 400 - Supporting text
- Data: 0.8125rem (13px), weight 500, monospace - Numerical data, coordinates

### C. Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16
- Micro spacing: p-2, gap-2 (8px)
- Standard spacing: p-4, gap-4 (16px), m-6 (24px)
- Section spacing: p-8, py-12 (32px, 48px)
- Large gaps: gap-16 (64px)

**Grid System:**
- Container: max-w-7xl mx-auto px-4
- Main content: Full-width with internal padding
- Two-column when beneficial: lg:grid-cols-2 gap-6

### D. Component Library

**Navigation & Header:**
- Fixed top navigation with application title and core actions
- Minimal branding (icon + "FAA Part 77 Analyzer")
- Action buttons for Export/Settings in header
- Subtle border-b for separation

**Data Upload Section:**
- Prominent file upload dropzone with drag-and-drop
- File type indicators (.csv, .xlsx, .xls)
- Upload status with progress feedback
- Clear action buttons (Upload, Clear, Process)

**Analysis Dashboard:**
- Summary cards showing: Total Obstacles Analyzed, Airports Checked, Penetrations Found, Warnings
- Card layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4
- Each card: icon, value (large, bold), label (small, secondary)

**Data Tables:**
- Sticky header with sort indicators
- Zebra striping for row differentiation (subtle: bg-surface vs bg-background)
- Compact row height (py-3) for data density
- Monospace font for coordinates/numerical data
- Color-coded status cells (Success/Warning/Error badges)
- Pagination footer

**Results Display:**
- Two-panel layout: Airport list (left) + Obstacle details (right) on lg screens
- Stack vertically on smaller screens
- Status badges with icons for penetration status
- Distance values in monospace font
- Expandable rows for detailed surface analysis

**Visual Feedback:**
- Loading states: skeleton loaders for tables
- Success/error toasts for operations
- Inline validation for file uploads
- Progress indicators for analysis

**Modals & Overlays:**
- Semi-transparent backdrop (bg-black/50)
- Centered modal with max-w-2xl
- Clear close action (X button + outside click)
- Surface elevated background

### E. Animations

**Minimal, functional animations only:**
- Modal entry: fade + scale (150ms ease-out)
- Table row hover: subtle background transition (100ms)
- Loading spinners for async operations
- NO decorative animations, scroll effects, or flourishes

---

## Application-Specific Patterns

**File Upload Flow:**
- Dropzone with dashed border and upload icon
- Active state on drag-over (border-primary, bg-primary/5)
- File name display after selection
- Processing indicator during analysis

**Analysis Results Hierarchy:**
1. Summary statistics (cards at top)
2. Critical alerts (penetrations) highlighted first
3. Detailed table with all obstacles
4. Export functionality clearly accessible

**Data Visualization:**
- Distance indicators: horizontal bar charts within table cells
- Penetration status: icon + color-coded badge
- Airport proximity: visual distance scale

**No Hero Section - Immediate Utility:**
- Header with title and actions
- Jump straight to upload/analysis interface
- No marketing content or explanatory sections
- Tool-first, documentation-second approach

**Professional Aviation Aesthetic:**
- Cool blue tones suggesting precision and authority
- High contrast for readability
- Data-dense layouts optimized for efficiency
- Clean, technical presentation without decoration