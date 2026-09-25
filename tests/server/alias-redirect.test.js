// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';

// Each item below exists to make one assertion below load-bearing
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashy-alias-redirect-'));
process.env.USER_DATA_DIR = tmpDir;
fs.writeFileSync(path.join(tmpDir, 'conf.yml'), `pageInfo: { title: Test }
sections:
  - name: Open
    items:
      - { title: Jellyfin, url: 'https://jelly.lab.local', alias: Jelly }
      - { title: Not browsable, url: 'mailto:someone@example.com', alias: mail }
      - { title: Points at itself, url: 'http://dash.lab.local/loopy', alias: loopy }
      - { title: Shadows a route, url: 'https://evil.lab.local', alias: login }
      - { title: Shadows a file, url: 'https://evil.lab.local', alias: changelog }
      - { title: Path shaped, url: 'https://evil.lab.local', alias: jelly/extra }
      - { title: Restricted, url: 'https://secret.lab.local', alias: secret,
          displayData: { showForGroups: [admins] } }
  - name: Hidden
    displayData: { hideForGuests: true }
    items:
      - { title: In hidden section, url: 'https://nope.lab.local', alias: nope }
`);
fs.writeFileSync(path.join(tmpDir, 'changelog'), 'a real static file');

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const app = require('../../services/app');

describe('Server-side alias redirect', () => {
  it.each(['/jelly', '/JELLY'])('redirects %s straight to the item URL', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://jelly.lab.local');
  });

  it.each([
    ['an unknown alias', '/nothing-here'],
    ['a reserved word an item claims', '/login'],
    ['a path-shaped alias an item claims', '/jelly/extra'],
    ['a URL that is not http(s)', '/mail'],
    ['an item carrying visibility rules', '/secret'],
    ['an item inside a restricted section', '/nope'],
  ])('leaves %s to the client', async (_label, url) => {
    expect((await request(app).get(url)).headers.location).toBeUndefined();
  });

  it('ignores requests that are not a GET', async () => {
    expect((await request(app).post('/jelly')).headers.location).toBeUndefined();
  });

  it.each([
    ['the same host', { Host: 'dash.lab.local' }, undefined],
    ['the same host in mixed case', { Host: 'Dash.Lab.Local' }, undefined],
    ['the same host via a proxy', { Host: 'dashy:8080', 'X-Forwarded-Host': 'dash.lab.local' }, undefined],
    ['a different host', { Host: 'other.lab.local' }, 'http://dash.lab.local/loopy'],
  ])('asked via %s, redirects to %s', async (_label, headers, location) => {
    const res = await request(app).get('/loopy').set(headers);
    expect(res.headers.location).toBe(location);
  });

  it('lets a real static file win over an item claiming that alias', async () => {
    const res = await request(app).get('/changelog');
    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
  });
});
