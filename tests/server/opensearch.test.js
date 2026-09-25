// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import request from 'supertest';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashy-opensearch-test-'));
fs.writeFileSync(path.join(tmpDir, 'conf.yml'), "pageInfo:\n  title: Alicia & Co's Very Long Dashboard\nsections: []\n");
process.env.USER_DATA_DIR = tmpDir;

const app = require('../../services/app');

describe('OpenSearch descriptor', () => {
  it('is served as an OpenSearch document', async () => {
    const res = await request(app).get('/opensearch.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/opensearchdescription\+xml/);
  });

  it('builds the search template from the requesting host', async () => {
    const res = await request(app).get('/opensearch.xml').set('Host', 'dash.lab.local');
    expect(res.text).toContain('template="http://dash.lab.local/{searchTerms}"');
  });

  it('honours a reverse proxy\'s forwarded protocol and host', async () => {
    const res = await request(app).get('/opensearch.xml')
      .set('X-Forwarded-Proto', 'https').set('X-Forwarded-Host', 'dash.example.com');
    expect(res.text).toContain('template="https://dash.example.com/{searchTerms}"');
  });

  it('takes the first value when a proxy chain sends a list', async () => {
    const res = await request(app).get('/opensearch.xml')
      .set('X-Forwarded-Proto', 'https, http').set('X-Forwarded-Host', 'outer.example.com, inner.local');
    expect(res.text).toContain('template="https://outer.example.com/{searchTerms}"');
  });

  it('uses a ShortName matching the <link> title, so browsers accept the descriptor', async () => {
    const res = await request(app).get('/opensearch.xml');
    const indexHtml = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    const linkTitle = indexHtml.match(/<link rel="search"[^>]*title="([^"]+)"/)[1];
    expect(res.text).toContain(`<ShortName>${linkTitle}</ShortName>`);
  });

  it('escapes the configured title in the description', async () => {
    const res = await request(app).get('/opensearch.xml');
    expect(res.text).toContain('Alicia &amp; Co&apos;s Very Long Dashboard by its alias');
  });

  it.each([[2024, '2024'], [true, 'true'], [3.14, '3.14']])(
    'renders a title YAML coerced to the non-string %s', (title, expected) => {
      const openSearch = require('../../services/endpoints/opensearch');
      const xml = openSearch({ pageInfo: { title } }, { headers: { host: 'x.local' }, socket: {} });
      expect(xml).toContain(`Jump to an app on ${expected} by its alias`);
    },
  );

  it('escapes a hostile Host header rather than emitting raw XML', async () => {
    const res = await request(app).get('/opensearch.xml').set('Host', 'evil"><script>x</script>');
    expect(res.text).not.toContain('<script>');
    expect(res.text).toContain('&quot;&gt;&lt;script&gt;');
  });
});
