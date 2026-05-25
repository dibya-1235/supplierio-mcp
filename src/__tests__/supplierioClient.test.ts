import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSupplier = {
  SupplierID: 'S001',
  SupplierName: 'Acme Diverse Staffing',
  Description: 'IT staffing firm',
  Address: '123 Main St',
  City: 'Austin',
  State: 'TX',
  Zip: '78701',
  Country: 'USA',
  TrustIQ: 4,
  Relationships: null,
};

describe('searchSuppliers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SUPPLIERIO_API_KEY', 'test_key');
    vi.stubEnv('SUPPLIERIO_CUSTOMER_ID', 'test_cust');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns typed suppliers on a successful API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ suppliers: [mockSupplier], totalCount: 1 }),
        { status: 200 }
      )
    );
    const { searchSuppliers } = await import('../supplierioClient.js');
    const result = await searchSuppliers({ state: 'TX', diversityClassification: 'MBE' });
    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers[0].SupplierName).toBe('Acme Diverse Staffing');
    expect(result.totalCount).toBe(1);
  });

  it('sends rowCount 10 and defaults country to USA', async () => {
    let capturedBody: Record<string, unknown> = {};
    vi.spyOn(global, 'fetch').mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return new Response(JSON.stringify({ suppliers: [], totalCount: 0 }), { status: 200 });
    });
    const { searchSuppliers } = await import('../supplierioClient.js');
    await searchSuppliers({ searchQuery: 'IT' });
    expect(capturedBody.rowCount).toBe(10);
    expect(capturedBody.country).toBe('USA');
    expect(capturedBody.searchQuery).toBe('IT');
    expect(capturedBody.startRecord).toBe(0);
  });

  it('does not include undefined optional params in request body', async () => {
    let capturedBody: Record<string, unknown> = {};
    vi.spyOn(global, 'fetch').mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return new Response(JSON.stringify({ suppliers: [], totalCount: 0 }), { status: 200 });
    });
    const { searchSuppliers } = await import('../supplierioClient.js');
    await searchSuppliers({});
    expect(capturedBody.state).toBeUndefined();
    expect(capturedBody.naicsCode).toBeUndefined();
  });

  it('throws TIMEOUT on AbortError', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    const { searchSuppliers } = await import('../supplierioClient.js');
    await expect(searchSuppliers({})).rejects.toThrow('TIMEOUT');
  });

  it('throws API_ERROR on non-200 response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );
    const { searchSuppliers } = await import('../supplierioClient.js');
    await expect(searchSuppliers({})).rejects.toThrow('API_ERROR:500');
  });

  it('throws configuration error when credentials are missing', async () => {
    vi.unstubAllEnvs();
    const { searchSuppliers } = await import('../supplierioClient.js');
    await expect(searchSuppliers({})).rejects.toThrow('not configured');
  });
});
