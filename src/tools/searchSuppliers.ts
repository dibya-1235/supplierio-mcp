import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchSuppliers as doSearch } from '../supplierioClient.js';
import type { SearchParams, SearchResult } from '../supplierioClient.js';
import { render } from '../renderer.js';
import { log } from '../logger.js';
import { usernameStorage } from '../context.js';

const TOOL_DESCRIPTION =
  'Use this tool to search the Supplier.io database and discover diverse and small business suppliers. ' +
  'Supports filtering by keyword or company description, city (searches within a radius), US state, ' +
  'NAICS industry code, SIC code, diversity classification (MBE, WBE, VOSB, LGBTQ+, etc.), ' +
  'sustainability classification, ethnicity, employee count range, and annual revenue range. ' +
  'You can also filter by exact or partial supplier name using organizationName. ' +
  'Returns up to 10 matching suppliers with TrustIQ scores, diversity/sustainability tags, and corporate parent information. ' +
  'Examples of how to map user queries to parameters: ' +
  '"minority-owned caterers in Boston" → searchQuery="caterers", city="Boston", diversityClassification="MBE"; ' +
  '"women-owned IT firms in Chicago within 10 miles" → searchQuery="IT staffing", city="Chicago", locationDistance=10, diversityClassification="WBE"; ' +
  '"veteran-owned manufacturers in Texas" → naicsCode="31-33", state="TX", diversityClassification="VOSB"; ' +
  '"small logistics companies in Houston" → searchQuery="logistics", city="Houston", employee="1-50".';

const inputSchema = {
  searchQuery: z.string().optional().describe(
    'Keyword or description search, e.g. "IT staffing", "plastic molding", "catering"'
  ),
  organizationName: z.string().optional().describe(
    'Filter by supplier company name (exact or partial), e.g. "Acme" or "Johnson & Johnson"'
  ),
  city: z.string().optional().describe(
    'City to search near, e.g. "Boston", "Chicago", "Houston". Searches within a radius (default 25 miles).'
  ),
  locationDistance: z.number().optional().describe(
    'Radius in miles around the city to search within, e.g. 10, 25, 50. Default is 25.'
  ),
  state: z.string().optional().describe(
    '2-letter US state code, e.g. "TX", "MA", "CA"'
  ),
  country: z.string().optional().default('USA').describe(
    'ISO 3-letter country code, default "USA"'
  ),
  naicsCode: z.string().optional().describe(
    '6-digit NAICS industry code, e.g. "541511" for custom computer programming'
  ),
  sicCode: z.string().optional().describe(
    '4-digit SIC industry code, e.g. "7372" for prepackaged software'
  ),
  diversityClassification: z.string().optional().describe(
    'Diversity type: "MBE" (minority), "WBE" (women), "VOSB" (veteran), "SDVOSB" (service-disabled veteran), "LGBTQ", "SBE" (small business). Use the acronym.'
  ),
  sustainabilityClassification: z.string().optional().describe(
    'Sustainability certification type, e.g. "B Corp", "ISO 14001"'
  ),
  ethnicity: z.string().optional().describe(
    'Ethnicity filter, e.g. "Asian", "Black", "Hispanic", "Native American"'
  ),
  employee: z.string().optional().describe(
    'Employee count range, e.g. "1-10", "11-50", "51-200", "201-500", "501+"'
  ),
  revenue: z.string().optional().describe(
    'Annual revenue range, e.g. "$1M-10M", "$10M-50M", "$50M-100M", "$100M+"'
  ),
};

export function registerTools(server: McpServer): void {
  server.tool('search_suppliers', TOOL_DESCRIPTION, inputSchema, async (args) => {
    const username = usernameStorage.getStore() ?? 'unknown';
    const startMs = Date.now();

    const params: SearchParams = {
      searchQuery: args.searchQuery,
      organizationName: args.organizationName,
      city: args.city,
      locationDistance: args.locationDistance,
      state: args.state,
      country: args.country,
      naicsCode: args.naicsCode,
      sicCode: args.sicCode,
      diversityClassification: args.diversityClassification,
      sustainabilityClassification: args.sustainabilityClassification,
      ethnicity: args.ethnicity,
      employee: args.employee,
      revenue: args.revenue,
    };

    let result: SearchResult = { suppliers: [], totalCount: 0 };
    let errorMessage: string | undefined;

    try {
      result = await doSearch(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[search_suppliers] error for user=${username}: ${msg}`);
      if (msg === 'TIMEOUT') {
        errorMessage = 'The supplier search timed out. Please try again.';
      } else if (msg.startsWith('API_ERROR:')) {
        const status = msg.split(':')[1];
        errorMessage = `The supplier search returned an unexpected error (status ${status}). Please try again later.`;
      } else if (msg === 'Supplier search is not configured. Please contact your administrator.') {
        errorMessage = msg;
      } else {
        errorMessage = 'The supplier search is temporarily unavailable. Please try again later.';
      }
    }

    const latencyMs = Date.now() - startMs;

    await log({
      timestamp: new Date().toISOString(),
      username,
      tool: 'search_suppliers',
      params: params as Record<string, unknown>,
      resultCount: result.suppliers.length,
      latencyMs,
    });

    return {
      content: [{ type: 'text' as const, text: render(result, params, errorMessage) }],
    };
  });
}
