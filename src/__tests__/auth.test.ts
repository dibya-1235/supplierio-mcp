import { describe, it, expect, beforeEach } from 'vitest';
import { initAuth, validateToken } from '../auth.js';

describe('validateToken', () => {
  beforeEach(() => {
    initAuth({ alice: 'tok_alice_abc', bob: 'tok_bob_xyz' });
  });

  it('returns username for a valid token', () => {
    expect(validateToken('Bearer tok_alice_abc')).toBe('alice');
  });

  it('returns username for a second valid token', () => {
    expect(validateToken('Bearer tok_bob_xyz')).toBe('bob');
  });

  it('returns null for an unknown token', () => {
    expect(validateToken('Bearer unknown_token')).toBeNull();
  });

  it('returns null when header is undefined', () => {
    expect(validateToken(undefined)).toBeNull();
  });

  it('returns null when Bearer prefix is missing', () => {
    expect(validateToken('tok_alice_abc')).toBeNull();
  });

  it('returns null for empty Bearer value', () => {
    expect(validateToken('Bearer ')).toBeNull();
  });

  it('re-initialising with new tokens invalidates old tokens', () => {
    initAuth({ carol: 'tok_carol_new' });
    expect(validateToken('Bearer tok_alice_abc')).toBeNull();
    expect(validateToken('Bearer tok_carol_new')).toBe('carol');
  });
});
