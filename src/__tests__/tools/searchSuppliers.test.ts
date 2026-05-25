import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

vi.mock('../../supplierioClient.js', () => ({
  searchSuppliers: vi.fn(),
}));
vi.mock('../../renderer.js', () => ({
  render: vi.fn(() => '<html>mock</html>'),
}));
vi.mock('../../logger.js', () => ({
  log: vi.fn(),
}));
vi.mock('../../context.js', () => ({
  usernameStorage: { getStore: vi.fn(() => 'alice') },
}));

import { searchSuppliers as mockSearch } from '../../supplierioClient.js';
import { render as mockRender } from '../../renderer.js';
import { log as mockLog } from '../../logger.js';
import { registerTools } from '../../tools/searchSuppliers.js';

// Helper to get the registered tool handler
// NOTE: In @modelcontextprotocol/sdk v1.x, _registeredTools is a plain object (not a Map)
type RegisteredTools = Record<string, { handler: (args: unknown) => Promise<unknown> }>;

function getTool(server: McpServer, name: string) {
  const tools = (server as unknown as { _registeredTools: RegisteredTools })._registeredTools;
  return tools[name];
}

describe('search_suppliers tool', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '1.0.0' });
    registerTools(server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls searchSuppliers with correct params and returns HTML', async () => {
    vi.mocked(mockSearch).mockResolvedValueOnce({ suppliers: [], totalCount: 0 });
    vi.mocked(mockRender).mockReturnValueOnce('<html>results</html>');

    const tool = getTool(server, 'search_suppliers');
    expect(tool).toBeDefined();

    const result = await tool.handler({ state: 'TX', diversityClassification: 'MBE', country: 'USA' });
    expect(vi.mocked(mockSearch)).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'TX', diversityClassification: 'MBE' })
    );
    expect(result).toEqual({ content: [{ type: 'text', text: '<html>results</html>' }] });
  });

  it('passes username from context to logger', async () => {
    vi.mocked(mockSearch).mockResolvedValueOnce({ suppliers: [], totalCount: 0 });
    const tool = getTool(server, 'search_suppliers');
    await tool.handler({ country: 'USA' });
    expect(vi.mocked(mockLog)).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'alice', tool: 'search_suppliers' })
    );
  });

  it('returns error HTML and still calls logger when API throws', async () => {
    vi.mocked(mockSearch).mockRejectedValueOnce(new Error('TIMEOUT'));
    vi.mocked(mockRender).mockReturnValueOnce('<html>error</html>');
    const tool = getTool(server, 'search_suppliers');
    const result = await tool.handler({ country: 'USA' });
    expect(vi.mocked(mockRender)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'The supplier search timed out. Please try again.'
    );
    expect(vi.mocked(mockLog)).toHaveBeenCalled();
    expect(result).toEqual({ content: [{ type: 'text', text: '<html>error</html>' }] });
  });

  it('does not include credentials in logger params', async () => {
    vi.mocked(mockSearch).mockResolvedValueOnce({ suppliers: [], totalCount: 0 });
    const tool = getTool(server, 'search_suppliers');
    await tool.handler({ country: 'USA' });
    const logCall = vi.mocked(mockLog).mock.calls[0][0];
    expect(logCall.params).not.toHaveProperty('apiKey');
    expect(logCall.params).not.toHaveProperty('customerId');
  });
});
