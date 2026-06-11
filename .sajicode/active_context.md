# Active Context

Updated: 2026-06-11T15:02:29.673Z
Project: D:\year_2026\upwork_job
Phase: building

## Current Task
Build a remote MCP server for ARMLS Spark API integration with Claude AI

## Agent Assignments
## mcp-specialist
Role: MCP Server Builder
### Task
Scaffold Node.js/TypeScript project, build MCP server core with HTTP/SSE transport, implement all 6 ARMLS Spark API tools
### Files
- src/index.ts
- src/config.ts
- src/server.ts
- src/spark/client.ts
- src/tools/searchListings.ts
- src/tools/getComparableSales.ts
- src/tools/getMarketStatistics.ts
- src/tools/getListingByMls.ts
- src/tools/getTrendData.ts
- src/tools/getOpenHouses.ts
- package.json
- tsconfig.json
- .env.example
- README.md
### Constraints
- TypeScript strict mode
- Use @modelcontextprotocol/sdk SSEServerTransport
- Zod validation on all tool inputs
- No hardcoded credentials
- All env vars via config.ts
- Express for HTTP layer
- Axios for Spark API calls
### Verification
npx tsc --noEmit
## deploy-lead
Role: DevOps
### Task
Write Dockerfile, railway.toml, and render.yaml for deploying the MCP server
### Files
- Dockerfile
- railway.toml
- render.yaml
- .dockerignore
### Constraints
- Node.js 20 Alpine base image
- Expose PORT env var
- Health check on /health endpoint
- No secrets in Dockerfile
### Verification
docker build succeeds

## PM Notes
- Project root: D:\year_2026\upwork_job
- This is a NEW project — scaffold from scratch with npm init
- MCP SDK package: @modelcontextprotocol/sdk
- Spark API base URL example: https://sparkapi.com/v1
- ARMLS Spark API docs: sparkplatform.com
- Internal tool only — no public IDX display
- README must include: setup steps, env vars table, how to add new tools guide

## PM Already Read
None

## Existing Plan Snapshot
# ARMLS MCP Server — Build Plan

## Goal
Build a remote MCP (Model Context Protocol) server that connects ARMLS Spark API (FlexMLS Web API) to Claude AI. Internal tool for real estate agents in Maricopa, AZ.

## Success Criteria
- [ ] MCP server runs with HTTP/SSE transport (remote, not stdio)
- [ ] All 6 tools implemented and validated with Zod
- [ ] Authenticates with ARMLS Spark API via env vars
- [ ] Deployable to Railway/Render via Dockerfile
- [ ] README with setup, env vars, and "how to add new tools" guide
- [ ] TypeScript strict mode, no hardcoded credentials
- [ ] Compatible with Claude.ai Team connectors

## Tools to Implement
1. `search_listings` — Search active listings by city, zip, price range, property type, status
2. `get_comparable_sales` — Pull comp sales for an address with radius and date range
3. `get_market_statistics` — Market stats by zip/city: median price, DOM, list-to-sale ratio, inventory
4. `get_listing_by_mls` — Look up a specific listing by MLS number
5. `get_trend_data` — Active vs. sold trend data by area over a time range
6. `get_open_houses` — Open house data by area and date range (nice to have)

## Task Breakdown
| Phase | Agent | Task |
|-------|-------|------|
| 1 | mcp-specialist | Scaffold project, build server core + all 6 tools |
| 2 | deploy-lead | Dockerfile + railway.toml + render.yaml |
| 3 | review-agent | Final quality gate |

## File Structure
```
D:\year_2026\upwork_job\
├── src/
│   ├── index.ts              # Entry point, Express + SSE setup
│   ├── config.ts             # Env var validation (Zod)
│   ├── server.ts             # MCP server instance + tool registration
│   ├── spark/
│   │   └── client.ts         # Axios client for ARMLS Spark API
│   └── tools/
│       ├── searchListings.ts
│       ├── getComparableSales.ts
│       ├── getMarketStatistics.ts
│       ├── getListingByMls.ts
│       ├── getTrendData.ts
│       └── getOpenHouses.ts
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── railway.toml
├── render.yaml
└── README.md
```


## Existing Architecture Snapshot
# ARMLS MCP Server — Architecture

## System Diagram

```
Claude.ai (Team Connector)
        │
        │  HTTP/SSE  (HTTPS)
        ▼
┌─────────────────────────────────────────┐
│         ARMLS MCP Server                │
│  (Node.js + TypeScript + Express)       │
│                                         │
│  GET  /sse      ← SSE connection        │
│  POST /messages ← Tool call messages    │
│  GET  /health   ← Health check          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   MCP Server (SDK)              │    │
│  │   Tool Registry (6 tools)       │    │
│  └─────────────────────────────────┘    │
│                │                        │
│  ┌─────────────▼──────────────────┐    │
│  │   Spark API Client (Axios)     │    │
│  │   Auth: Bearer token (env var) │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
        │
        │  HTTPS REST
        ▼
┌─────────────────────────────────────────┐
│   ARMLS Spark API (sparkplatform.com)   │
│   FlexMLS Web API                       │
│   Endpoints: /listings, /openhouses,    │
│   /statistics, etc.                     │
└─────────────────────────────────────────┘
```

## Transport: HTTP/SSE
- `GET /sse` — Claude connects here, receives SSE stream
- `POST /messages` — Claude sends tool call requests here
- Uses `@modelcontextprotocol/sdk` SSEServerTransport

## Auth Flow
1. Server reads `SPARK_API_KEY` from env at startup
2. Config.ts validates all required env vars with Zod — fails fast if missing
3. Spark client attaches `Authorization: Bearer <token>` to every request

## Tool Input Validation
All tool inputs validated with Zod schemas before any API call.
Invalid inputs return MCP error response immediately.

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `SPARK_API_KEY` | ✅ | ARMLS Spark API bearer token |
| `SPARK_BASE_URL` | ✅ | Spark API base URL (e.g. https://sparkapi.com/v1) |
| `PORT` | optional | Server port (default: 3000) |
| `ALLOWED_ORIGINS` | optional | CORS allowed origins (comma-separated) |

## Key Decisions
- **No database** — stateless proxy, all data from Spark API
- **Zod** for runtime validation (not just TypeScript types)
- **SSEServerTransport** from MCP SDK (not StreamableHTTP — SSE is more compatible with Claude.ai Team connectors)
- **Express** for HTTP layer (lightweight, well-understood)
- **Axios** for Spark API calls (interceptors for auth + error handling)


## Project Log Snapshot
No project log yet.

## PRD Snapshot
No PRD.MD found.
