let tokenMap: Map<string, string> = new Map();

export function initAuth(tokens: Record<string, string>): void {
  tokenMap = new Map(
    Object.entries(tokens).map(([username, token]) => [token, username])
  );
}

export function validateToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  return tokenMap.get(token) ?? null;
}
