import { describe, it, expect } from 'vitest';
import { renderLoginPage, type LoginPageParams } from '../loginPage.js';

const params: LoginPageParams = {
  state: 'abc123',
  clientId: 'claude',
  redirectUri: 'https://claude.ai/callback',
  codeChallenge: 'challenge_xyz',
  codeChallengeMethod: 'S256',
};

describe('renderLoginPage', () => {
  it('renders the heading "Supplier.io Search"', () => {
    const html = renderLoginPage(params);
    expect(html).toContain('Supplier.io Search');
  });

  it('includes a form that POSTs to /oauth/authorize', () => {
    const html = renderLoginPage(params);
    expect(html).toContain('method="POST"');
    expect(html).toContain('action="/oauth/authorize"');
  });

  it('includes hidden state field', () => {
    const html = renderLoginPage(params);
    expect(html).toContain('name="state" value="abc123"');
  });

  it('includes hidden redirect_uri field', () => {
    const html = renderLoginPage(params);
    expect(html).toContain('name="redirect_uri" value="https://claude.ai/callback"');
  });

  it('includes hidden code_challenge field', () => {
    const html = renderLoginPage(params);
    expect(html).toContain('name="code_challenge" value="challenge_xyz"');
  });

  it('includes hidden code_challenge_method field', () => {
    const html = renderLoginPage(params);
    expect(html).toContain('name="code_challenge_method" value="S256"');
  });

  it('includes hidden client_id field', () => {
    const html = renderLoginPage(params);
    expect(html).toContain('name="client_id" value="claude"');
  });

  it('includes email and password inputs', () => {
    const html = renderLoginPage(params);
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
  });

  it('does not include error div when no error provided', () => {
    const html = renderLoginPage(params);
    expect(html).not.toContain('class="error"');
  });

  it('shows error message when error is provided', () => {
    const html = renderLoginPage(params, 'Invalid email or password');
    expect(html).toContain('class="error"');
    expect(html).toContain('Invalid email or password');
  });

  it('XSS-escapes the state parameter', () => {
    const xssParams = { ...params, state: '<script>alert(1)</script>' };
    const html = renderLoginPage(xssParams);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('XSS-escapes error message', () => {
    const html = renderLoginPage(params, '<b>bad</b>');
    expect(html).not.toContain('<b>bad</b>');
    expect(html).toContain('&lt;b&gt;bad&lt;/b&gt;');
  });
});
