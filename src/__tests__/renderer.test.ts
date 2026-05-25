import { describe, it, expect } from 'vitest';
import { render } from '../renderer.js';
import type { SearchResult, SearchParams } from '../supplierioClient.js';

const baseSupplier = {
  SupplierID: 'S001',
  SupplierName: 'Acme Staffing',
  Description: 'IT firm',
  Address: '123 Main St',
  City: 'Austin',
  State: 'TX',
  Zip: '78701',
  Country: 'USA',
  TrustIQ: 5,
  Relationships: null,
};

const oneResult: SearchResult = { suppliers: [baseSupplier], totalCount: 1 };
const emptyResult: SearchResult = { suppliers: [], totalCount: 0 };

describe('render', () => {
  it('includes supplier name as card title', () => {
    const html = render(oneResult, {});
    expect(html).toContain('Acme Staffing');
  });

  it('includes supplier ID', () => {
    const html = render(oneResult, {});
    expect(html).toContain('S001');
  });

  it('includes full address fields', () => {
    const html = render(oneResult, {});
    expect(html).toContain('Austin');
    expect(html).toContain('78701');
  });

  it('renders TrustIQ green badge for score 4-5', () => {
    const html = render(oneResult, {});
    expect(html).toContain('badge-green');
    expect(html).toContain('TrustIQ: 5/5');
  });

  it('renders TrustIQ yellow badge for score 2-3', () => {
    const result: SearchResult = {
      suppliers: [{ ...baseSupplier, TrustIQ: 3 }],
      totalCount: 1,
    };
    const html = render(result, {});
    expect(html).toContain('badge-yellow');
    expect(html).toContain('TrustIQ: 3/5');
  });

  it('renders TrustIQ grey badge for null score', () => {
    const result: SearchResult = {
      suppliers: [{ ...baseSupplier, TrustIQ: null }],
      totalCount: 1,
    };
    const html = render(result, {});
    expect(html).toContain('badge-grey');
    expect(html).toContain('TrustIQ: N/A');
  });

  it('hides Description field when null', () => {
    const result: SearchResult = {
      suppliers: [{ ...baseSupplier, Description: null }],
      totalCount: 1,
    };
    const html = render(result, {});
    expect(html).not.toContain('Description:');
  });

  it('shows Relationships section when ParentName is present', () => {
    const result: SearchResult = {
      suppliers: [{
        ...baseSupplier,
        Relationships: {
          ParentName: 'Big Corp',
          ParentAddress: null,
          ParentCity: 'Dallas',
          ParentState: 'TX',
          UltimateParentName: 'Mega Corp',
          UltimateParentCity: 'NYC',
          UltimateParentState: 'NY',
        },
      }],
      totalCount: 1,
    };
    const html = render(result, {});
    expect(html).toContain('Big Corp');
    expect(html).toContain('Mega Corp');
    expect(html).toContain('Corporate Relationships');
  });

  it('hides Relationships section when null', () => {
    const html = render(oneResult, {});
    expect(html).not.toContain('Corporate Relationships');
  });

  it('renders summary header with result count and filters', () => {
    const params: SearchParams = { state: 'TX', diversityClassification: 'MBE' };
    const html = render(oneResult, params);
    expect(html).toContain('State: TX');
    expect(html).toContain('Diversity: MBE');
    expect(html).toContain('Showing 1 of 1');
  });

  it('renders no-results card when suppliers array is empty', () => {
    const html = render(emptyResult, { state: 'TX' });
    expect(html).toContain('No Suppliers Found');
    expect(html).toContain('TX');
  });

  it('renders error card when errorMessage is provided', () => {
    const html = render(emptyResult, {}, 'The supplier search timed out.');
    expect(html).toContain('Search Unavailable');
    expect(html).toContain('The supplier search timed out.');
  });

  it('escapes HTML special characters in supplier name', () => {
    const result: SearchResult = {
      suppliers: [{ ...baseSupplier, SupplierName: '<script>alert(1)</script>' }],
      totalCount: 1,
    };
    const html = render(result, {});
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in no-results filter message', () => {
    const html = render(emptyResult, { searchQuery: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in error message', () => {
    const html = render(emptyResult, {}, '<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders TrustIQ grey badge for score of 1', () => {
    const result: SearchResult = {
      suppliers: [{ ...baseSupplier, TrustIQ: 1 }],
      totalCount: 1,
    };
    const html = render(result, {});
    expect(html).toContain('badge-grey');
    expect(html).toContain('TrustIQ: 1/5');
  });
});
