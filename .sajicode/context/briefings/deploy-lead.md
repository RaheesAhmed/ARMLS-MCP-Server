# Briefing: deploy-lead

Updated: 2026-06-11T15:02:29.673Z
Project: D:\year_2026\upwork_job

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

## Shared Decisions
# decisions
---
## PM Decisions
Timestamp: 2026-06-11T15:02:29.690Z

- Use Node.js + TypeScript (not Python) for MCP SDK compatibility
- HTTP/SSE transport via @modelcontextprotocol/sdk SSEServerTransport (not stdio, not StreamableHTTP)
- Express.js for HTTP layer
- Axios for Spark API HTTP client with auth interceptor
- Zod for runtime input validation on all tool inputs
- Stateless design — no database, pure API proxy
- Config.ts validates all required env vars at startup with Zod — fail fast
- Deploy to Railway (primary) with Render as alternative


## Shared Contracts
# contracts
---
## Shared Contracts
Timestamp: 2026-06-11T15:02:29.704Z

- GET /sse — SSE endpoint for Claude to connect
- POST /messages — tool call message endpoint
- GET /health — health check returns {status: ok}
- ENV: SPARK_API_KEY (required), SPARK_BASE_URL (required), PORT (optional, default 3000), ALLOWED_ORIGINS (optional)
- Spark API auth: Authorization: Bearer <SPARK_API_KEY> header on all requests


## Files And Docs PM Already Read
No read index yet.

## Instructions
- Start by calling read_team_context with your agentName.
- Do not reread PM-read docs unless this briefing says the details are missing.
- Write complete production code only.
- Update agent memory, project log, and handoff notes when done.
