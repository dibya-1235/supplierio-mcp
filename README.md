# SupplierOne MCP Server

Internal POC MCP server that wraps the [SupplierOne](https://supplier.io) `GetSearchDetail` API.
Lets internal stakeholders search the supplier database directly from Claude Desktop using natural language.

**Example:** "Find certified minority-owned IT suppliers in Texas with 50–200 employees."

---

## What It Does

- Exposes one MCP tool: `search_suppliers`
- Filters by keyword, state, NAICS code, diversity classification (MBE/WBE/VOSB/LGBTQ+/etc.), employee count, revenue
- Returns up to 10 supplier cards rendered as an HTML artifact in Claude Desktop
- Logs every search (who, what, how fast) to a persistent file for adoption tracking
- SupplierOne API key is never exposed to users

---

## Running Locally

**Prerequisites:** Node 20+, npm

1. Clone this repo.
2. Copy `.env.example` to `.env` and fill in real values:

   ```
   VALID_TOKENS={"yourname":"tok_yourname_abc123"}
   SUPPLIERIO_API_KEY=<from SupplierOne dashboard>
   SUPPLIERIO_CUSTOMER_ID=<from SupplierOne dashboard>
   ADMIN_TOKEN=pick_a_strong_random_string
   LOG_PATH=./logs/usage.log
   PORT=8080
   ```

3. Install and start:

   ```bash
   npm install
   npm run dev
   ```

4. Verify health:

   ```bash
   curl http://localhost:8080/health
   ```

---

## Deploying to Fly.io

**Prerequisites:** [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated.

```bash
# 1. Create the app (run once)
fly launch --no-deploy --name supplierio-mcp

# 2. Create the persistent volume for logs (run once)
fly volumes create logs_vol --size 1 --region iad

# 3. Set all secrets
fly secrets set \
  VALID_TOKENS='{"alice":"tok_alice_abc123","bob":"tok_bob_xyz789"}' \
  SUPPLIERIO_API_KEY="your_real_api_key" \
  SUPPLIERIO_CUSTOMER_ID="your_real_customer_id" \
  ADMIN_TOKEN="your_strong_admin_token"

# 4. Deploy
fly deploy
```

After deploy, your server is at `https://supplierio-mcp.fly.dev`.

---

## Adding a New User / Generating a Token

1. Generate a token (example using openssl):

   ```bash
   echo "tok_$(openssl rand -hex 16)"
   ```

2. Add the user to the `VALID_TOKENS` secret. Get the current value first:

   ```bash
   fly secrets list
   ```

   Then update with the new user included:

   ```bash
   fly secrets set VALID_TOKENS='{"alice":"tok_alice_abc123","bob":"tok_bob_xyz789","carol":"tok_carol_NEW"}'
   ```

---

## Claude Desktop Configuration

Each user adds this to their `claude_desktop_config.json`
(Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`,
Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "supplierone": {
      "url": "https://supplierio-mcp.fly.dev/mcp",
      "headers": {
        "Authorization": "Bearer tok_yourname_abc123"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

---

## Checking Usage Logs

Returns the last 100 tool calls as a JSON array:

```bash
curl https://supplierio-mcp.fly.dev/admin/logs \
  -H "Authorization: Bearer your_admin_token"
```

Each entry contains: `timestamp`, `username`, `tool`, `params`, `resultCount`, `latencyMs`.

---

## Troubleshooting

**Cold starts:** Fly.io machines suspend when idle and resume automatically. The first request after a long idle period may take 2–3 seconds. Subsequent requests are fast.

**Token errors (401):** Verify the `Authorization: Bearer <token>` header in your Claude Desktop config exactly matches a token in `VALID_TOKENS`. Tokens are case-sensitive.

**SupplierOne API errors:** Check `fly logs` for details. Common causes: incorrect `SUPPLIERIO_API_KEY` or `SUPPLIERIO_CUSTOMER_ID`, or the SupplierOne API being temporarily unavailable. The server returns a user-friendly error card in Claude Desktop.

**Logs endpoint returns 403:** The `Authorization` header must match `ADMIN_TOKEN` exactly. Use `fly secrets list` to confirm the secret is set (value not shown), then re-set if needed.

**`fly deploy` fails — volume not found:** Run `fly volumes create logs_vol --size 1 --region iad` before deploying.
