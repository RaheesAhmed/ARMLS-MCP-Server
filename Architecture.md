# ARMLS MCP Server — Architecture Guide

> **Audience:** Client / non-technical stakeholder  
> **Purpose:** Understand what was built, how the pieces fit together, and how to extend it.

---

## 1. What Is This Project?

This is a **remote MCP (Model Context Protocol) server** that acts as a bridge between:

- **Claude AI** (Anthropic's AI assistant) — the consumer
- **ARMLS Spark API** — the Arizona Regional MLS real-estate data source

When a user asks Claude a real-estate question like *"Show me 3-bedroom homes under $500k in Scottsdale"*, Claude calls this server, which fetches live data from the ARMLS Spark API and returns structured results back to Claude.

```
User ──► Claude AI ──► [This MCP Server] ──► ARMLS Spark API
                                │
                         Returns real data
                                │
         User ◄── Claude AI ◄──┘
```

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ARMLS MCP Server                         │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  HTTP Layer  │    │  MCP Layer   │    │  Spark Layer │  │
│  │  (Express)   │───►│  (McpServer) │───►│  (Axios)     │  │
│  │              │    │              │    │              │  │
│  │  GET  /sse   │    │  6 Tools     │    │  Spark API   │  │
│  │  POST /msgs  │    │  registered  │    │  REST calls  │  │
│  │  GET  /health│    │              │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐  │
│  │  Config      │    │  Environment Variables           │  │
│  │  (Zod)       │    │  SPARK_API_KEY  (required)       │  │
│  │              │    │  SPARK_BASE_URL (required)       │  │
│  │  Validates   │    │  PORT          (default: 3000)   │  │
│  │  at startup  │    │  ALLOWED_ORIGINS (optional)      │  │
│  └──────────────┘    └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure Explained

```
armls-mcp-server/
│
├── src/                        ← All TypeScript source code
│   ├── index.ts                ← Entry point: starts the HTTP server
│   ├── config.ts               ← Reads & validates environment variables
│   ├── server.ts               ← Creates the MCP server, registers all 6 tools
│   │
│   ├── spark/
│   │   └── client.ts           ← Axios HTTP client for ARMLS Spark API
│   │
│   └── tools/                  ← One file per MCP tool (6 total)
│       ├── searchListings.ts
│       ├── getComparableSales.ts
│       ├── getMarketStatistics.ts
│       ├── getListingByMls.ts
│       ├── getTrendData.ts
│       └── getOpenHouses.ts
│
├── dist/                       ← Compiled JavaScript (auto-generated, do not edit)
│
├── Dockerfile                  ← Container build instructions for deployment
├── .dockerignore               ← Files excluded from Docker image
├── railway.toml                ← Railway.app deployment config
├── render.yaml                 ← Render.com deployment config
│
├── package.json                ← Node.js project config & dependencies
├── tsconfig.json               ← TypeScript compiler settings
├── .env.example                ← Template for required environment variables
├── .gitignore                  ← Files excluded from Git
└── README.md                   ← Setup & usage guide
```

---

## 4. How a Request Flows (Step by Step)

```
Step 1: Claude connects
        Claude AI ──GET /sse──► index.ts
        Server opens a persistent SSE (Server-Sent Events) connection
        A unique sessionId is assigned

Step 2: Claude calls a tool
        Claude ──POST /messages?sessionId=xxx──► index.ts
        The message is routed to the correct SSE session

Step 3: MCP server dispatches the tool
        index.ts ──► server.ts (McpServer)
        McpServer finds the matching tool by name
        Calls the tool's handler function

Step 4: Tool queries Spark API
        tool handler ──► spark/client.ts (Axios)
        Axios sends a GET request to ARMLS Spark API
        Bearer token (SPARK_API_KEY) is attached automatically

Step 5: Data is returned to Claude
        Spark API ──► client.ts ──► tool handler
        Tool maps raw Spark data into clean JSON
        Returns { content: [{ type: 'text', text: JSON }] }
        Claude receives the result and answers the user
```

---

## 5. The 6 MCP Tools

Each tool is a function Claude can call by name. Here is what each one does:

| Tool Name | File | What It Does | Key Inputs |
|-----------|------|-------------|------------|
| `search_listings` | `searchListings.ts` | Search active/pending/closed MLS listings | city, zip, minPrice, maxPrice, propertyType, status |
| `get_comparable_sales` | `getComparableSales.ts` | Find recently sold homes near an address (comps) | address, city, zip, radiusMiles, startDate, endDate |
| `get_market_statistics` | `getMarketStatistics.ts` | Market stats: median price, days on market, inventory | area (zip or city), areaType, propertyType, months |
| `get_listing_by_mls` | `getListingByMls.ts` | Full detail for one listing by MLS number | mlsNumber |
| `get_trend_data` | `getTrendData.ts` | Active vs. sold trend data over time | area, areaType, months |
| `get_open_houses` | `getOpenHouses.ts` | Upcoming open houses by area and date range | area, areaType, startDate, endDate |

### Tool Anatomy (every tool follows the same pattern)

```typescript
// 1. Schema — defines what inputs Claude must provide (validated by Zod)
export const searchListingsSchema = {
  city: z.string().optional(),
  zip:  z.string().optional(),
  ...
};

// 2. Handler — fetches data from Spark API and returns clean JSON
export async function searchListingsHandler(input) {
  const response = await sparkClient.get('/listings', { params: ... });
  const results  = response.data.D.Results.map(mapListing);
  return { content: [{ type: 'text', text: JSON.stringify(results) }] };
}
```

---

## 6. Key Modules Explained

### `src/index.ts` — HTTP Server (Entry Point)
- Starts an **Express** web server on `PORT` (default 3000)
- Handles **CORS** (controls which websites can connect)
- Exposes 3 HTTP endpoints:
  - `GET /sse` — Claude connects here to open a real-time channel
  - `POST /messages` — Claude sends tool call requests here
  - `GET /health` — Returns `{ status: "ok" }` for uptime monitoring
- Manages a **session map** so multiple Claude sessions can run simultaneously

### `src/server.ts` — MCP Server
- Creates the `McpServer` instance (from Anthropic's official SDK)
- Registers all 6 tools with their schemas and handlers
- Each tool registration wraps the handler in a try/catch so errors are returned gracefully to Claude instead of crashing the server

### `src/config.ts` — Configuration Validator
- Uses **Zod** to validate all environment variables at startup
- If `SPARK_API_KEY` or `SPARK_BASE_URL` are missing → server exits immediately with a clear error message
- Prevents silent failures from misconfigured deployments

### `src/spark/client.ts` — Spark API Client
- Creates a pre-configured **Axios** HTTP client
- Automatically attaches `Authorization: Bearer <SPARK_API_KEY>` to every request
- 30-second timeout on all requests
- **Error interceptor** translates Spark API error envelopes into readable error messages
- Exports `SparkResponse<T>` and `SparkListing` TypeScript types used by all tools

---

## 7. Data Flow Diagram

```
Claude AI
    │
    │  GET /sse  (open connection)
    ▼
┌─────────────────────────────────────┐
│  index.ts (Express HTTP Server)     │
│  - Creates new McpServer instance   │
│  - Assigns sessionId                │
│  - Stores transport in Map          │
└──────────────┬──────────────────────┘
               │
               │  POST /messages (tool call arrives)
               ▼
┌─────────────────────────────────────┐
│  server.ts (McpServer)              │
│  - Routes call to correct tool      │
│  - Validates input with Zod schema  │
└──────────────┬──────────────────────┘
               │
               │  calls handler function
               ▼
┌─────────────────────────────────────┐
│  tools/*.ts (Tool Handler)          │
│  - Builds Spark API filter string   │
│  - Calls sparkClient.get(...)       │
│  - Maps raw data to clean JSON      │
└──────────────┬──────────────────────┘
               │
               │  GET /listings (with Bearer token)
               ▼
┌─────────────────────────────────────┐
│  ARMLS Spark API (external)         │
│  Returns: { D: { Results: [...] } } │
└──────────────┬──────────────────────┘
               │
               │  JSON response
               ▼
┌─────────────────────────────────────┐
│  spark/client.ts (Axios)            │
│  - Error interceptor runs           │
│  - Returns data or throws Error     │
└──────────────┬──────────────────────┘
               │
               │  { content: [{ type: 'text', text: '...' }] }
               ▼
           Claude AI  ──►  User
```

---

## 8. Technology Stack

| Technology | Version | Role |
|-----------|---------|------|
| **Node.js** | 20 (LTS) | Runtime environment |
| **TypeScript** | 5.8 | Type-safe JavaScript |
| **Express** | 4.x | HTTP web server |
| **@modelcontextprotocol/sdk** | 1.29.0 | Official MCP server library (Anthropic) |
| **Axios** | 1.9 | HTTP client for Spark API calls |
| **Zod** | 4.4 | Runtime schema validation |
| **dotenv** | 16 | Loads `.env` file into `process.env` |

---

## 9. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPARK_API_KEY` | ✅ Yes | — | Your ARMLS Spark API bearer token |
| `SPARK_BASE_URL` | ✅ Yes | — | Spark API base URL (e.g. `https://sparkapi.com/v1`) |
| `PORT` | No | `3000` | Port the HTTP server listens on |
| `ALLOWED_ORIGINS` | No | `*` (all) | Comma-separated list of allowed CORS origins |

---

## 10. Deployment Overview

The server is containerized with **Docker** and can be deployed to any cloud platform.

```
Local Machine
    │
    │  npm run build  →  compiles TypeScript to dist/
    │  docker build   →  creates container image
    ▼
Docker Image
    │
    ├──► Railway.app  (railway.toml)
    │    - Auto-deploys on git push
    │    - Health check: GET /health every 30s
    │
    └──► Render.com   (render.yaml)
         - Web service, port 3000
         - Health check: GET /health
```

**Dockerfile stages:**
1. **Builder stage** — installs all deps, compiles TypeScript → `dist/`
2. **Production stage** — copies only `dist/` + production deps, runs as non-root user for security

---

## 11. How to Add a New Tool

Adding a new MCP tool requires changes to **2 files only**:

### Step 1 — Create `src/tools/myNewTool.ts`
```typescript
import { z } from 'zod';
import { sparkClient } from '../spark/client';

// Define inputs Claude must provide
export const myNewToolSchema = {
  area: z.string().describe('ZIP code or city'),
};

// Fetch data and return clean JSON
export async function myNewToolHandler(input) {
  const response = await sparkClient.get('/some-endpoint', { params: { ... } });
  return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
}
```

### Step 2 — Register in `src/server.ts`
```typescript
import { myNewToolSchema, myNewToolHandler } from './tools/myNewTool';

// Inside createMcpServer():
server.tool('my_new_tool', 'Description for Claude', myNewToolSchema, myNewToolHandler);
```

That's it. No other files need to change.

---

## 12. Security Notes

- **API key** is never hardcoded — always injected via environment variable
- **CORS** is configurable — restrict `ALLOWED_ORIGINS` in production
- **Docker** runs as non-root user (`node`) for container security
- **Zod validation** rejects malformed inputs before they reach the Spark API
- **Error interceptor** never leaks raw Spark API internals to Claude — only clean messages

---

*Generated: June 2026 | Project: ARMLS MCP Server*
