# DataFlow — Data Engineering Workflow Builder

Visual workflow builder for data engineering pipelines. Inspired by the visual
workflow concept of tools like n8n, with its own identity aimed at Data
Engineers: Sources → Ingestion → Processing → Data Quality → Storage →
Consumption.

## Stack

- React + TypeScript + Vite
- React Flow (`@xyflow/react`)
- Plain modern CSS (dark mode by default)

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build    # typecheck + production build
npm run lint     # oxlint
npm run preview  # serve the production build
```

## Current status (foundation)

- Canvas with pan, zoom, minimap, controls, grid background
- Node library sidebar (Sources, Processing, Data Quality, Storage, Orchestration)
- Drag & drop nodes from the library to the canvas
- Custom node component with icon, name, category, description, status and handles
- Connections between nodes (create, select, delete)
- Properties panel for the selected node (visual fields only)
- Header (Save/Execute/Settings placeholders — no execution yet)
- Demo workflow: REST API → Bronze → Silver → Gold

Not implemented yet (by design): backend, persistence, real execution,
orchestration engines, data quality checks, code generation.

## Project structure

```
src/
├── components/
│   ├── canvas/      # React Flow canvas wrapper
│   ├── nodes/       # custom node component + node type mapping
│   ├── sidebar/     # node library
│   ├── panels/      # properties panel
│   ├── layout/      # header + status bar
│   └── icons/       # inline SVG icon set
├── nodes/           # node definitions + registry (one file per category)
├── types/           # shared TypeScript types
├── data/            # demo workflow data
├── hooks/           # workflow state logic
├── utils/           # theme colors, drag & drop helpers
├── pages/           # page compositions
└── styles/          # global tokens and styles
```

## Node registry

Node types are registered as plain data definitions in `src/nodes/*` and
aggregated by `src/nodes/registry.ts`. Adding a new node type requires only a
new definition — the sidebar, canvas, minimap and properties panel pick it up
automatically.
