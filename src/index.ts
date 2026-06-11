import express, { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { config } from './config';
import { createMcpServer } from './server';

const app = express();

// Parse JSON bodies for POST /messages
app.use(express.json());

// CORS middleware
const allowedOrigins = config.ALLOWED_ORIGINS
  ? config.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

if (allowedOrigins.length === 0) {
  console.warn(
    '\u26a0\ufe0f  ALLOWED_ORIGINS is not set — allowing all origins (*). '
    + 'Set ALLOWED_ORIGINS in production for security.'
  );
}

app.use((req: Request, res: Response, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SSE transport map — one transport per SSE connection
const transports = new Map<string, SSEServerTransport>();

// GET /sse — Claude connects here
app.get('/sse', async (req: Request, res: Response) => {
  const mcpServer = createMcpServer();
  const transport = new SSEServerTransport('/messages', res);

  transports.set(transport.sessionId, transport);

  transport.onclose = () => {
    transports.delete(transport.sessionId);
    console.log(`[SSE] Session closed: ${transport.sessionId}`);
  };

  transport.onerror = (err: Error) => {
    console.error(`[SSE] Transport error (${transport.sessionId}):`, err.message);
  };

  console.log(`[SSE] New connection: ${transport.sessionId} from ${req.ip ?? 'unknown'}`);

  try {
    await mcpServer.connect(transport);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[SSE] Failed to connect MCP server to transport:', message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish MCP connection' });
    }
  }
});

// POST /messages — Claude sends tool call messages here
app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query['sessionId'] as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId query parameter' });
    return;
  }

  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: `No active SSE session found for sessionId: ${sessionId}` });
    return;
  }

  try {
    await transport.handlePostMessage(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[POST /messages] Error handling message for session ${sessionId}:`, message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process message' });
    }
  }
});

// Start server
const port = parseInt(config.PORT, 10);
const maskedKey = config.SPARK_API_KEY.slice(0, 4) + '****' + config.SPARK_API_KEY.slice(-4);

app.listen(port, () => {
  console.log(`\n\u2705 ARMLS MCP Server running on port ${port}`);
  console.log(`   Spark API: ${config.SPARK_BASE_URL}`);
  console.log(`   API Key:   ${maskedKey}`);
  console.log(`   Endpoints: GET /sse | POST /messages | GET /health\n`);
});

export { app };
