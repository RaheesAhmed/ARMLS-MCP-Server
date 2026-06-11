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
