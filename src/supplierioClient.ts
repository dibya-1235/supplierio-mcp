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
  searchQuery?: string;
  state?: string;
  naicsCode?: string;
  diversityClassification?: string;
  employee?: string;
  revenue?: string;
  country?: string;
}

const ENDPOINT = 'https://api.supplier.io/supplier/GetSearchDetail';
const TIMEOUT_MS = 5000;

export async function searchSuppliers(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.SUPPLIERIO_API_KEY;
  const customerId = process.env.SUPPLIERIO_CUSTOMER_ID;

  if (!apiKey || !customerId) {
    throw new Error('Supplier search is not configured. Please contact your administrator.');
  }

  // Diagnostic: log length and boundary chars to catch extra quotes/spaces without exposing secrets
  console.log(`[SupplierIO] apiKey len=${apiKey.length} first=${JSON.stringify(apiKey[0])} last=${JSON.stringify(apiKey[apiKey.length-1])}`);
  console.log(`[SupplierIO] customerId len=${customerId.length} first=${JSON.stringify(customerId[0])} last=${JSON.stringify(customerId[customerId.length-1])}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      apiKey,
      customerId,
      rowCount: 10,
      startRecord: 0,
      country: params.country ?? 'USA',
    };
    if (params.searchQuery) body.searchQuery = params.searchQuery;
    if (params.state) body.state = params.state;
    if (params.naicsCode) body.naicsCode = params.naicsCode;
    if (params.diversityClassification) body.diversityClassification = params.diversityClassification;
    if (params.employee) body.employee = params.employee;
    if (params.revenue) body.revenue = params.revenue;

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[SupplierIO] API error ${response.status}: ${body.slice(0, 300)}`);
      throw new Error(`API_ERROR:${response.status}`);
    }

    const data = await response.json() as { suppliers?: Supplier[]; totalCount?: number };
    console.log(`[SupplierIO] OK totalCount=${data.totalCount ?? 0} suppliers=${(data.suppliers ?? []).length}`);
    return {
      suppliers: data.suppliers ?? [],
      totalCount: data.totalCount ?? 0,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
