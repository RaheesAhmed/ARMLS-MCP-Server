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
