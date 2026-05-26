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
    const body: Record<string, unknown> = {
      apiKey,
      customerId,
      customerName,
      rowCount: 10,
      startRecord: 0,
      country: params.country ?? 'USA',
      // Enable all enrichment flags so responses include relationships,
      // sustainability data, and small-business classifications
      enableRelationships: true,
      enableDiverse: true,
      enableSustainable: true,
      enableSIOIdentifiedSmall: true,
    };

    // Only include optional fields if provided — omitting keeps API defaults
    if (params.searchQuery)               body.searchQuery = params.searchQuery;
    if (params.organizationName)          body.organizationName = params.organizationName;
    if (params.state)                     body.state = params.state;
    if (params.naicsCode)                 body.naicsCode = params.naicsCode;
    if (params.sicCode)                   body.sicCode = params.sicCode;
    if (params.diversityClassification)   body.diversityClassification = params.diversityClassification;
    if (params.sustainabilityClassification) body.sustainabilityClassification = params.sustainabilityClassification;
    if (params.ethnicity)                 body.ethnicity = params.ethnicity;
    if (params.employee)                  body.employee = params.employee;
    if (params.revenue)                   body.revenue = params.revenue;

    const bodyJson = JSON.stringify(body);
    console.log(`[SupplierIO] POST ${ENDPOINT}: ${bodyJson.replace(/"apiKey":"[^"]*"/, '"apiKey":"***"')}`);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyJson,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[SupplierIO] error ${response.status}: ${text.slice(0, 300)}`);
      throw new Error(`API_ERROR:${response.status}`);
    }

    const data = await response.json() as { suppliers?: Supplier[]; totalCount?: number };
    console.log(`[SupplierIO] OK totalCount=${data.totalCount ?? 0} suppliers=${(data.suppliers ?? []).length}`);
    return {
      suppliers: data.suppliers ?? [],
      totalCount: data.totalCount ?? 0,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
