import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchSuppliers as doSearch } from '../supplierioClient.js';
import type { SearchParams, SearchResult } from '../supplierioClient.js';
import { render } from '../renderer.js';
import { log } from '../logger.js';
import { usernameStorage } from '../context.js';

const TOOL_DESCRIPTION =
  'Use this tool to search the SupplierOne database for diverse and small business suppliers. ' +
  'You can filter by keyword or industry description, US state, NAICS industry code, diversity ' +
  'classification (such as MBE for minority-owned, WBE for women-owned, VOSB for veteran-owned ' +
  'small businesses, LGBTQ+-owned, and others), company size by employee count, and annual revenue ' +
  'range. Returns up to 10 matching suppliers with full contact details, a trust score, and corporate ' +
  'parent information where available. Use this when a user wants to find, discover, or explore ' +
  'diverse suppliers for procurement purposes.';

const inputSchema = {
  searchQuery: z.string().optional().describe('Keyword search, e.g. "IT staffing" or "construction"'),
  state: z.string().optional().describe('2-letter US state code, e.g. "TX"'),
  naicsCode: z.string().optional().describe('6-digit NAICS industry code'),
  diversityClassification: z.string().optional().describe('e.g. "MBE", "WBE", "VOSB", "LGBTQ"'),
  employee: z.string().optional().describe('Employee range, e.g. "51-200"'),
  revenue: z.string().optional().describe('Revenue range, e.g. "$1M-10M"'),
  // .default('USA') means args.country is always a string — supplierioClient's own ?? 'USA' fallback is intentional defense-in-depth
  country: z.string().optional().default('USA').describe('ISO 3-letter country code, default "USA"'),
};

export function registerTools(server: McpServer): void {
  server.tool('search_suppliers', TOOL_DESCRIPTION, inputSchema, async (args) => {
    const username = usernameStorage.getStore() ?? 'unknown';
    const startMs = Date.now();

    const params: SearchParams = {
      searchQuery: args.searchQuery,
      state: args.state,
      naicsCode: args.naicsCode,
      diversityClassification: args.diversityClassification,
      employee: args.employee,
      revenue: args.revenue,
      country: args.country,
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
