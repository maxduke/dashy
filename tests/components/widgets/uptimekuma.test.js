import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import request from '@/utils/request';
import UptimeKuma from '@/components/Widgets/UptimeKuma.vue';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));
vi.mock('@/utils/logging/ErrorHandler', () => ({ default: vi.fn() }));

/* Prometheus rows, as Uptime Kuma writes them on /metrics */
const row = (metric, name, value) => `${metric}{monitor_id="1",monitor_name="${name}"} ${value}`;
const windowed = (metric, name, win, value) => `${metric}{monitor_name="${name}",`
  + `window="${win}"} ${value}`;

const metrics = [
  '# HELP monitor_status Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)',
  row('monitor_status', 'App', 1),
  row('monitor_status', 'Docs', 2),
  row('monitor_status', 'API', 3),
  row('monitor_response_time', 'App', 83),
  row('monitor_response_time', 'Docs', -1),
  row('monitor_response_time', 'API', 112),
  windowed('monitor_uptime_ratio', 'App', '1d', 0.9998),
  windowed('monitor_uptime_ratio', 'App', '30d', 0.5),
  windowed('monitor_response_time_seconds', 'App', '1d', 0.083),
].join('\n');

const tooltips = [];
const tooltip = { mounted: (el, binding) => tooltips.push(binding.value.content) };

async function mount(options = {}) {
  const wrapper = shallowMount(UptimeKuma, {
    props: {
      options: {
        useProxy: false,
        url: 'https://uptime.example.com/metrics',
        apiKey: 'uk1_test',
        ...options,
      },
    },
    global: { directives: { tooltip } },
  });
  await flushPromises();
  return wrapper;
}

const textOf = (wrapper, selector) => wrapper.findAll(selector).map((n) => n.text());

describe('UptimeKuma widget', () => {
  beforeEach(() => {
    tooltips.length = 0;
    request.mockReset();
    request.mockResolvedValue({ data: metrics });
  });

  it('names each monitor, from its metric labels', async () => {
    expect(textOf(await mount(), '.title-title')).toEqual(['App', 'Docs', 'API']);
  });

  it('distinguishes pending and maintenance from down', async () => {
    const pills = (await mount()).findAll('.status-pill');
    expect(pills.map((p) => p.text())).toEqual(['Up', 'Pending', 'Maintenance']);
    expect(pills[1].classes()).toContain('pending');
  });

  it('shows a placeholder for a monitor with no ping, which Kuma reports as -1', async () => {
    expect(textOf(await mount(), '.response-time')).toEqual(['83ms', '-', '112ms']);
  });

  it('shows 24 hour uptime in the row, and the other windows in a tooltip', async () => {
    const wrapper = await mount();
    expect(textOf(wrapper, '.uptime')).toEqual(['99.98%']);
    expect(tooltips[0]).toBe('Uptime: 99.98% (24h), 50.00% (30d)<br>Avg response: 83ms (24h)');
  });

  it.each([
    ['hideStatus', '.status-pill'],
    ['hideResponseTime', '.response-time'],
    ['hideUptime', '.uptime'],
  ])('%s hides it, leaving the rest', async (option, selector) => {
    const wrapper = await mount({ [option]: true });
    expect(wrapper.findAll(selector)).toHaveLength(0);
    expect(textOf(wrapper, '.title-title')).toEqual(['App', 'Docs', 'API']);
  });

  it.each([
    ['apiKey', 'No API key set'],
    ['url', 'No URL set'],
  ])('asks for a %s when one is missing', async (option, message) => {
    const wrapper = await mount({ [option]: undefined });
    expect(wrapper.find('.error-message').text()).toBe(message);
    expect(request).not.toHaveBeenCalled();
  });

  it('shows a message when the request fails', async () => {
    request.mockRejectedValue(new Error('Request failed with status code 401'));
    expect((await mount()).find('.error-message').text()).toContain('401');
  });
});
