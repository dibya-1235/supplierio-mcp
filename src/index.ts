import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { initAuth, validateToken } from './auth.js';
import { readLastN } from './logger.js';
import { usernameStorage } from './context.js';
import { registerTools } from './tools/searchSuppliers.js';

// --- Startup validation ---
const rawTokens = process.env.VALID_TOKENS;
if (!rawTokens) {
  console.error('FATAL: VALID_TOKENS env var is required');
  process.exit(1);
}
try {
  initAuth(JSON.parse(rawTokens) as Record<string, string>);
} catch {
  console.error('FATAL: VALID_TOKENS must be valid JSON — e.g. {"alice":"tok_abc"}');
  process.exit(1);
}

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error('FATAL: ADMIN_TOKEN env var is required');
  process.exit(1);
}

// --- Session management ---
const transports = new Map<string, StreamableHTTPServerTransport>();

function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'supplierio-mcp', version: '1.0.0' });
  registerTools(server);
  return server;
}

// --- Express error handling ---
function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>
): express.RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

// --- Express ---
const app = express();
app.use(express.json());

// Auth middleware — runs before all /mcp requests
app.use('/mcp', (req, res, next) => {
  const username = validateToken(req.headers.authorization);
  if (!username) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  usernameStorage.run(username, () => next());
});

// MCP endpoint
app.post('/mcp', asyncHandler(async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId) {
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      transports.set(id, transport);
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      transports.delete(transport.sessionId);
    }
  };

  const mcpServer = createMcpServer();
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
}));

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin logs (ADMIN_TOKEN required)
app.get('/admin/logs', asyncHandler(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN!}`) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const entries = await readLastN(100);
  res.json(entries);
}));

// Error handler — catches errors from async routes
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled route error:', err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start
const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
  console.log(`supplierio-mcp listening on port ${PORT}`);
});
