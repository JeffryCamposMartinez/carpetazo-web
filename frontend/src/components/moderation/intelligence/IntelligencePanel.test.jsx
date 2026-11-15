import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import IntelligencePanel from './IntelligencePanel';

const cov = { enabled: false, retentionDays: 90, eventsSince: null, ledgerSince: null, businessMeasuredSince: null };
const kpi = (key, value) => ({ key, label: key, unit: 'n', source: 'eventos', value, prev: null, change: null, partial: false });
const data = {
  'overview': { from: 'a', to: 'b', coverage: cov, kpis: [kpi('visits', null), { ...kpi('revenue', null), unit: 'clp', source: 'libro de pagos' }], series: [] },
  'traffic': { series: [], device: [], browser: [], os: [], source: [], medium: [], country: [], newVisitors: 0, returningVisitors: 0 },
  'pages': { rows: [] },
  'retention': { cohorts: [], overall: { d1: null, d7: null, d30: null }, coverage: cov },
  'product': { business: {}, eventsByGame: [], searches: [], scanner: { started: 0, succeeded: 0, failed: 0 }, social: [] },
  'funnels': { funnels: [{ key: 'plan', label: 'Suscripción', steps: [{ name: 'a', label: 'A', count: 0, fromStart: null, fromPrevious: null }] }], coverage: cov },
  'revenue': { confirmed: null, daily: [], byPlan: [], statuses: [], subscribers: null, mrrEstimated: null, subscriptionsNew: 0, subscriptionsCanceled: 0, coverage: cov },
  'health': { api: [], vitals: [], jsErrors: [], sessionsWithErrors: { n: 0, of: 0 } },
  'explore/options': { events: ['page_view'], groupBy: ['day'], measures: ['events'] },
  'explore': { rows: [] }
};
vi.mock('../../../services/api', () => ({ api: { get: vi.fn((url) => Promise.resolve({ data: data[url.replace('/admin/intelligence/', '').split('?')[0]] })), put: vi.fn() }, apiUrl: (x) => x }));
vi.mock('../../../services/firebase', () => ({ auth: { currentUser: null } }));

describe('Carpetazo Intelligence sin datos', () => {
  for (const view of ['overview', 'audience', 'product', 'funnels', 'business', 'health', 'explorer']) {
    it(`la vista «${view}» se dibuja sin inventar cifras cuando no hay datos`, async () => {
      const { container } = render(<IntelligencePanel view={view} go={() => {}} />);
      await waitFor(() => expect(container.querySelector('section, button[type=button] span')).not.toBeNull());
      await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
      expect(container.textContent).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('el resumen muestra «—» para lo no medido', async () => {
    render(<IntelligencePanel view="overview" go={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
    expect(screen.getByText('Apagada')).toBeTruthy();
  });
});
