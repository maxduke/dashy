import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import request from '@/utils/request';
import UptimeKumaStatusPage from '@/components/Widgets/UptimeKumaStatusPage.vue';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));
vi.mock('@/utils/logging/ErrorHandler', () => ({ default: vi.fn() }));

/* Note the display order (App, API, Docs) differs from monitor id order (5, 6, 7) */
const statusPage = {
  publicGroupList: [
    {
      name: 'Web',
      monitorList: [{ id: 5, name: 'App' }, { id: 7, name: 'API' }, { id: 6, name: 'Docs' }],
    },
    { name: 'Auth', monitorList: [] },
  ],
};

const beats = (status) => [{ status: 1, ping: 91 }, { status, ping: 83 }];
const heartbeats = { heartbeatList: { 5: beats(1), 7: beats(0), 6: beats(1) } };

/* Heartbeats and monitor names come from two separate endpoints */
function mockApi({ beatData = heartbeats, pageData = statusPage } = {}) {
  request.mockImplementation(({ url }) => {
    if (url.includes('/heartbeat/')) return Promise.resolve({ data: beatData });
    if (!pageData) return Promise.reject(new Error('Status Page Not Found'));
    return Promise.resolve({ data: pageData });
  });
}

async function mount(options = {}) {
  const wrapper = shallowMount(UptimeKumaStatusPage, {
    props: {
      options: {
        useProxy: false, host: 'https://uptime.example.com', slug: 'domain-locker', ...options,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

const names = (wrapper) => wrapper.findAll('.title-title').map((n) => n.text());

describe('UptimeKumaStatusPage widget', () => {
  beforeEach(() => {
    request.mockReset();
    mockApi();
  });

  it('names each monitor, in the order the status page lists them', async () => {
    expect(names(await mount())).toEqual(['App', 'API', 'Docs']);
  });

  it('shows each monitor status, from its latest heartbeat', async () => {
    const pills = (await mount()).findAll('.status-pill');
    expect(pills.map((p) => p.text())).toEqual(['Up', 'Down', 'Up']);
    expect(pills[1].classes()).toContain('down');
  });

  it('lets monitorNames override the names from Uptime Kuma', async () => {
    expect(names(await mount({ monitorNames: ['One', 'Two', 'Three'] }))).toEqual(['One', 'Two', 'Three']);
  });

  it('keeps the real name where monitorNames runs out', async () => {
    expect(names(await mount({ monitorNames: ['One'] }))).toEqual(['One', 'API', 'Docs']);
  });

  it('ignores a monitorNames given as a string rather than a list', async () => {
    expect(names(await mount({ monitorNames: '["One","Two"]' }))).toEqual(['App', 'API', 'Docs']);
  });

  it('numbers the monitors when the status page cannot be reached', async () => {
    mockApi({ pageData: null });
    expect(names(await mount())).toEqual(['Monitor 1', 'Monitor 2', 'Monitor 3']);
  });

  it('skips monitors with no heartbeats yet', async () => {
    mockApi({ beatData: { heartbeatList: { 5: beats(1), 7: [], 6: beats(1) } } });
    expect(names(await mount())).toEqual(['App', 'Docs']);
  });

  it('asks for a slug when one is missing', async () => {
    const wrapper = await mount({ slug: undefined });
    expect(wrapper.find('.error-message').text()).toBe('No slug set');
    expect(request).not.toHaveBeenCalled();
  });
});
