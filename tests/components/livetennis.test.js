import {
  describe, it, expect, afterEach, vi,
} from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import LiveTennis from '@/components/Widgets/LiveTennis.vue';

/* Trimmed from a real api.livetennisapi.com /matches?status=live response */
const liveResponse = {
  data: [
    {
      id: 21443,
      format: 'BO3',
      is_doubles: false,
      round: 'M15 Brisbane - 1/16-finals',
      scheduled_time: '2026-07-22T04:00:00Z',
      status: 'live',
      surface: 'hard',
      tournament: 'M15 Brisbane',
      players: {
        p1: { id: 1011, name: 'Matthew Dellavedova', country: 'aus', ranking: 310 },
        p2: { id: 8048, name: 'Hayden Jones', country: 'aus', ranking: 1235 },
      },
      score: {
        games: [[7, 1], [5, 0]],
        is_tiebreak: false,
        points: ['40', '15'],
        server: 2,
        sets: [1, 0],
      },
    },
  ],
  meta: { count: 1, limit: 5, offset: 0 },
};

/* An upcoming match carries a null score */
const upcomingResponse = {
  data: [
    {
      id: 21487,
      status: 'upcoming',
      round: 'W15 Brisbane 2 - 1/16-finals',
      tournament: 'W15 Brisbane 2 (Australia)',
      scheduled_time: '2026-07-22T04:30:00Z',
      players: {
        p1: { id: 2485, name: 'Mutsumi Uemura', ranking: 1022 },
        p2: { id: 9001, name: 'Jane Doe', ranking: null },
      },
      score: null,
    },
  ],
  meta: { count: 1, limit: 5, offset: 0 },
};

const completedResponse = {
  data: [
    {
      id: 21494,
      status: 'completed',
      round: 'W15 Brisbane 2 - 1/16-finals',
      tournament: 'W15 Brisbane 2 (Australia)',
      players: {
        p1: { id: 8134, name: 'Belle Thompson', ranking: 717 },
        p2: { id: 8135, name: 'Amy Roe', ranking: 980 },
      },
      score: {
        games: [[6, 6], [4, 0]], is_tiebreak: false, points: ['0', '0'], server: 2, sets: [2, 0],
      },
    },
  ],
  meta: { count: 1, limit: 5, offset: 0 },
};

let mockResponse = liveResponse;

vi.mock('@/utils/request', () => {
  const fn = vi.fn(() => Promise.resolve({ data: mockResponse }));
  fn.get = fn; fn.post = fn; fn.put = fn;
  return { default: fn };
});
vi.mock('@/utils/logging/ErrorHandler', () => ({ default: vi.fn() }));

/* WidgetBase always passes these through, so mirror it for a realistic mount */
const baseOptions = {
  timeout: null, ignoreErrors: false, label: null, useProxy: false, updateInterval: null,
};

/** Mount LiveTennis with the given options, stubbing the global tooltip directive */
function mountWidget(options = {}) {
  return shallowMount(LiveTennis, {
    props: { options: { ...baseOptions, apiKey: 'twjp_test', ...options } },
    global: { directives: { tooltip: {} } },
  });
}

