export interface LoginPageParams {
  state: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderLoginPage(params: LoginPageParams, error?: string): string {
  const errorHtml = error
    ? `<div class="error">${esc(error)}</div>\n    `
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Supplier.io Search</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    .card { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 40px 36px; width: 100%; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { font-size: 22px; font-weight: 700; color: #212529; margin-bottom: 24px; text-align: center; }
    label { display: block; font-size: 13px; font-weight: 600; color: #343a40; margin-bottom: 6px; }
    input[type=email], input[type=password], input[type=text] { width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 14px; margin-bottom: 16px; }
    .password-wrapper { position: relative; }
    .password-wrapper input { padding-right: 44px; margin-bottom: 16px; }
    .toggle-pw { position: absolute; right: 12px; top: 50%; transform: translateY(-60%); background: none; border: none; cursor: pointer; width: auto; padding: 0; color: #6c757d; font-size: 13px; }
    .toggle-pw:hover { color: #212529; background: none; }
    button[type=submit] { width: 100%; padding: 11px; background: #0d6efd; color: #fff; font-size: 15px; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; }
    button[type=submit]:hover { background: #0b5ed7; }
    .error { background: #fff5f5; border: 1px solid #fed7d7; color: #c53030; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Supplier.io Search</h1>
    ${errorHtml}<form method="POST" action="/oauth/authorize">
      <input type="hidden" name="state" value="${esc(params.state)}">
      <input type="hidden" name="client_id" value="${esc(params.clientId)}">
      <input type="hidden" name="redirect_uri" value="${esc(params.redirectUri)}">
      <input type="hidden" name="code_challenge" value="${esc(params.codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${esc(params.codeChallengeMethod)}">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required autocomplete="email">
      <label for="password">Password</label>
      <div class="password-wrapper">
        <input type="password" id="password" name="password" required autocomplete="current-password">
        <button type="button" class="toggle-pw" onclick="togglePassword()" aria-label="Show password">Show</button>
      </div>
      <button type="submit">Sign In</button>
    </form>
  </div>
  <script>
    function togglePassword() {
      const input = document.getElementById('password');
      const btn = document.querySelector('.toggle-pw');
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Hide';
      } else {
        input.type = 'password';
        btn.textContent = 'Show';
      }
    }
  </script>
</body>
</html>`;
}
