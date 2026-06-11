import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import CustomApi from '@/components/Widgets/CustomApi.vue';

const response = {
  name: 'dashy',
  stars: 1234,
  pushed_at: '2026-06-08T00:00:00Z',
  items: [1, 2, 3],
};

vi.mock('@/utils/request', () => {
  const fn = vi.fn(() => Promise.resolve({ data: response }));
  fn.get = fn; fn.post = fn; fn.put = fn;
  return { default: fn };
});
vi.mock('@/utils/logging/ErrorHandler', () => ({ default: vi.fn() }));

/** Mount CustomApi with the given options object */
function mountWidget(options) {
  return shallowMount(CustomApi, { props: { options } });
}

describe('CustomApi widget', () => {
  let wrapper;
  afterEach(() => wrapper && wrapper.unmount());

  it('renders a row per mapping with formatted values', async () => {
    wrapper = mountWidget({
      url: 'https://example.com',
      mappings: [
        { field: 'stars', label: 'Stars', format: 'number' },
        { label: 'Item count', format: 'size', field: 'items' },
      ],
    });
    await flushPromises();
    const rows = wrapper.findAll('.row');
    expect(rows).toHaveLength(2);
    expect(wrapper.text()).toContain('Stars');
    expect(wrapper.text()).toContain('1,234');
    expect(wrapper.text()).toContain('3');
  });

  it('applies the list display class', () => {
    wrapper = mountWidget({ url: 'https://example.com', display: 'list' });
    expect(wrapper.find('.customapi-wrapper').classes()).toContain('list');
  });

  it('renders an additionalField with its colour class', async () => {
    wrapper = mountWidget({
      url: 'https://example.com',
      mappings: [
        { field: 'name', label: 'Repo', additionalField: { field: 'stars', color: 'theme' } },
      ],
    });
    await flushPromises();
    expect(wrapper.find('.additional').classes()).toContain('color-theme');
  });

  it('resolves an adaptive colour from the value sign', async () => {
    wrapper = mountWidget({
      url: 'https://example.com',
      mappings: [
        { field: 'name', label: 'Repo', additionalField: { field: 'stars', color: 'adaptive' } },
      ],
    });
    await flushPromises();
    // stars (1234) is positive -> success
    expect(wrapper.find('.additional').classes()).toContain('color-success');
  });

  describe('mergedHeaders content-type', () => {
    it('defaults to application/json for a body-bearing method', () => {
      wrapper = mountWidget({ url: 'https://example.com', method: 'POST', requestBody: { a: 1 } });
      expect(wrapper.vm.mergedHeaders['Content-Type']).toBe('application/json');
    });
    it('does not add a content-type for GET', () => {
      wrapper = mountWidget({ url: 'https://example.com', requestBody: { a: 1 } });
      const keys = Object.keys(wrapper.vm.mergedHeaders).map((k) => k.toLowerCase());
      expect(keys).not.toContain('content-type');
    });
    it('respects a user-provided content-type', () => {
      wrapper = mountWidget({
        url: 'https://example.com',
        method: 'POST',
        requestBody: '<xml/>',
        headers: { 'Content-Type': 'application/xml' },
      });
      expect(wrapper.vm.mergedHeaders['Content-Type']).toBe('application/xml');
    });
  });

  describe('updateInterval', () => {
    it('defaults to 10s', () => {
      wrapper = mountWidget({ url: 'https://example.com' });
      expect(wrapper.vm.updateInterval).toBe(10000);
    });
    it('uses refreshInterval (ms) when given', () => {
      wrapper = mountWidget({ url: 'https://example.com', refreshInterval: 30000 });
      expect(wrapper.vm.updateInterval).toBe(30000);
    });
    it('falls back to native updateInterval (seconds)', () => {
      wrapper = mountWidget({ url: 'https://example.com', updateInterval: 5 });
      expect(wrapper.vm.updateInterval).toBe(5000);
    });
    it('returns 0 when refreshInterval is disabled', () => {
      wrapper = mountWidget({ url: 'https://example.com', refreshInterval: 0 });
      expect(wrapper.vm.updateInterval).toBe(0);
    });
  });
});
