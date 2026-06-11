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
