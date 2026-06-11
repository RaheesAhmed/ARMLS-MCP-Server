# contracts
---
## Shared Contracts
Timestamp: 2026-06-11T15:02:29.704Z

- GET /sse — SSE endpoint for Claude to connect
- POST /messages — tool call message endpoint
- GET /health — health check returns {status: ok}
- ENV: SPARK_API_KEY (required), SPARK_BASE_URL (required), PORT (optional, default 3000), ALLOWED_ORIGINS (optional)
- Spark API auth: Authorization: Bearer <SPARK_API_KEY> header on all requests
