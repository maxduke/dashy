import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentUser = false;
let headerAuthOn = true;
const sections = [{
  items: [
    { title: 'Bobs App', url: 'https://bob.local', alias: 'bobapp', displayData: { showForUsers: ['bob'] } },
  ],
}];

/* Header auth only names the user once /get-user answers, well after the router starts */
const resolveAs = (user) => () => Promise.resolve().then(() => { currentUser = { user }; });
const initHeaderAuth = vi.fn(resolveAs('alice'));

vi.mock('@/utils/auth/HeaderAuth', () => ({
  isHeaderAuthEnabled: () => headerAuthOn,
  initHeaderAuth: (...args) => initHeaderAuth(...args),
}));
vi.mock('@/utils/auth/Auth', () => ({
  getCurrentUser: () => currentUser,
  isLoggedIn: () => !!currentUser,
  isLoggedInAsGuest: () => false,
  isAuthEnabled: () => headerAuthOn || !!currentUser,
  isGuestAccessEnabled: () => false,
}));
vi.mock('@/views/Home.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/store', () => ({
  default: {
    state: { rootConfig: { sections }, config: { appConfig: {} } },
    dispatch: vi.fn(),
    commit: vi.fn(),
  },
}));

const { default: router } = await import('@/router');

/* An alias redirect deliberately aborts the navigation, so a rejection here is expected */
const visit = (path) => router.push(path).catch(() => {});

describe('alias route guard', () => {
  beforeEach(() => {
    currentUser = false;
    headerAuthOn = true;
    window.location.replace = vi.fn();
    initHeaderAuth.mockClear();
  });

  it.each([
    ['a user the item is hidden from', resolveAs('alice')],
    ['nobody at all', () => Promise.reject(Error('User from upstream proxy was not found'))],
  ])('does not redirect when header auth resolves %s', async (_label, init) => {
    initHeaderAuth.mockImplementationOnce(init);
    await visit('/bobapp');
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe('/404');
  });

  it('redirects once the resolved user is allowed to see the item', async () => {
    initHeaderAuth.mockImplementationOnce(resolveAs('bob'));
    await visit('/bobapp');
    expect(window.location.replace).toHaveBeenCalledWith('https://bob.local');
  });

  it.each([
    ['header auth is not in use', false, false],
    ['the user is already known', true, { user: 'bob' }],
  ])('redirects without waiting when %s', async (_label, headerAuth, user) => {
    headerAuthOn = headerAuth;
    currentUser = user;
    await visit('/bobapp');
    expect(initHeaderAuth).not.toHaveBeenCalled();
    expect(window.location.replace).toHaveBeenCalledWith('https://bob.local');
  });
});
