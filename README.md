# ARMLS MCP Server

A remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that bridges the **ARMLS Spark API** (FlexMLS Web API) with **Claude AI**. Built for real estate agents in Maricopa County, AZ.

[![Built by SAJICODE](https://img.shields.io/badge/Built%20by-SAJICODE-blue?style=for-the-badge&logo=github)](https://github.com/RaheesAhmed/SajiCode)

## Overview

This server exposes 6 MCP tools that Claude can call to query live MLS data:

| Tool | Description |
|------|-------------|
| `search_listings` | Search active MLS listings by city, zip, price range, property type |
| `get_comparable_sales` | Pull comp sales near an address with radius and date range |
| `get_market_statistics` | Market stats: median price, DOM, list-to-sale ratio, inventory |
| `get_listing_by_mls` | Look up a specific listing by MLS number |
| `get_trend_data` | Active vs. sold trend data by area over a time range |
| `get_open_houses` | Upcoming open houses by area and date range |

**Transport:** HTTP/SSE (remote server — works with Claude.ai Team connectors)

---

## Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org)
- **ARMLS Spark API credentials** — Obtain from [sparkplatform.com](https://sparkplatform.com) or your ARMLS/FlexMLS account
- An npm account (for publishing, optional)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/RaheesAhmed/ARMLS-MCP-Server.git
cd armls-mcp-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
SPARK_API_KEY=your_actual_api_key
SPARK_BASE_URL=https://sparkapi.com/v1
PORT=3000
ALLOWED_ORIGINS=https://claude.ai
```

### 4. Build

```bash
npm run build
```

### 5. Start

```bash
npm start
```

You should see:
```
✅ ARMLS MCP Server running on port 3000
   Spark API: https://sparkapi.com/v1
   API Key:   your****_key
   Endpoints: GET /sse | POST /messages | GET /health
```

---

## Environment Variables

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `SPARK_API_KEY` | ✅ Yes | — | ARMLS Spark API bearer token | `abc123xyz...` |
| `SPARK_BASE_URL` | ✅ Yes | — | Spark API base URL | `https://sparkapi.com/v1` |
| `PORT` | No | `3000` | HTTP server port | `3000` |
| `ALLOWED_ORIGINS` | No | `""` (all) | Comma-separated CORS origins | `https://claude.ai` |

> ⚠️ **Security:** Always set `ALLOWED_ORIGINS` in production. Leaving it empty allows all origins.

---

## Available Tools

### `search_listings`
Search active MLS listings by city, zip code, price range, property type, and status.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `city` | string | No | — | City name |
| `zip` | string | No | — | ZIP code |
| `minPrice` | number | No | — | Minimum price |
| `maxPrice` | number | No | — | Maximum price |
| `propertyType` | enum | No | — | `Residential`, `Condo`, `Townhouse`, `Land`, `Commercial`, `MultiFamily` |
| `status` | enum | No | `Active` | `Active`, `Pending`, `Closed` |
| `limit` | number | No | `20` | Max results (1–100) |

> Note: At least one of `city` or `zip` is required.

---

### `get_comparable_sales`
Get comparable sold properties near a specific address.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `address` | string | ✅ | — | Street address |
| `city` | string | ✅ | — | City |
| `zip` | string | ✅ | — | ZIP code |
| `radiusMiles` | number | No | `0.5` | Search radius in miles (0.1–5) |
| `startDate` | string | No | 6 months ago | ISO date (YYYY-MM-DD) |
| `endDate` | string | No | today | ISO date (YYYY-MM-DD) |
| `limit` | number | No | `10` | Max results (1–50) |

---

### `get_market_statistics`
Get market statistics for a zip code or city.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `area` | string | ✅ | — | ZIP code or city name |
| `areaType` | enum | No | `zip` | `zip` or `city` |
| `propertyType` | enum | No | All | Property type filter |
| `months` | number | No | `3` | Analysis period in months (1–12) |

**Returns:** `medianListPrice`, `medianSoldPrice`, `avgDaysOnMarket`, `listToSaleRatio`, `activeListings`, `soldLast30Days`, `newListingsLast30Days`

---

### `get_listing_by_mls`
Look up a specific MLS listing by its MLS number.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mlsNumber` | string | ✅ | The MLS number |

**Returns:** Full listing detail including address, price, beds/baths, sqft, photos, agent info, coordinates.

---

### `get_trend_data`
Get active vs. sold listing trend data for an area over a time range.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `area` | string | ✅ | — | ZIP code or city name |
| `areaType` | enum | No | `zip` | `zip` or `city` |
| `startDate` | string | No | 12 months ago | ISO date |
| `endDate` | string | No | today | ISO date |
| `interval` | enum | No | `monthly` | `monthly` or `weekly` |

**Returns:** Array of `{ period, activeCount, soldCount, medianPrice, avgDaysOnMarket }`

---

### `get_open_houses`
Get upcoming open houses by area and date range.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `area` | string | ✅ | — | ZIP code or city name |
| `areaType` | enum | No | `zip` | `zip` or `city` |
| `startDate` | string | No | today | ISO date |
| `endDate` | string | No | 2 weeks from today | ISO date |
| `limit` | number | No | `20` | Max results (1–100) |

---

## How to Add a New Tool

Follow these steps to add a new MCP tool:

### Step 1: Create the tool file

Create `src/tools/myNewTool.ts`:

```typescript
import { z } from 'zod';
import { sparkClient, SparkResponse } from '../spark/client';

// 1. Define the Zod input schema (raw shape — NOT z.object())
export const myNewToolSchema = {
  area: z.string().min(1).describe('ZIP code or city name'),
  limit: z.number().int().min(1).max(100).default(20),
};

// 2. Infer the TypeScript type from the schema
export type MyNewToolInput = z.infer<z.ZodObject<typeof myNewToolSchema>>;

// 3. Implement the handler
export async function myNewToolHandler(
  input: MyNewToolInput
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const response = await sparkClient.get<SparkResponse<unknown>>('/some-endpoint', {
    params: { _filter: `PostalCode Eq '${input.area}'`, _limit: input.limit },
  });

  const results = response.data.D.Results ?? [];

  return {
    content: [{ type: 'text', text: JSON.stringify({ count: results.length, results }, null, 2) }],
  };
}
```

### Step 2: Register the tool in `src/server.ts`

```typescript
import { myNewToolSchema, myNewToolHandler } from './tools/myNewTool';

// Inside createMcpServer(), add:
server.tool(
  'my_new_tool',
  'Description of what this tool does',
  myNewToolSchema,
  async (input) => {
    try {
      return await myNewToolHandler(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
    }
  }
);
```

### Step 3: Build and test

```bash
npm run build
npm start
```

---

## Connecting to Claude.ai Team

1. Deploy the server (see [Deployment](#deployment) below)
2. In Claude.ai Team, go to **Settings → Integrations → MCP Servers**
3. Click **Add MCP Server**
4. Enter your server URL: `https://your-server.railway.app/sse`
5. Claude will automatically discover all 6 tools

---

## Local Development

```bash
# Start with hot reload
npm run dev

# Type check without building
npm run typecheck

# Build
npm run build
```

The dev server uses `nodemon` to watch for file changes and restart automatically.

---

## Deployment

### Railway (Recommended)

1. Install the [Railway CLI](https://docs.railway.app/develop/cli): `npm install -g @railway/cli`
2. Login: `railway login`
3. Create a new project: `railway init`
4. Set environment variables in the Railway dashboard:
   - `SPARK_API_KEY`
   - `SPARK_BASE_URL`
   - `ALLOWED_ORIGINS=https://claude.ai`
5. Deploy: `railway up`
6. Your server URL will be: `https://<project>.railway.app`

### Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repository
3. Set:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Add environment variables in the Render dashboard
5. Deploy

### Docker

A `Dockerfile` is included for containerized deployments:

```bash
docker build -t armls-mcp-server .
docker run -p 3000:3000 \
  -e SPARK_API_KEY=your_key \
  -e SPARK_BASE_URL=https://sparkapi.com/v1 \
  armls-mcp-server
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sse` | GET | SSE connection endpoint for Claude |
| `/messages` | POST | Tool call message endpoint (requires `?sessionId=`) |
| `/health` | GET | Health check — returns `{ status: "ok", timestamp }` |

---

## Architecture

```
Claude.ai (Team Connector)
        │
        │  HTTP/SSE
        ▼
┌─────────────────────────────────────┐
│         ARMLS MCP Server            │
│  (Node.js + TypeScript + Express)   │
│                                     │
│  GET  /sse      ← SSE connection    │
│  POST /messages ← Tool calls        │
│  GET  /health   ← Health check      │
│                                     │
│  MCP Server (SDK) + 6 Tools         │
└─────────────────────────────────────┘
        │
        │  HTTPS REST
        ▼
┌─────────────────────────────────────┐
│   ARMLS Spark API (sparkplatform)   │
│   /listings, /openhouses, etc.      │
└─────────────────────────────────────┘
```

---

## License

ISC
