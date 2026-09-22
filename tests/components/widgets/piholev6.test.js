import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import request from '@/utils/request';
import PiHoleTopQueriesV6 from '@/components/Widgets/PiHoleTopQueriesV6.vue';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));
vi.mock('@/utils/logging/ErrorHandler', () => ({ default: vi.fn() }));

const session = {
  valid: true, sid: 'sid-1', csrf: 'csrf-1', validity: 1800,
};
const domains = { domains: [{ domain: 'example.com', count: 3 }] };
const sessionKey = 'piHoleSession-http://pi.hole';
const storage = new Map();

function mount(options = {}) {
  return shallowMount(PiHoleTopQueriesV6, {
    props: { options: { hostname: 'http://pi.hole', apiKey: 'app-pw', ...options } },
  });
}

const calls = () => request.mock.calls.map(([config]) => config);
const methods = () => calls().map((c) => c.method);

describe('PiHoleTopQueriesV6 widget', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation(({ method }) => Promise.resolve({
      data: method === 'POST' ? { session } : domains,
    }));
    storage.clear();
    localStorage.getItem.mockImplementation((key) => storage.get(key) ?? null);
    localStorage.setItem.mockImplementation((key, value) => storage.set(key, value));
    localStorage.removeItem.mockImplementation((key) => storage.delete(key));
  });

  it('logs in, then sends the session with each request', async () => {
    const wrapper = mount();
    await flushPromises();
    const [login, ...queries] = calls();
    expect(login).toMatchObject({ method: 'POST', url: 'http://pi.hole/api/auth' });
    expect(JSON.parse(login.data)).toEqual({ password: 'app-pw' });
    expect(queries).toHaveLength(2);
    queries.forEach(({ headers }) => {
      expect(headers).toMatchObject({ 'X-FTL-SID': 'sid-1', 'X-FTL-CSRF': 'csrf-1' });
    });
    expect(wrapper.find('.domain').text()).toBe('example.com');
  });

  it('stores the session, and reuses it while still valid', async () => {
    mount();
    await flushPromises();
    expect(JSON.parse(storage.get(sessionKey))).toMatchObject({ sid: 'sid-1', csrf: 'csrf-1' });

    request.mockClear();
    mount();
    await flushPromises();
    expect(methods()).toEqual(['GET', 'GET']);
  });

  it('logs in again once the stored session has expired', async () => {
    storage.set(sessionKey, JSON.stringify({ sid: 'old', expires: Date.now() - 1 }));
    mount();
    await flushPromises();
    expect(methods()[0]).toBe('POST');
  });

  it('shares one login between widgets mounted together', async () => {
    const wrappers = [mount(), mount()];
    await flushPromises();
    expect(methods().filter((m) => m === 'POST')).toHaveLength(1);
    wrappers.forEach((w) => expect(w.find('.domain').text()).toBe('example.com'));
  });

  it('sends the login body as JSON when going through the proxy', async () => {
    mount({ useProxy: true });
    await flushPromises();
    const [login] = calls();
    expect(login.url).toContain('/cors-proxy');
    expect(login.headers).toMatchObject({
      'Target-URL': 'http://pi.hole/api/auth',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(login.data)).toEqual({ password: 'app-pw' });
  });

  it('forgets the session when a request with it fails', async () => {
    request.mockImplementation(({ method }) => (method === 'POST'
      ? Promise.resolve({ data: { session } })
      : Promise.reject(new Error('Request failed with status 401'))));
    mount();
    await flushPromises();
    expect(storage.has(sessionKey)).toBe(false);
  });
});
