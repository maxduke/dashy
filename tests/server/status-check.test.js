// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import {
  describe, it, expect, beforeAll, afterAll,
} from 'vitest';
import request from 'supertest';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashy-status-test-'));
fs.writeFileSync(path.join(tmpDir, 'conf.yml'), 'pageInfo:\n  title: Test\nsections: []\n');
process.env.USER_DATA_DIR = tmpDir;

const app = require('../../services/app');

let server;
let base;

// A small local server that plays out each status-check scenario
beforeAll(async () => {
  server = http.createServer((req, res) => {
    switch (req.url.split('?')[0]) {
      case '/ok': res.writeHead(200); break;
      case '/down': res.writeHead(503); break;
      case '/teapot': res.writeHead(418); break;
      case '/redirect': res.writeHead(302, { Location: '/ok' }); break;
      case '/redirect-loop': res.writeHead(302, { Location: '/redirect-loop' }); break;
      case '/needs-header': res.writeHead(req.headers['x-key'] ? 200 : 401); break;
      default: res.writeHead(404);
    }
    res.end();
  });
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => { server.close(resolve); }));

// Run a status check against a url and return the parsed result
const check = async (url, extra = '') => {
  const res = await request(app).get(`/status-check/?&url=${encodeURIComponent(url)}${extra}`);
  return JSON.parse(res.text);
};

describe('Status check', () => {
  it('shows a service that returns 200 as online', async () => {
    expect((await check(`${base}/ok`)).successStatus).toBe(true);
  });

  it('shows a service that returns an error code as offline', async () => {
    expect((await check(`${base}/down`)).successStatus).toBe(false);
  });

  it('treats a status code you have allow-listed as a success', async () => {
    expect((await check(`${base}/teapot`, '&acceptCodes=418')).successStatus).toBe(true);
  });

  it('follows redirects when they are allowed', async () => {
    expect((await check(`${base}/redirect`, '&maxRedirects=3')).successStatus).toBe(true);
  });

  it('stops following once the redirect limit is hit', async () => {
    expect((await check(`${base}/redirect-loop`, '&maxRedirects=1')).successStatus).toBe(false);
  });

  it('sends custom headers along with the request', async () => {
    // the % in the value would throw if the headers param were decoded twice
    const headers = encodeURIComponent(JSON.stringify({ 'X-Key': '50% off' }));
    expect((await check(`${base}/needs-header`, `&headers=${headers}`)).successStatus).toBe(true);
  });

  it('reports an unreachable host as offline', async () => {
    expect((await check('http://127.0.0.1:1')).successStatus).toBe(false);
  });

  it('returns a clear error when no url is given', async () => {
    const body = await check('');
    expect(body.successStatus).toBe(false);
    expect(body.message).toMatch(/Missing or Malformed/);
  });

  it('reads the url even without the leading ampersand', async () => {
    const res = await request(app).get(`/status-check/?url=${encodeURIComponent(`${base}/ok`)}`);
    expect(JSON.parse(res.text).successStatus).toBe(true);
  });
});

describe('Ping check', () => {
  it('returns an error when no host is given', async () => {
    const res = await request(app).get('/ping-check/?count=2');
    expect(JSON.parse(res.text).successStatus).toBe(false);
  });

  it('returns an error for a request with no query', async () => {
    const res = await request(app).get('/ping-check/');
    expect(JSON.parse(res.text).successStatus).toBe(false);
  });
});
