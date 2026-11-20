import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { loadPublicVocabulary } from '../src/vocabulary.js';
import { emptyState, personalSnapshot, readPersonalNotes, parseWords } from '../src/data.js';
import { vocabularyConfig } from '../src/config.js';

const dataset = { version: 1, metadata: { name: 'Fixture vocabulary' }, words: [{ word: 'test-word', meaning: '测试', notes: 'public notes must not become personal notes' }] };
const bytes = Buffer.from(JSON.stringify(dataset));
const manifest = { schemaVersion: 1, name: 'Fixture vocabulary', version: '1.0.0', wordCount: 1, words: { path: './words.json', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } };
const config = { manifestUrl: 'https://data.example.com/releases/v1/manifest.json', timeoutMs: 200 };
const mockFetch = (release = manifest, content = bytes) => async url => url.endsWith('/manifest.json') ? new Response(JSON.stringify(release)) : new Response(content);

test('loads a separate public repository, verifies bytes and resolves relative paths', async () => {
  const calls = [];
  const result = await loadPublicVocabulary(config, { cryptoImpl: webcrypto, fetchImpl: async (url, options) => { calls.push({ url, options }); return mockFetch()(url); } });
  assert.equal(result.words.length, 1);
  assert.equal(result.words[0].notes, '');
  assert.equal(result.wordsUrl, 'https://data.example.com/releases/v1/words.json');
  assert.equal(result.manifest.version, '1.0.0');
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.options.credentials === 'omit'));
});

test('rejects stale or damaged files, invalid counts and unsafe URLs', async () => {
  for (const release of [
    { ...manifest, words: { ...manifest.words, sha256: '0'.repeat(64) } },
    { ...manifest, words: { ...manifest.words, bytes: bytes.length + 1 } },
    { ...manifest, wordCount: 2 },
    { ...manifest, schemaVersion: 2 },
    { ...manifest, words: { ...manifest.words, path: 'javascript:alert(1)' } }
  ]) await assert.rejects(loadPublicVocabulary(config, { cryptoImpl: webcrypto, fetchImpl: mockFetch(release) }));
  await assert.rejects(loadPublicVocabulary({ manifestUrl: 'file:///private/manifest.json' }));
});

test('reports unavailable repositories and cancels a timed-out request', async () => {
  await assert.rejects(loadPublicVocabulary(config, { fetchImpl: async () => new Response('', { status: 404 }) }), /清单/);
  await assert.rejects(loadPublicVocabulary({ ...config, timeoutMs: 10 }, { fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) }), /超时/);
});

test('reserved public address makes no requests on deployed sites until configured', async () => {
  let requests = 0;
  for (const baseUrl of ['https://example.com/app/', 'https://localhost.example.com/', 'https://127.0.0.1.example.com/']) {
    await assert.rejects(loadPublicVocabulary({ ...vocabularyConfig, manifestUrl: '' }, {
      baseUrl, fetchImpl: async () => { requests++; throw new Error('Unexpected request'); }
    }), error => error.code === 'VOCABULARY_NOT_CONFIGURED');
  }
  assert.equal(requests, 0);
});

test('loopback preview uses the local data repository and configured public URLs take precedence', async () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
    const calls = [];
    const result = await loadPublicVocabulary({ ...vocabularyConfig, manifestUrl: '' }, {
      baseUrl: `http://${hostname}:5173/`, cryptoImpl: webcrypto,
      fetchImpl: async url => { calls.push(url); return mockFetch()(url); }
    });
    assert.equal(result.words.length, 1);
    assert.equal(calls[0], `http://${hostname}:5173/vocabulary/manifest.json`);
  }
  const result = await loadPublicVocabulary({ ...vocabularyConfig, manifestUrl: config.manifestUrl }, {
    baseUrl: 'http://localhost:5173/', cryptoImpl: webcrypto, fetchImpl: mockFetch()
  });
  assert.equal(result.manifestUrl, config.manifestUrl);
});

test('configured iDICT connection uses public data on both local and deployed sites', async () => {
  for (const baseUrl of ['http://localhost:5173/', 'https://example.com/app/']) {
    const calls = [];
    await loadPublicVocabulary(vocabularyConfig, {
      baseUrl, cryptoImpl: webcrypto,
      fetchImpl: async url => { calls.push(url); return mockFetch()(url); }
    });
    assert.deepEqual(calls, [
      'https://raw.githubusercontent.com/YourEducation/iDICT/main/manifest.json',
      'https://raw.githubusercontent.com/YourEducation/iDICT/main/words.json'
    ]);
  }
});

test('resolves data relative to the final manifest URL after a redirect', async () => {
  const calls = [];
  const result = await loadPublicVocabulary(config, {
    cryptoImpl: webcrypto,
    fetchImpl: async url => {
      calls.push(url);
      if (calls.length === 1) {
        const response = new Response(JSON.stringify(manifest));
        Object.defineProperty(response, 'url', { value: 'https://cdn.example.com/v2/manifest.json' });
        return response;
      }
      return new Response(bytes);
    }
  });
  assert.equal(calls[1], 'https://cdn.example.com/v2/words.json');
  assert.equal(result.manifestUrl, 'https://cdn.example.com/v2/manifest.json');
});

test('browser preferences never store or override public definitions', () => {
  const state = { ...emptyState(), words: parseWords(dataset), notes: { 'test-word': 'My own note' }, favorites: ['test-word'] };
  const saved = personalSnapshot(state);
  assert.equal(Object.hasOwn(saved, 'words'), false);
  assert.deepEqual(saved.notes, { 'test-word': 'My own note' });
  assert.ok(!JSON.stringify(saved).includes('测试'));
  const upgraded = readPersonalNotes({ ...saved, words: [{ word: 'test-word', notes: 'old' }, { word: 'legacy-word', notes: 'keep this note', meaning: 'legacy data' }] });
  assert.equal(upgraded['test-word'], 'My own note');
  assert.equal(upgraded['legacy-word'], 'keep this note');
  assert.equal(Object.hasOwn(upgraded, 'words'), false);
});

test('note migration ignores malformed values and handles object-like headwords safely', () => {
  const saved = JSON.parse('{"notes":{"__proto__":"safe","bad":42}}');
  const notes = readPersonalNotes(saved);
  assert.equal(Object.getPrototypeOf(notes), Object.prototype);
  assert.equal(notes.__proto__, 'safe');
  assert.equal(Object.hasOwn(notes, 'bad'), false);
});
