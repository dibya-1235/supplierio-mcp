// ── Types ────────────────────────────────────────────────────────────────────

export interface CertificationDetail {
  Classification: string | null;
  Agency: string | null;
  ExpirationDate: string | null;
  CertificateNumber: string | null;
}

export interface Supplier {
  SupplierID: string;
  SupplierName: string;
  Description: string | null;
  Address: string | null;
  City: string | null;
  State: string | null;
  Zip: string | null;
  Country: string | null;
  TrustIQ: number | null;
  Diversity: string[] | null;
  Sustainability: string[] | null;
  Relationships: {
    ParentName: string | null;
    ParentAddress: string | null;
    ParentCity: string | null;
    ParentState: string | null;
    UltimateParentName: string | null;
    UltimateParentCity: string | null;
    UltimateParentState: string | null;
  } | null;
}

export interface SearchResult {
  suppliers: Supplier[];
  totalCount: number;
}

export interface SearchParams {
  // Keyword / name
  searchQuery?: string;
  organizationName?: string;        // filter by exact/partial supplier name
  // Geography
  state?: string;
  country?: string;
  // Industry
  naicsCode?: string;
  sicCode?: string;
  // Diversity & sustainability
  diversityClassification?: string;
  sustainabilityClassification?: string;
  ethnicity?: string;
  // Size
  employee?: string;
  revenue?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SUPPLIERIO_BASE_URL ?? 'https://api.supplier.io/supplier';
const ENDPOINT = `${BASE_URL}/GetSearchDetail`;
const TIMEOUT_MS = 10000;

// ── Response shape from the actual API ───────────────────────────────────────
// The API returns: { results: { Results: Supplier[], TotalRecords: "5000+" | number, ... } }

interface ApiResponse {
  results?: {
    Results?: Supplier[];
    TotalRecords?: string | number;
    Error?: string | null;
  };
}

// ── Client ────────────────────────────────────────────────────────────────────

export async function searchSuppliers(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.SUPPLIERIO_API_KEY;
  const customerId = process.env.SUPPLIERIO_CUSTOMER_ID;
  const customerName = process.env.SUPPLIERIO_CUSTOMER_NAME;

  if (!apiKey || !customerId || !customerName) {
    throw new Error('Supplier search is not configured. Please contact your administrator.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // The API accepts GET with query parameters (not POST with JSON body)
    const qs = new URLSearchParams({
      apiKey,
      customerId,
      customerName,
      rowCount: '10',
      startRecord: '0',
      country: params.country ?? 'USA',
      enableRelationships: 'true',
      enableDiverse: 'true',
      enableSustainable: 'true',
      enableSIOIdentifiedSmall: 'true',
    });

    // Only append optional filters when provided
    if (params.searchQuery)                  qs.set('searchQuery', params.searchQuery);
    if (params.organizationName)             qs.set('organizationName', params.organizationName);
    if (params.state)                        qs.set('state', params.state);
    if (params.naicsCode)                    qs.set('naicsCode', params.naicsCode);
    if (params.sicCode)                      qs.set('sicCode', params.sicCode);
    if (params.diversityClassification)      qs.set('diversityClassification', params.diversityClassification);
    if (params.sustainabilityClassification) qs.set('sustainabilityClassification', params.sustainabilityClassification);
    if (params.ethnicity)                    qs.set('ethnicity', params.ethnicity);
    if (params.employee)                     qs.set('employee', params.employee);
    if (params.revenue)                      qs.set('revenue', params.revenue);

    const url = `${ENDPOINT}?${qs.toString()}`;
    const maskedUrl = url.replace(/apiKey=[^&]*/, 'apiKey=***');
    console.log(`[SupplierIO] GET ${maskedUrl}`);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[SupplierIO] error ${response.status}: ${text.slice(0, 300)}`);
      throw new Error(`API_ERROR:${response.status}`);
    }

    // Response shape: { results: { Results: [...], TotalRecords: "5000+" } }
    const data = await response.json() as ApiResponse;
    const suppliers = data.results?.Results ?? [];
    const rawTotal = data.results?.TotalRecords;
    // TotalRecords can be a string like "5000+" or a number
    const totalCount = typeof rawTotal === 'number'
      ? rawTotal
      : parseInt(String(rawTotal ?? '0').replace(/\D/g, ''), 10) || 0;

    console.log(`[SupplierIO] OK TotalRecords=${rawTotal ?? 0} suppliers=${suppliers.length}`);
    return { suppliers, totalCount };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
