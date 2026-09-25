// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';

// Auth strategy is chosen when the app module loads, so env must be set first
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashy-alias-auth-'));
process.env.USER_DATA_DIR = tmpDir;
process.env.BASIC_AUTH_USERNAME = 'admin';
process.env.BASIC_AUTH_PASSWORD = 'test-pass';
fs.writeFileSync(path.join(tmpDir, 'conf.yml'), `pageInfo: { title: Test }
sections:
  - name: Open
    items:
      - { title: Jellyfin, url: 'https://jelly.lab.local', alias: jelly }
`);

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.BASIC_AUTH_USERNAME;
  delete process.env.BASIC_AUTH_PASSWORD;
});

const app = require('../../services/app');

describe('Server-side alias redirect, with auth configured', () => {
  it('never redirects, so the client can enforce login and visibility rules', async () => {
    const res = await request(app).get('/jelly');
    expect(res.headers.location).toBeUndefined();
    expect(res.text || '').not.toContain('jelly.lab.local');
  });
});
