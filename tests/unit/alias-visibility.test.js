import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/auth/Auth', () => ({
  getCurrentUser: () => mockUser,
  isLoggedInAsGuest: () => mockIsGuest,
}));

let mockUser = false;
let mockIsGuest = false;

const { getUrlForAlias } = await import('@/utils/config/ConfigHelpers');

const withItem = (displayData) => [{ items: [{ alias: 'app', url: 'https://app.local', displayData }] }];
const withSection = (displayData) => [{ displayData, items: [{ alias: 'app', url: 'https://app.local' }] }];
const setGroups = (info) => { localStorage.getItem.mockReturnValue(info ? JSON.stringify(info) : null); };

describe('getUrlForAlias - visibility rules', () => {
  beforeEach(() => {
    mockUser = false;
    mockIsGuest = false;
    setGroups(null);
  });

  it('resolves an item with no visibility rules', () => {
    expect(getUrlForAlias(withItem(undefined), 'app')).toBe('https://app.local');
  });

  it('honours hideForUsers on the item', () => {
    mockUser = { user: 'alice' };
    expect(getUrlForAlias(withItem({ hideForUsers: ['Alice'] }), 'app')).toBeUndefined();
    expect(getUrlForAlias(withItem({ hideForUsers: ['bob'] }), 'app')).toBe('https://app.local');
  });

  it('honours showForUsers on the item', () => {
    mockUser = { user: 'alice' };
    expect(getUrlForAlias(withItem({ showForUsers: ['bob'] }), 'app')).toBeUndefined();
    expect(getUrlForAlias(withItem({ showForUsers: ['alice'] }), 'app')).toBe('https://app.local');
  });

  it('honours hideForGuests when browsing as a guest', () => {
    mockIsGuest = true;
    expect(getUrlForAlias(withItem({ hideForGuests: true }), 'app')).toBeUndefined();
    mockIsGuest = false;
    expect(getUrlForAlias(withItem({ hideForGuests: true }), 'app')).toBe('https://app.local');
  });

  it('honours hideForGroups and hideForRoles', () => {
    setGroups({ groups: ['devs'], roles: ['viewer'] });
    expect(getUrlForAlias(withItem({ hideForGroups: ['devs'] }), 'app')).toBeUndefined();
    expect(getUrlForAlias(withItem({ hideForRoles: ['viewer'] }), 'app')).toBeUndefined();
    expect(getUrlForAlias(withItem({ hideForGroups: ['admins'] }), 'app')).toBe('https://app.local');
  });

  it('honours showForGroups and showForRoles', () => {
    setGroups({ groups: ['devs'], roles: ['viewer'] });
    expect(getUrlForAlias(withItem({ showForGroups: ['admins'] }), 'app')).toBeUndefined();
    expect(getUrlForAlias(withItem({ showForGroups: ['devs'] }), 'app')).toBe('https://app.local');
    expect(getUrlForAlias(withItem({ showForRoles: ['viewer'] }), 'app')).toBe('https://app.local');
  });

  it('honours the same rules applied at section level', () => {
    mockUser = { user: 'alice' };
    expect(getUrlForAlias(withSection({ hideForUsers: ['alice'] }), 'app')).toBeUndefined();
    expect(getUrlForAlias(withSection({ showForUsers: ['bob'] }), 'app')).toBeUndefined();
    expect(getUrlForAlias(withSection({ hideForUsers: ['bob'] }), 'app')).toBe('https://app.local');
  });
});
