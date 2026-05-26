import type { SearchResult, SearchParams, Supplier } from './supplierioClient.js';

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #212529; padding: 24px; }
  .summary { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
  .summary h2 { font-size: 15px; font-weight: 600; color: #343a40; }
  .summary .meta { font-size: 13px; color: #6c757d; margin-top: 6px; }
  .filter-tag { display: inline-block; background: #e9ecef; color: #495057; border-radius: 4px; padding: 2px 8px; font-size: 12px; margin: 2px 2px 0 0; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
  .card { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .card-name { font-size: 16px; font-weight: 700; color: #212529; margin-bottom: 4px; }
  .card-id { font-size: 11px; color: #adb5bd; margin-bottom: 12px; }
  .field { font-size: 13px; color: #495057; margin-bottom: 5px; line-height: 1.5; }
  .field-label { font-weight: 600; color: #343a40; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .tag { display: inline-block; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
  .tag-diversity { background: #d1fae5; color: #065f46; }
  .tag-sustain  { background: #dbeafe; color: #1e40af; }
  .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-top: 10px; margin-right: 4px; }
  .badge-green  { background: #d1fae5; color: #065f46; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-grey   { background: #f3f4f6; color: #6b7280; }
  .rel { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f3f5; }
  .rel-title { font-size: 11px; font-weight: 700; color: #adb5bd; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
  .no-results { text-align: center; padding: 48px 24px; background: #fff; border: 1px solid #dee2e6; border-radius: 8px; }
  .no-results h3 { font-size: 18px; color: #495057; margin-bottom: 8px; }
  .no-results p  { font-size: 14px; color: #6c757d; }
  .error-card { text-align: center; padding: 32px; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; }
  .error-card h3 { color: #c53030; margin-bottom: 8px; }
  .error-card p  { font-size: 14px; color: #742a2a; }
`;

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function field(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `<div class="field"><span class="field-label">${label}:</span> ${esc(value)}</div>`;
}

function trustIQBadge(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return '<span class="badge badge-grey">TrustIQ: N/A</span>';
  }
  const cls = score >= 4 ? 'badge-green' : score >= 2 ? 'badge-yellow' : 'badge-grey';
  return `<span class="badge ${cls}">TrustIQ: ${score}/5</span>`;
}

function diversityTags(items: string[] | null | undefined): string {
  if (!items || items.length === 0) return '';
  return `<div class="tags">${items.map(t => `<span class="tag tag-diversity">${esc(t)}</span>`).join('')}</div>`;
}

function sustainabilityTags(items: string[] | null | undefined): string {
  if (!items || items.length === 0) return '';
  return `<div class="tags">${items.map(t => `<span class="tag tag-sustain">${esc(t)}</span>`).join('')}</div>`;
}

function renderCard(supplier: Supplier): string {
  const addressParts = [supplier.Address, supplier.City, supplier.State, supplier.Zip, supplier.Country].filter(Boolean);

  const rel = supplier.Relationships;
  const hasRel = rel && (rel.ParentName || rel.UltimateParentName);
  const relSection = hasRel
    ? `<div class="rel">
        <div class="rel-title">Corporate Relationships</div>
        ${field('Parent Company', rel.ParentName)}
        ${[rel.ParentAddress, rel.ParentCity, rel.ParentState].filter(Boolean).length
          ? `<div class="field"><span class="field-label">Parent Location:</span> ${esc([rel.ParentAddress, rel.ParentCity, rel.ParentState].filter(Boolean).join(', '))}</div>`
          : ''}
        ${field('Ultimate Parent', rel.UltimateParentName)}
        ${[rel.UltimateParentCity, rel.UltimateParentState].filter(Boolean).length
          ? `<div class="field"><span class="field-label">Ultimate Parent Location:</span> ${esc([rel.UltimateParentCity, rel.UltimateParentState].filter(Boolean).join(', '))}</div>`
          : ''}
      </div>`
    : '';

  const hasDiversity = supplier.Diversity && supplier.Diversity.length > 0;
  const hasSustain = supplier.Sustainability && supplier.Sustainability.length > 0;

  return `<div class="card">
    <div class="card-name">${esc(supplier.SupplierName)}</div>
    <div class="card-id">ID: ${esc(supplier.SupplierID)}</div>
    ${addressParts.length ? `<div class="field">${esc(addressParts.join(', '))}</div>` : ''}
    ${field('Description', supplier.Description)}
    ${trustIQBadge(supplier.TrustIQ)}
    ${hasDiversity ? `<div class="field" style="margin-top:8px"><span class="field-label">Diversity:</span></div>${diversityTags(supplier.Diversity)}` : ''}
    ${hasSustain ? `<div class="field" style="margin-top:6px"><span class="field-label">Sustainability:</span></div>${sustainabilityTags(supplier.Sustainability)}` : ''}
    ${relSection}
  </div>`;
}

function renderSummary(params: SearchParams, totalCount: number, resultCount: number): string {
  const tags = [
    params.searchQuery ? `Keyword: "${params.searchQuery}"` : null,
    params.organizationName ? `Name: "${params.organizationName}"` : null,
    params.state ? `State: ${params.state}` : null,
    params.naicsCode ? `NAICS: ${params.naicsCode}` : null,
    params.sicCode ? `SIC: ${params.sicCode}` : null,
    params.diversityClassification ? `Diversity: ${params.diversityClassification}` : null,
    params.sustainabilityClassification ? `Sustainability: ${params.sustainabilityClassification}` : null,
    params.ethnicity ? `Ethnicity: ${params.ethnicity}` : null,
    params.employee ? `Employees: ${params.employee}` : null,
    params.revenue ? `Revenue: ${params.revenue}` : null,
    params.country && params.country !== 'USA' ? `Country: ${params.country}` : null,
  ].filter((t): t is string => t !== null);

  return `<div class="summary">
    <h2>Supplier.io Search Results</h2>
    <div class="meta">Showing ${resultCount} of ${totalCount} results${tags.length ? ' &middot; ' + tags.map(t => `<span class="filter-tag">${esc(t)}</span>`).join('') : ''}</div>
  </div>`;
}

function wrapPage(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Supplier.io Results</title>
  <style>${CSS}</style>
</head>
<body>${content}</body>
</html>`;
}

export function render(result: SearchResult, params: SearchParams, errorMessage?: string): string {
  if (errorMessage) {
    return wrapPage(`<div class="error-card"><h3>Search Unavailable</h3><p>${esc(errorMessage)}</p></div>`);
  }

  if (result.suppliers.length === 0) {
    const filters = [
      params.searchQuery ? `keyword "${params.searchQuery}"` : null,
      params.organizationName ? `name "${params.organizationName}"` : null,
      params.state ? `state ${params.state}` : null,
      params.diversityClassification ? `classification ${params.diversityClassification}` : null,
      params.naicsCode ? `NAICS ${params.naicsCode}` : null,
    ].filter((f): f is string => f !== null).join(', ');
    return wrapPage(`<div class="no-results"><h3>No Suppliers Found</h3><p>No results matched your search${filters ? ` for ${esc(filters)}` : ''}. Try broadening your filters.</p></div>`);
  }

  const summary = renderSummary(params, result.totalCount, result.suppliers.length);
  const cards = result.suppliers.map(renderCard).join('');
  return wrapPage(`${summary}<div class="grid">${cards}</div>`);
}
