
# Architecture V2: Visual Document Editor

A complete rewrite of the Report Designer to match Canva/Figma-like capabilities.

## Core Pillars

### 1. Unified Rendering Engine
`ReportRendererCore.tsx` is the single source of truth for rendering elements.
- Used by **Designer** (wrapped in interactables).
- Used by **Preview** (modal).
- Used by **PDF/Print** (browser print engine).

### 2. Schema-Based State
All documents are strictly typed JSON objects (`ReportSchema.ts`).
- `PageFormat`: 'A4' | 'Thermal80' | ...
- `Layer`: 'text' | 'image' | 'shape' | ...
- `Style`: CSS-subset for visual properties.

### 3. Interactive Designer
`ReportDesigner.tsx` provides:
- **Canvas**: Zoomable, scalable, grid-enabled workspace.
- **Layers**: Drag, drop, resize, select.
- **Tools**: Text, Image (Upload/URL), Box, Line, Table.
- **Properties**: Right sidebar for contextual editing.

## Key Features

- **True WYSIWYG**: What you see in the designer is exactly what prints.
- **Data Binding**: Elements can bind to `patient.name`, `report.date`, etc.
- **Thermal Support**: Auto-height pages for receipt printers.
- **Vector Output**: Printing uses browser vectors, not screenshots.

## Usage

1. Open **Settings > Report Designer**.
2. Select **Paper Size** (A4 / Thermal).
3. Drag elements from the left toolbar.
4. Edit properties on the right.
5. Click **Save** to persist (Firestore).
