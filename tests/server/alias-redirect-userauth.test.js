// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';

// conf.yml users without ENABLE_HTTP_AUTH is Dashy's standard client-side login
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashy-alias-userauth-'));
process.env.USER_DATA_DIR = tmpDir;
fs.writeFileSync(path.join(tmpDir, 'conf.yml'), `pageInfo: { title: Test }
appConfig:
  auth:
    users:
      - { user: alicia, hash: ABC123 }
sections:
  - name: Open
    items:
      - { title: Jellyfin, url: 'https://jelly.lab.local', alias: jelly }
`);

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const app = require('../../services/app');

describe('Server-side alias redirect, with client-side login configured', () => {
  it('never redirects past the login page', async () => {
    const res = await request(app).get('/jelly');
    expect(res.headers.location).toBeUndefined();
    expect(res.text || '').not.toContain('jelly.lab.local');
  });
});
