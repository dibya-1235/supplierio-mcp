import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { initUsers, verifyUser, hashPassword } from '../users.js';

describe('users', () => {
  beforeEach(async () => {
    const hash = await bcrypt.hash('secret123', 10);
    initUsers(JSON.stringify({ 'test@example.com': hash }));
  });

  it('verifyUser returns true for correct credentials', async () => {
    expect(await verifyUser('test@example.com', 'secret123')).toBe(true);
  });

  it('verifyUser returns false for wrong password', async () => {
    expect(await verifyUser('test@example.com', 'wrongpass')).toBe(false);
  });

  it('verifyUser returns false for unknown email', async () => {
    expect(await verifyUser('nobody@example.com', 'secret123')).toBe(false);
  });

  it('verifyUser returns false for empty email', async () => {
    expect(await verifyUser('', 'secret123')).toBe(false);
  });

  it('hashPassword produces a valid bcrypt hash that verifies', async () => {
    const h = await hashPassword('mypassword');
    expect(h).toMatch(/^\$2b\$10\$/);
    expect(await bcrypt.compare('mypassword', h)).toBe(true);
  });

  it('initUsers replaces the existing user map', async () => {
    const newHash = await bcrypt.hash('newpass', 10);
    initUsers(JSON.stringify({ 'new@example.com': newHash }));
    expect(await verifyUser('test@example.com', 'secret123')).toBe(false);
    expect(await verifyUser('new@example.com', 'newpass')).toBe(true);
  });

  it('initUsers calls process.exit(1) on invalid JSON', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (code?: number) => never);
    initUsers('not-valid-json');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
