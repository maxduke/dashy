import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import request from '@/utils/request';
import UptimeKumaStatusPage from '@/components/Widgets/UptimeKumaStatusPage.vue';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));
vi.mock('@/utils/logging/ErrorHandler', () => ({ default: vi.fn() }));

/* Display order (App, API, Docs) differs from monitor id order (5, 6, 7) */
const statusPage = {
  publicGroupList: [
    {
      name: 'Web',
      monitorList: [{ id: 5, name: 'App' }, { id: 7, name: 'API' }, { id: 6, name: 'Docs' }],
    },
    { name: 'Auth', monitorList: [] },
  ],
};

const beats = (status, msg = '') => [
  { status: 1, ping: 91, time: '2026-08-27 17:15:46' },
  {
    status, ping: 83, time: '2026-08-27 17:16:46', msg,
  },
];

const heartbeats = {
  heartbeatList: { 5: beats(1), 7: beats(0, 'timeout'), 6: beats(1) },
  uptimeList: { '5_24': 1, '7_24': 0.9876, '6_24': 0.5 },
};

const tooltips = [];
const tooltip = { mounted: (el, binding) => tooltips.push(binding.value.content) };

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
    global: { directives: { tooltip } },
  });
  await flushPromises();
  return wrapper;
}

const textOf = (wrapper, selector) => wrapper.findAll(selector).map((n) => n.text());
const names = (wrapper) => textOf(wrapper, '.title-title');

describe('UptimeKumaStatusPage widget', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); // Date only, so promises still flush
    vi.setSystemTime(new Date('2026-08-27T17:20:46Z'));
    tooltips.length = 0;
    request.mockReset();
    mockApi();
  });

  afterEach(() => vi.useRealTimers());

  it('names each monitor, in the order the status page lists them', async () => {
    expect(names(await mount())).toEqual(['App', 'API', 'Docs']);
  });

  it('shows the status and 24 hour uptime of each monitor', async () => {
    const wrapper = await mount();
    expect(textOf(wrapper, '.status-pill')).toEqual(['Up', 'Down', 'Up']);
    expect(textOf(wrapper, '.uptime')).toEqual(['100.00%', '98.76%', '50.00%']);
  });

  it('draws a bar per heartbeat, coloured by its status', async () => {
    const bars = (await mount()).findAll('.heartbeat-strip')[1].findAll('.beat');
    expect(bars).toHaveLength(2);
    expect(bars[1].classes()).toContain('down');
  });

  it('summarises each monitor in a tooltip', async () => {
    await mount();
    expect(tooltips[0]).toBe('Response: 83ms<br>Last check: 4 minutes ago');
    expect(tooltips[1]).toContain('1 of 2 recent checks failed<br>timeout');
  });

  it.each([
    ['hideHistory', '.beat'],
    ['hideUptime', '.uptime'],
    ['hideStatus', '.status-pill'],
  ])('%s hides it, leaving the rest', async (option, selector) => {
    const wrapper = await mount({ [option]: true });
    expect(wrapper.findAll(selector)).toHaveLength(0);
    expect(names(wrapper)).toEqual(['App', 'API', 'Docs']);
  });

  it('lets monitorNames override the names, falling back once it runs out', async () => {
    expect(names(await mount({ monitorNames: ['One', 'Two'] }))).toEqual(['One', 'Two', 'Docs']);
  });

  it('numbers the monitors when the status page cannot be reached', async () => {
    mockApi({ pageData: null });
    expect(names(await mount())).toEqual(['Monitor 1', 'Monitor 2', 'Monitor 3']);
  });

  it('asks for a slug when one is missing', async () => {
    const wrapper = await mount({ slug: undefined });
    expect(wrapper.find('.error-message').text()).toBe('No slug set');
    expect(request).not.toHaveBeenCalled();
  });
});
