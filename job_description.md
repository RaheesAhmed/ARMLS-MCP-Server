REMOTE MCP Server for  Real Estate AI Integration (ARMLS Spark API + Claude)

I’m the owner of a real estate brokerage in Maricopa, Arizona and I’m building an internal AI platform for my agents using Claude (by Anthropic). I need a developer to build a small MCP (Model Context Protocol) server that connects our ARMLS MLS data feed to Claude so agents can query live listing data directly in conversation.
What MCP is:
MCP is Anthropic’s open protocol for connecting Claude to external data sources. The server exposes tools that Claude can call during a conversation — think of it as a bridge between Claude and our MLS data. Documentation is at modelcontextprotocol.io.
What needs to be built:
A lightweight MCP server that authenticates with the ARMLS Spark API (FlexMLS Web API) and exposes the following tools to Claude:
	1.	Search active listings by city, zip, price range, property type, status
	2.	Pull comparable sales for a specific address with radius and date range
	3.	Get market statistics by zip or city — median price, DOM, list-to-sale ratio, inventory count
	4.	Look up a specific listing by MLS number
	5.	Pull active vs. sold trend data by area over a time range
	6.	Open house data by area and date range (nice to have)
Technical requirements:
	∙	Node.js or Python — your choice
	∙	MCP protocol compatible with Claude.ai Team connectors
	∙	HTTP/SSE transport (remote server, not local)
	∙	Authenticates with ARMLS Spark API credentials I will supply
	∙	Hosted on Railway, Render, or similar — must be publicly accessible via HTTPS
	∙	Credentials stored as environment variables, never hardcoded
	∙	README with setup steps, environment variables, and instructions for adding new tools
	∙	GitHub repo (private) — full ownership transfers to me
About the ARMLS Spark API:
ARMLS uses the Spark Platform (FlexMLS Web API). Documentation at sparkplatform.com. I have an existing IDX Content License Agreement with ARMLS and am in the process of completing a new data licensing agreement that will authorize this internal back-office use. The developer will need to be listed as a Consultant on the ARMLS Content License Agreement — I handle that process, I just need your name and company.
This is strictly internal:
No public IDX display. No consumer-facing website. Internal back-office tool for agent use only.
Deliverables:
	∙	Working MCP server deployed and accessible via HTTPS
	∙	All tools functional and tested
	∙	README documentation
	∙	Private GitHub repo with full code ownership transferred
	∙	Brief Loom walkthrough showing it working end to end
