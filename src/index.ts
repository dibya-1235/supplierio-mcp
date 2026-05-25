import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { initAuth, validateToken } from './auth.js';
import { initUsers, hashPassword } from './users.js';
import { registerOAuthRoutes, validateOAuthToken } from './oauthServer.js';
import { asyncHandler } from './asyncHandler.js';
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

const rawUsers = process.env.USERS;
if (!rawUsers) {
  console.error('FATAL: USERS env var is required — e.g. {"dibya@supplier.io":"$2b$10$..."}');
  process.exit(1);
}
initUsers(rawUsers); // exits on invalid JSON internally

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

// --- Express setup ---

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // needed for OAuth form submissions

// OAuth routes are public (no auth middleware) — must be registered before auth middleware
registerOAuthRoutes(app);

// Auth middleware — runs before all /mcp requests
// Accepts both VALID_TOKENS bearer tokens (legacy) and OAuth access tokens
app.use('/mcp', (req, res, next) => {
  const username =
    validateToken(req.headers.authorization) ??
    validateOAuthToken(req.headers.authorization);
  if (!username) {
    const baseUrl = process.env.BASE_URL ?? 'https://supplierio-mcp.onrender.com';
    res.set('WWW-Authenticate', `Bearer realm="supplierio-mcp", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`);
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

// Admin: hash a password for adding to the USERS env var
// Usage: GET /admin/generate-hash?password=chosen_password
//        Authorization: Bearer <ADMIN_TOKEN>
app.get('/admin/generate-hash', asyncHandler(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN!}`) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const password = req.query.password as string | undefined;
  if (!password) {
    res.status(400).json({ error: 'password query param required' });
    return;
  }
  const hash = await hashPassword(password);
  res.json({ hash });
}));

// Error handler — catches errors thrown in async routes
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