describe('LiveTennis widget', () => {
  let wrapper;
  afterEach(() => {
    mockResponse = liveResponse;
    if (wrapper) wrapper.unmount();
  });

  it('renders a block per match, with a row per player', async () => {
    wrapper = mountWidget();
    await flushPromises();
    expect(wrapper.findAll('.match')).toHaveLength(1);
    expect(wrapper.findAll('.player')).toHaveLength(2);
    expect(wrapper.text()).toContain('Matthew Dellavedova');
    expect(wrapper.text()).toContain('Hayden Jones');
  });

  it('shows the tournament, round and a live status label', async () => {
    wrapper = mountWidget();
    await flushPromises();
    expect(wrapper.find('.tournament').text()).toBe('M15 Brisbane');
    expect(wrapper.find('.round').text()).toBe('M15 Brisbane - 1/16-finals');
    expect(wrapper.find('.status').text()).toBe('Live');
    expect(wrapper.find('.status').classes()).toContain('status-live');
  });

  it('renders per-set game scores for both players', async () => {
    wrapper = mountWidget();
    await flushPromises();
    const rows = wrapper.findAll('.player');
    const setsOf = (row) => row.findAll('.set').map((s) => s.text());
    expect(setsOf(rows[0])).toEqual(['7', '1']);
    expect(setsOf(rows[1])).toEqual(['5', '0']);
  });

  it('marks the set in progress as current', async () => {
    wrapper = mountWidget();
    await flushPromises();
    const sets = wrapper.findAll('.player')[0].findAll('.set');
    expect(sets[0].classes()).not.toContain('current');
    expect(sets[1].classes()).toContain('current');
  });

  it('flags the serving player, and only that player', async () => {
    wrapper = mountWidget();
    await flushPromises();
    const rows = wrapper.findAll('.player');
    // The fixture has server: 2, so p2 (the second row) is serving
    expect(rows[0].classes()).not.toContain('serving');
    expect(rows[1].classes()).toContain('serving');
  });

  it('shows current game points for a live match', async () => {
    wrapper = mountWidget();
    await flushPromises();
    const points = wrapper.findAll('.points').map((p) => p.text());
    expect(points).toEqual(['40', '15']);
  });

  it('shows rankings, and hides them when hideRankings is set', async () => {
    wrapper = mountWidget();
    await flushPromises();
    expect(wrapper.find('.ranking').text()).toBe('#310');
    wrapper.unmount();

    wrapper = mountWidget({ hideRankings: true });
    await flushPromises();
    expect(wrapper.find('.ranking').exists()).toBe(false);
  });

  it('handles an upcoming match, which has a null score', async () => {
    mockResponse = upcomingResponse;
    wrapper = mountWidget({ status: 'upcoming' });
    await flushPromises();
    expect(wrapper.findAll('.player')).toHaveLength(2);
    expect(wrapper.find('.status').text()).toBe('Upcoming');
    // No score means no set columns and no points shown
    expect(wrapper.findAll('.set')).toHaveLength(0);
    expect(wrapper.findAll('.points')).toHaveLength(0);
  });

  it('bolds the winner only once a match is completed', async () => {
    mockResponse = completedResponse;
    wrapper = mountWidget({ status: 'completed' });
    await flushPromises();
    const rows = wrapper.findAll('.player');
    expect(rows[0].classes()).toContain('winner');
    expect(rows[1].classes()).not.toContain('winner');
    // A finished match shows no in-progress point score
    expect(wrapper.findAll('.points')).toHaveLength(0);
  });

  it('does not show a serve indicator on a finished match', async () => {
    mockResponse = completedResponse;
    wrapper = mountWidget({ status: 'completed' });
    await flushPromises();
    // The API keeps the last server (2) on a completed match; nobody is serving now
    expect(wrapper.findAll('.player.serving')).toHaveLength(0);
    expect(wrapper.find('.serve-indicator').text()).toBe('');
  });

  it('does not mark a set leader as the winner while still live', async () => {
    wrapper = mountWidget();
    await flushPromises();
    // p1 leads the live fixture 1-0 on sets, but has not won it
    expect(wrapper.findAll('.player')[0].classes()).not.toContain('winner');
  });

  it('shows an empty state when no matches are in play', async () => {
    mockResponse = { data: [], meta: { count: 0 } };
    wrapper = mountWidget();
    await flushPromises();
    expect(wrapper.find('.no-matches').text()).toBe('No live matches');
    expect(wrapper.findAll('.match')).toHaveLength(0);
  });

  it('tolerates a malformed response without throwing', async () => {
    mockResponse = {};
    wrapper = mountWidget();
    await flushPromises();
    expect(wrapper.findAll('.match')).toHaveLength(0);
  });

  describe('configuration', () => {
    it('builds the endpoint from status and limit', () => {
      wrapper = mountWidget({ status: 'upcoming', limit: 3 });
      expect(wrapper.vm.endpoint).toBe(
        'https://api.livetennisapi.com/api/public/v1/matches?status=upcoming&limit=3',
      );
    });

    it('defaults to 5 live matches', () => {
      wrapper = mountWidget();
      expect(wrapper.vm.status).toBe('live');
      expect(wrapper.vm.limit).toBe(5);
    });

    it('falls back to live for an unrecognised status', () => {
      wrapper = mountWidget({ status: 'nonsense' });
      expect(wrapper.vm.status).toBe('live');
    });

    it('sends the api key as a bearer token', () => {
      wrapper = mountWidget({ apiKey: 'twjp_abc' });
      expect(wrapper.vm.headers).toEqual({ Authorization: 'Bearer twjp_abc' });
    });

    it('refreshes every 60s by default, to stay inside the free rate limit', () => {
      wrapper = mountWidget();
      expect(wrapper.vm.updateInterval).toBe(60000);
    });

    it('errors, and makes no request, when the apiKey is missing', async () => {
      const request = (await import('@/utils/request')).default;
      request.mockClear();
      wrapper = shallowMount(LiveTennis, {
        props: { options: { ...baseOptions } },
        global: { directives: { tooltip: {} } },
      });
      await flushPromises();
      expect(request).not.toHaveBeenCalled();
      expect(wrapper.emitted().error).toBeTruthy();
    });
  });
});
