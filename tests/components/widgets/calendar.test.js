import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import request from '@/utils/request';
import Calendar from '@/components/Widgets/Calendar.vue';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));
vi.mock('@/utils/logging/ErrorHandler', () => ({ default: vi.fn() }));

/* Events are written relative to a frozen clock, so the day labels stay stable */
const NOW = Date.parse('2026-09-03T08:00:00Z');
const at = (offsetDays, time) => {
  const date = new Date(NOW + offsetDays * 86400000);
  return `${date.toISOString().slice(0, 10).replace(/-/g, '')}T${time}Z`;
};

const feed = (...events) => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  ...events.map((event) => `BEGIN:VEVENT\r\n${event}\r\nEND:VEVENT`),
  'END:VCALENDAR',
].join('\r\n');

const defaultFeed = feed(
  ['UID:1', `DTSTART:${at(0, '140000')}`, `DTEND:${at(0, '150000')}`, 'SUMMARY:Team sync',
    'LOCATION:Room 2'].join('\r\n'),
  ['UID:2', 'DTSTART;VALUE=DATE:20260904', 'DTEND;VALUE=DATE:20260905',
    'SUMMARY:Company offsite'].join('\r\n'),
  ['UID:3', `DTSTART:${at(2, '090000')}`, 'SUMMARY:Dentist',
    'URL:https://example.com/appointment'].join('\r\n'),
);

const tooltips = [];
const tooltip = { mounted: (el, binding) => tooltips.push(binding.value.content) };

async function mount(options = {}) {
  const wrapper = shallowMount(Calendar, {
    props: { options: { calendarUrl: 'https://example.com/cal.ics', ...options } },
    global: { directives: { tooltip }, mocks: { $t: (key) => key } },
  });
  await flushPromises();
  return wrapper;
}

const textOf = (wrapper, selector) => wrapper.findAll(selector).map((node) => node.text());

describe('Calendar widget', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    tooltips.length = 0;
    request.mockReset();
    request.mockResolvedValue({ data: defaultFeed });
  });

  afterEach(() => vi.useRealTimers());

  it('groups events under a heading for each day', async () => {
    const wrapper = await mount();
    const labels = textOf(wrapper, '.day-label');
    expect(labels.slice(0, 2)).toEqual(['widgets.calendar.today', 'widgets.calendar.tomorrow']);
    expect(labels[2]).toMatch(/Sat.*5|5.*Sep/);
    expect(textOf(wrapper, '.event-title')).toEqual(['Team sync', 'Company offsite', 'Dentist']);
  });

  it('labels all-day events, and shows a start time for the rest', async () => {
    const wrapper = await mount();
    const times = textOf(wrapper, '.event-time');
    expect(times[1]).toBe('widgets.calendar.all-day');
    expect(times[0]).toMatch(/\d{2}:\d{2}/);
  });

  it('always fetches through the proxy, rewriting webcal links', async () => {
    await mount({ calendarUrl: 'webcal://example.com/cal.ics' });
    expect(request).toHaveBeenCalledTimes(1);
    const [config] = request.mock.calls[0];
    expect(config.url).toContain('/cors-proxy');
    expect(config.headers['Target-URL']).toBe('https://example.com/cal.ics');
  });

  it('merges several calendars, ordered by start time', async () => {
    request.mockImplementation((config) => Promise.resolve({
      data: config.headers['Target-URL'].includes('work')
        ? feed(['UID:w', `DTSTART:${at(0, '110000')}`, 'SUMMARY:Standup'].join('\r\n'))
        : feed(['UID:h', `DTSTART:${at(0, '093000')}`, 'SUMMARY:Gym'].join('\r\n')),
    }));
    const wrapper = await mount({
      calendarUrl: [
        { url: 'https://example.com/work.ics', name: 'Work', color: '#ff0000' },
        { url: 'https://example.com/home.ics', name: 'Home' },
      ],
    });
    expect(textOf(wrapper, '.event-title')).toEqual(['Gym', 'Standup']);
    expect(wrapper.findAll('.calendar-dot')).toHaveLength(1);
  });

  it('keeps rendering when only some of the calendars fail', async () => {
    request
      .mockRejectedValueOnce(new Error('unreachable'))
      .mockResolvedValueOnce({ data: defaultFeed });
    const wrapper = await mount({
      calendarUrl: ['https://example.com/broken.ics', 'https://example.com/cal.ics'],
    });
    expect(textOf(wrapper, '.event-title')).toEqual(['Team sync', 'Company offsite', 'Dentist']);
  });

  it('respects limit, hideAllDay and days', async () => {
    const limited = await mount({ limit: 2 });
    expect(textOf(limited, '.event-title')).toHaveLength(2);

    const timedOnly = await mount({ hideAllDay: true });
    expect(textOf(timedOnly, '.event-title')).toEqual(['Team sync', 'Dentist']);

    const today = await mount({ days: 1 });
    expect(textOf(today, '.event-title')).toEqual(['Team sync', 'Company offsite']);
  });

  it('links events that have a URL, and leaves the others as plain rows', async () => {
    const wrapper = await mount();
    const links = wrapper.findAll('a.event-row');
    expect(links).toHaveLength(1);
    expect(links[0].attributes('href')).toBe('https://example.com/appointment');
  });

  it('drops unsafe event URLs', async () => {
    request.mockResolvedValue({
      data: feed(['UID:1', `DTSTART:${at(0, '140000')}`, 'SUMMARY:Dodgy',
        // eslint-disable-next-line no-script-url
        'URL:javascript:alert(1)'].join('\r\n')),
    });
    const wrapper = await mount();
    expect(wrapper.findAll('a.event-row')).toHaveLength(0);
  });

  it('shows the location and calendar name in the tooltip', async () => {
    await mount({ calendarUrl: [{ url: 'https://example.com/cal.ics', name: 'Work' }] });
    expect(tooltips[0]).toContain('Work');
    expect(tooltips[0]).toContain('Room 2');
  });

  it('reports a helpful message when no calendar is configured', async () => {
    const wrapper = await mount({ calendarUrl: null });
    expect(request).not.toHaveBeenCalled();
    expect(wrapper.emitted().error[0][0]).toContain('Missing calendarUrl');
  });

  it('reports a message when the feed is not a calendar, without saying it is empty', async () => {
    request.mockResolvedValue({ data: '<html>Login page</html>' });
    const wrapper = await mount();
    expect(wrapper.emitted().error[0][0]).toContain('Unable to parse calendar');
    expect(wrapper.find('.no-events').exists()).toBe(false);
  });

  it('says so when there is nothing coming up', async () => {
    request.mockResolvedValue({ data: feed() });
    const wrapper = await mount();
    expect(wrapper.find('.no-events').text()).toBe('widgets.calendar.no-events');
  });
});
