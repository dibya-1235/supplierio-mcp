import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import { verifyUser } from './users.js';
import { renderLoginPage, type LoginPageParams } from './loginPage.js';
import { asyncHandler } from './asyncHandler.js';

// --- In-memory stores ---

interface AuthCode {
  email: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number; // Date.now() + 5 min
}

interface AccessToken {
  email: string;
  expiresAt: number; // Date.now() + 90 days
}

const authCodes = new Map<string, AuthCode>();
const accessTokens = new Map<string, AccessToken>();

const BASE_URL = process.env.BASE_URL ?? 'https://supplierio-mcp.onrender.com';

// --- Public API ---

export function validateOAuthToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  const entry = accessTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    accessTokens.delete(token);
    return null;
  }
  return entry.email;
}

// Test helpers — only import in test files, never in production code
export function _resetForTest(): void {
  authCodes.clear();
  accessTokens.clear();
}

export function _injectAccessToken(token: string, email: string, expiresAt: number): void {
  accessTokens.set(token, { email, expiresAt });
}

// CORS headers required on endpoints that claude.ai browser code fetches cross-origin.
// Without these the browser silently discards responses (Same-Origin Policy).
function setCorsHeaders(res: express.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Session-Id');
}

export function registerOAuthRoutes(app: express.Application): void {
  // 0. Protected Resource Metadata (RFC 9728) — MCP spec requires this as the
  //    first discovery step. Claude.ai reads WWW-Authenticate → fetches this →
  //    finds the authorization server → fetches /.well-known/oauth-authorization-server
  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    setCorsHeaders(res);
    res.set('X-Cors-Version', 'v2'); // diagnostic header — remove after confirming CORS works
    res.json({
      resource: `${BASE_URL}/mcp`,
      authorization_servers: [BASE_URL],
      _build: 'cors-v2', // diagnostic field — remove after confirming new code is deployed
    });
  });

  // 1. OAuth server metadata (RFC 8414) — Claude.ai uses this for discovery
  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    setCorsHeaders(res);
    res.json({
      issuer: BASE_URL,
      authorization_endpoint: `${BASE_URL}/oauth/authorize`,
      token_endpoint: `${BASE_URL}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
    });
  });

  // 2. Show login form
  app.get('/oauth/authorize', (req, res) => {
    const q = req.query as Record<string, string>;
    const params: LoginPageParams = {
      state: q.state ?? '',
      clientId: q.client_id ?? '',
      redirectUri: q.redirect_uri ?? '',
      codeChallenge: q.code_challenge ?? '',
      codeChallengeMethod: q.code_challenge_method ?? 'S256',
    };
    res.send(renderLoginPage(params));
  });

  // 3. Process login form submission
  app.post('/oauth/authorize', asyncHandler(async (req, res) => {
    const body = req.body as Record<string, string>;
    const params: LoginPageParams = {
      state: body.state ?? '',
      clientId: body.client_id ?? '',
      redirectUri: body.redirect_uri ?? '',
      codeChallenge: body.code_challenge ?? '',
      codeChallengeMethod: body.code_challenge_method ?? 'S256',
    };

    if (!body.redirect_uri) {
      res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri required' });
      return;
    }

    // Validate redirect_uri: must be HTTPS and must be from an allowed host
    let parsedRedirect: URL;
    try {
      parsedRedirect = new URL(params.redirectUri);
    } catch {
      res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri is not a valid URL' });
      return;
    }
    if (parsedRedirect.protocol !== 'https:' || !['claude.ai'].includes(parsedRedirect.hostname)) {
      res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri not permitted' });
      return;
    }

    const valid = await verifyUser(body.email ?? '', body.password ?? '');
    if (!valid) {
      res.send(renderLoginPage(params, 'Invalid email or password'));
      return;
    }

    const code = randomBytes(32).toString('hex');
    authCodes.set(code, {
      email: body.email,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    const redirectUrl = parsedRedirect;
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', params.state);
    res.redirect(redirectUrl.toString());
  }));

  // Preflight handler — browsers send OPTIONS before cross-origin POST requests.
  // Without this, the token exchange fetch is blocked before it starts.
  app.options('/oauth/token', (_req, res) => {
    setCorsHeaders(res);
    res.sendStatus(204);
  });

  // 4. Token exchange — Claude.ai sends code + PKCE verifier, gets access token
  app.post('/oauth/token', asyncHandler(async (req, res) => {
    setCorsHeaders(res);
    const body = req.body as Record<string, string>;
    const code = body.code;
    const codeVerifier = body.code_verifier;

    if (!code || !codeVerifier) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'code and code_verifier are required',
      });
      return;
    }

    const entry = authCodes.get(code);
    if (!entry) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Auth code not found or already used' });
      return;
    }
    if (Date.now() > entry.expiresAt) {
      authCodes.delete(code);
      res.status(400).json({ error: 'invalid_grant', error_description: 'Auth code expired' });
      return;
    }

    // PKCE S256: SHA-256(code_verifier) encoded as base64url must equal stored code_challenge
    const computedChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    if (computedChallenge !== entry.codeChallenge) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      return;
    }

    authCodes.delete(code); // single use

    const accessToken = randomBytes(32).toString('hex');
    accessTokens.set(accessToken, {
      email: entry.email,
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
    });

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 7776000, // 90 days in seconds
    });
  }));

  // Proactively purge expired auth codes every minute
  // (Access tokens are cleaned up lazily in validateOAuthToken)
  setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of authCodes) {
      if (now > entry.expiresAt) authCodes.delete(code);
    }
  }, 60_000);
}
