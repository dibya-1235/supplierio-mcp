# Supplier.io MCP Server

An MCP (Model Context Protocol) server that lets Claude search the Supplier.io supplier database using natural language.

**Example queries:**
- "Find minority-owned staffing companies in Texas"
- "Search for women-owned IT suppliers with under 200 employees"
- "Show me veteran-owned manufacturers in California"

---

## How It Works

The server exposes a `search_suppliers` tool to Claude. When you ask Claude a supplier-related question, it automatically maps your natural language to the right API filters and returns matching suppliers with TrustIQ scores, diversity classifications, and company details.

---

## Architecture

```
Claude (claude.ai)
      │  OAuth 2.0
      ▼
MCP Server (Node.js / Express)   ← deployed on Render
      │  GET query params
      ▼
Supplier.io API (GetSearchDetail)
```

**Key files:**
```
src/
  index.ts              Express server, MCP endpoint, OAuth middleware
  oauthServer.ts        OAuth 2.0 Authorization Code + PKCE flow
  supplierioClient.ts   Supplier.io API client (GET + query params)
  tools/
    searchSuppliers.ts  MCP tool definition and parameter mapping
  renderer.ts           HTML result cards rendered in Claude
  users.ts              User management (bcrypt password hashing)
  auth.ts               Bearer token validation
  logger.ts             Usage logging
```

---

## Supported Search Filters

| Parameter | Description | Example |
|---|---|---|
| `searchQuery` | Keyword search | "catering", "IT staffing" |
| `organizationName` | Filter by company name | "Acme Corp" |
| `state` | 2-letter US state code | "TX", "MA" |
| `country` | ISO 3-letter country code | "USA", "CAN" |
| `naicsCode` | 6-digit NAICS industry code | "541511" |
| `sicCode` | 4-digit SIC industry code | "7372" |
| `diversityClassification` | Diversity type | "MBE", "WBE", "VOSB", "LGBTQ" |
| `sustainabilityClassification` | Sustainability certification | "B Corp" |
| `ethnicity` | Ethnicity filter | "Asian", "Black", "Hispanic" |
| `employee` | Employee count range | "1-50", "51-200" |
| `revenue` | Annual revenue range | "$1M-10M", "$10M-50M" |

---

## Running Locally

**Prerequisites:** Node 20+, npm

1. Clone the repo
2. Create a `.env` file:

```env
PORT=8080
BASE_URL=http://localhost:8080
VALID_TOKENS={"yourname":"tok_yourname_abc123"}
USERS={"you@supplier.io":"$2b$10$...bcrypt_hash_here"}
ADMIN_TOKEN=pick_a_strong_random_string
SUPPLIERIO_API_KEY=your_api_key
SUPPLIERIO_CUSTOMER_ID=your_customer_id
SUPPLIERIO_CUSTOMER_NAME=your_customer_name
SUPPLIERIO_BASE_URL=https://nextgenapi.supplierio.com/supplier
LOG_PATH=./logs/usage.log
```

3. Generate a bcrypt hash for your password:

```bash
npm install
npx ts-node -e "import('./src/users.js').then(m => m.hashPassword('yourpassword').then(console.log))"
```

4. Start the server:

```bash
npm run dev
```

5. Verify:

```bash
curl http://localhost:8080/health
```

---

## Deploying to Render

1. Push to GitHub
2. Create a new **Web Service** on [render.com](https://render.com) pointing to your repo
3. Set **Environment** to `Docker`
4. Add these environment variables:

| Variable | Value |
|---|---|
| `BASE_URL` | `https://your-app.onrender.com` |
| `VALID_TOKENS` | `{"name":"tok_abc123"}` |
| `USERS` | `{"email@supplier.io":"$2b$10$..."}` |
| `ADMIN_TOKEN` | strong random string |
| `SUPPLIERIO_API_KEY` | your API key |
| `SUPPLIERIO_CUSTOMER_ID` | your customer ID |
| `SUPPLIERIO_CUSTOMER_NAME` | your customer name |
| `SUPPLIERIO_BASE_URL` | `https://nextgenapi.supplierio.com/supplier` |
| `LOG_PATH` | `/tmp/usage.log` |

---

## Connecting a New User

1. Generate a bcrypt hash of their password:

```
GET https://your-app.onrender.com/admin/generate-hash?password=THEIR_PASSWORD
Authorization: Bearer YOUR_ADMIN_TOKEN
```

2. Add them to the `USERS` env var in Render:

```json
{
  "existing@supplier.io": "$2b$10$existingHash",
  "newuser@supplier.io": "$2b$10$newHash"
}
```

3. Click **Save Changes** in Render — no redeployment needed.

4. Share with the user:
   - **MCP Server URL:** `https://your-app.onrender.com/mcp`
   - Their email and password

They connect via **claude.ai → Settings → Integrations → Add MCP Server**.

---

## Extending to Other Data Sources

The MCP server is not specific to the Supplier.io search API. You can add new tools by:

1. Creating a new file in `src/tools/`
2. Registering it in `registerTools()` in `src/index.ts`
3. Calling any API, database, or service from within the tool handler

Each tool gets the authenticated user's identity via `usernameStorage.getStore()` for logging and access control.

**Examples of tools you could add:**
- Query a MySQL database directly
- Search a Solr index
- Look up CRM data
- Pull from internal REST APIs

---

## Checking Usage Logs

```bash
curl https://your-app.onrender.com/admin/logs \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Returns the last 100 tool calls with: `timestamp`, `username`, `tool`, `params`, `resultCount`, `latencyMs`.

---

## Keeping the Server Warm

Render's free tier spins down after 15 minutes of inactivity. Set up a free monitor at [uptimerobot.com](https://uptimerobot.com) to ping `https://your-app.onrender.com/health` every 5 minutes.
