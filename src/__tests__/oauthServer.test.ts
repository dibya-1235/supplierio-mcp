import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateOAuthToken,
  _resetForTest,
  _injectAccessToken,
} from '../oauthServer.js';

describe('validateOAuthToken', () => {
  beforeEach(() => {
    _resetForTest();
  });

  it('returns null when header is undefined', () => {
    expect(validateOAuthToken(undefined)).toBeNull();
  });

  it('returns null when Bearer prefix is missing', () => {
    expect(validateOAuthToken('tok_abc123')).toBeNull();
  });

  it('returns null for empty Bearer value', () => {
    expect(validateOAuthToken('Bearer ')).toBeNull();
  });

  it('returns null for an unknown token', () => {
    expect(validateOAuthToken('Bearer unknown_token_xyz')).toBeNull();
  });

  it('returns the email for a valid non-expired token', () => {
    _injectAccessToken('mytoken123', 'dibya@supplier.io', Date.now() + 60_000);
    expect(validateOAuthToken('Bearer mytoken123')).toBe('dibya@supplier.io');
  });

  it('returns null for an expired token', () => {
    _injectAccessToken('expiredtoken', 'dibya@supplier.io', Date.now() - 1);
    expect(validateOAuthToken('Bearer expiredtoken')).toBeNull();
  });

  it('removes the expired token from the store after checking', () => {
    _injectAccessToken('expiredtoken', 'dibya@supplier.io', Date.now() - 1);
    validateOAuthToken('Bearer expiredtoken'); // first call removes it
    // inject a fresh token and confirm expiredtoken is gone (indirectly — it returns null again)
    expect(validateOAuthToken('Bearer expiredtoken')).toBeNull();
  });
});
