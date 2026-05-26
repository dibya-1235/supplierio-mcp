import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Real API response shape: { results: { Results: [...], TotalRecords: "5000+" } }
function makeApiResponse(suppliers: unknown[], totalRecords: string | number = suppliers.length) {
  return JSON.stringify({ results: { Results: suppliers, TotalRecords: totalRecords, Error: null } });
}

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
  Diversity: null,
  Sustainability: null,
  Relationships: null,
};

describe('searchSuppliers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SUPPLIERIO_API_KEY', 'test_key');
    vi.stubEnv('SUPPLIERIO_CUSTOMER_ID', 'test_cust');
    vi.stubEnv('SUPPLIERIO_CUSTOMER_NAME', 'Test Customer');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns typed suppliers on a successful API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(makeApiResponse([mockSupplier], 1), { status: 200 })
    );
    const { searchSuppliers } = await import('../supplierioClient.js');
    const result = await searchSuppliers({ state: 'TX', diversityClassification: 'MBE' });
    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers[0].SupplierName).toBe('Acme Diverse Staffing');
    expect(result.totalCount).toBe(1);
  });

  it('sends GET request with rowCount=10 and country=USA as query params', async () => {
    let capturedUrl = '';
    vi.spyOn(global, 'fetch').mockImplementationOnce(async (url) => {
      capturedUrl = url as string;
      return new Response(makeApiResponse([]), { status: 200 });
    });
    const { searchSuppliers } = await import('../supplierioClient.js');
    await searchSuppliers({ searchQuery: 'IT' });
    const qs = new URL(capturedUrl).searchParams;
    expect(qs.get('rowCount')).toBe('10');
    expect(qs.get('country')).toBe('USA');
    expect(qs.get('searchQuery')).toBe('IT');
    expect(qs.get('startRecord')).toBe('0');
  });

  it('uses GET method (not POST)', async () => {
    let capturedInit: RequestInit | undefined;
    vi.spyOn(global, 'fetch').mockImplementationOnce(async (_url, init) => {
      capturedInit = init;
      return new Response(makeApiResponse([]), { status: 200 });
    });
    const { searchSuppliers } = await import('../supplierioClient.js');
    await searchSuppliers({});
    expect(capturedInit?.method).toBe('GET');
    expect(capturedInit?.body).toBeUndefined();
  });

  it('does not include undefined optional params in query string', async () => {
    let capturedUrl = '';
    vi.spyOn(global, 'fetch').mockImplementationOnce(async (url) => {
      capturedUrl = url as string;
      return new Response(makeApiResponse([]), { status: 200 });
    });
    const { searchSuppliers } = await import('../supplierioClient.js');
    await searchSuppliers({});
    const qs = new URL(capturedUrl).searchParams;
    expect(qs.has('state')).toBe(false);
    expect(qs.has('naicsCode')).toBe(false);
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

  it('uses caller-supplied country instead of USA default', async () => {
    let capturedUrl = '';
    vi.spyOn(global, 'fetch').mockImplementationOnce(async (url) => {
      capturedUrl = url as string;
      return new Response(makeApiResponse([]), { status: 200 });
    });
    const { searchSuppliers } = await import('../supplierioClient.js');
    await searchSuppliers({ country: 'CAN' });
    expect(new URL(capturedUrl).searchParams.get('country')).toBe('CAN');
  });

  it('returns empty suppliers and zero totalCount on empty API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );
    const { searchSuppliers } = await import('../supplierioClient.js');
    const result = await searchSuppliers({});
    expect(result.suppliers).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('parses TotalRecords string like "5000+" to a number', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(makeApiResponse([mockSupplier], '5000+'), { status: 200 })
    );
    const { searchSuppliers } = await import('../supplierioClient.js');
    const result = await searchSuppliers({});
    expect(result.totalCount).toBe(5000);
  });
});
