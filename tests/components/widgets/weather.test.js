import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import request from '@/utils/request';
import Weather from '@/components/Widgets/Weather.vue';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));
vi.mock('@/utils/logging/ErrorHandler', () => ({ default: vi.fn() }));

const weatherResponse = {
  weather: [{ icon: '01d', description: 'clear sky' }],
  main: {
    temp: 20, temp_min: 18, temp_max: 22, feels_like: 19, pressure: 1013, humidity: 50,
  },
  visibility: 10000,
  wind: { speed: 3 },
  clouds: { all: 0 },
};

async function mount(options = {}) {
  const wrapper = shallowMount(Weather, {
    props: { options: { apiKey: 'test-key', city: 'London, UK', ...options } },
    global: { mocks: { $t: (key) => key } },
  });
  await flushPromises();
  return wrapper;
}

describe('Weather widget', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ data: weatherResponse });
  });

  it('shows the details straight away when hideDetails is not set', async () => {
    const wrapper = await mount();
    expect(wrapper.find('.details').exists()).toBe(true);
    expect(wrapper.findAll('.info-line').length).toBeGreaterThan(0);
    expect(wrapper.find('.more-details-btn').text()).toBe('widgets.general.show-less');
  });

  it('shows the details straight away when hideDetails is explicitly false', async () => {
    const wrapper = await mount({ hideDetails: false });
    expect(wrapper.find('.details').exists()).toBe(true);
  });

  it('never shows details when hideDetails is true', async () => {
    const wrapper = await mount({ hideDetails: true });
    expect(wrapper.find('.details').exists()).toBe(false);
    expect(wrapper.find('.more-details-btn').exists()).toBe(false);
  });

  it('still lets the user toggle details off and back on', async () => {
    const wrapper = await mount();
    expect(wrapper.find('.details').exists()).toBe(true);

    await wrapper.find('.more-details-btn').trigger('click');
    expect(wrapper.find('.details').exists()).toBe(false);
    expect(wrapper.find('.more-details-btn').text()).toBe('widgets.general.show-more');

    await wrapper.find('.more-details-btn').trigger('click');
    expect(wrapper.find('.details').exists()).toBe(true);
  });
});
