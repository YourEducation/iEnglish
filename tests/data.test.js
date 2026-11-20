import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWords, mergeWords, searchWords, selectWords, wordTags } from '../src/data.js';
import { sources, sourceUrl } from '../src/sources.js';

// Synthetic fixtures only. These records are never loaded into the site.
test('accepts both JSON envelopes and arrays, without generating content', () => {
  assert.deepEqual(parseWords('{"version":1,"words":[]}'), []);
  const parsed = parseWords([{ word: ' fixture-one ', definitions: [{ translation: '测试内容' }] }]);
  assert.equal(parsed[0].word, 'fixture-one');
  assert.equal(parsed[0].meaning, '');
  assert.equal(parsed[0].definitions[0].translation, '测试内容');
  assert.deepEqual(parsed[0].sources, []);
});

test('rejects malformed imports and dangerous source links as a whole', () => {
  for (const input of [null, {}, { words: {} }, [null], [{ word: '' }], [{ word: 42 }], [{ word: 'fixture', definitions: [null] }], [{ word: 'fixture', sources: 'invalid' }], [{ word: 'fixture', tags: [42] }]]) {
    assert.throws(() => parseWords(input));
  }
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///test', 'not-a-url', 'https://user:password@example.com/']) {
    assert.throws(() => parseWords([{ word: 'valid-fixture' }, { word: 'invalid-fixture', sources: [{ name: 'test', url }] }]));
  }
  const word = parseWords([{ word: '<fixture>', sources: [{ name: '<source>', url: 'https://example.com/?q=%3Cfixture%3E' }] }])[0];
  assert.equal(word.word, '<fixture>'); // Text is preserved here, escaped at rendering.
  assert.equal(word.sources[0].url, 'https://example.com/?q=%3Cfixture%3E');
});

test('merges case-insensitively, updates duplicates, and retains other records', () => {
  const existing = parseWords([{ word: 'Fixture-A', notes: 'old' }, { word: 'Fixture-B', notes: 'retained' }]);
  const incoming = parseWords([{ word: 'fixture-a', notes: 'new' }, { word: 'Fixture-C' }]);
  const merged = mergeWords(existing, incoming);
  assert.equal(merged.length, 3);
  assert.equal(merged.find(w => w.word === 'fixture-a').notes, 'new');
  assert.equal(merged.find(w => w.word === 'Fixture-B').notes, 'retained');
  assert.equal(existing[0].notes, 'old');
  assert.equal(parseWords([{ word: 'Fixture' }, { word: 'fixture' }]).length, 1);
});

test('searches English, Chinese definitions and tags, prioritizing exact words', () => {
  const words = parseWords([
    { word: 'prefix-fixture', meaning: '匹配释义' },
    { word: 'fixture', tags: ['test-tag'], definitions: [{ definition: 'synthetic definition', translation: '中文说明' }] }
  ]);
  assert.equal(searchWords(words, ' FIXTURE ')[0].word, 'fixture');
  assert.equal(searchWords(words, '中文')[0].word, 'fixture');
  assert.equal(searchWords(words, 'test-tag')[0].word, 'fixture');
  assert.equal(searchWords(words, 'SYNTHETIC')[0].word, 'fixture');
  assert.equal(searchWords(words, 'no-match').length, 0);
});

test('encodes search input as a single URL segment for all sources', () => {
  for (const source of sources) {
    assert.equal(sourceUrl(source), source.url);
    const url = sourceUrl(source, 'fixture /?&中文');
    assert.ok(url.includes(encodeURIComponent('fixture /?&中文')));
    assert.equal(new URL(url).protocol, 'https:');
    assert.equal(new URL(url).hostname, new URL(source.url).hostname);
  }
});

test('ranks exact words, prefixes and headword substrings ahead of definition matches', () => {
  const words = parseWords([
    { word: 'aardvark', meaning: 'learn about art' },
    { word: 'cart' },
    { word: 'artist' },
    { word: 'Art' },
    { word: 'artery' },
    { word: 'zebra', definitions: [{ definition: 'art in a definition' }] },
    { word: 'unrelated' }
  ]);
  const original = [...words];
  assert.deepEqual(searchWords(words, ' ART ').map(entry => entry.word), ['Art', 'artery', 'artist', 'cart', 'aardvark', 'zebra']);
  assert.deepEqual(words, original);
  assert.equal(searchWords(words, '  '), words);
});

test('Chinese and tag searches retain alphabetical order when relevance is equal', () => {
  const words = parseWords([
    { word: 'zebra', tags: ['考试'], definitions: [{ translation: '测试释义' }] },
    { word: 'alpha', meaning: '测试内容', tags: ['考试'] }
  ]);
  assert.deepEqual(searchWords(words, '测试').map(entry => entry.word), ['alpha', 'zebra']);
  assert.deepEqual(searchWords(words, '考试').map(entry => entry.word), ['alpha', 'zebra']);
});

test('tag counts represent distinct words, including overlapping exam tags', () => {
  const words = parseWords([{ word: 'one', tags: ['CET-4', 'CET-4', '考研'] }, { word: 'two', tags: ['CET-4'] }, { word: 'three' }]);
  const counts = new Map(wordTags(words));
  assert.equal(counts.get('CET-4'), 2);
  assert.equal(counts.get('考研'), 1);
  assert.deepEqual(wordTags([]), []);
});

test('combines exact tag filtering, search relevance and explicit sorting without mutating data', () => {
  const words = parseWords([
    { word: 'artist', tags: ['CET-4'], frequency: { selectionRank: 1 } },
    { word: 'art', tags: ['CET-4'], frequency: { selectionRank: 2 } },
    { word: 'cart', tags: ['CET-6'], frequency: { selectionRank: 3 } },
    { word: 'alpha', tags: ['CET-4'], meaning: 'art' }
  ]);
  const original = [...words];
  const names = options => selectWords(words, options).map(word => word.word);
  assert.deepEqual(names({ query: 'art', tag: 'CET-4' }), ['art', 'artist', 'alpha']);
  assert.deepEqual(names({ query: 'art', tag: 'CET-4', sort: 'frequency' }), ['artist', 'art', 'alpha']);
  assert.deepEqual(names({ tag: 'CET-4', sort: 'desc' }), ['artist', 'art', 'alpha']);
  assert.deepEqual(names({ tag: 'CET' }), []);
  assert.deepEqual(names({ query: 'absent' }), []);
  assert.deepEqual(words, original);
});

test('recommended browsing uses selection rank, places unranked words last and breaks ties alphabetically', () => {
  const words = parseWords([{ word: 'zebra' }, { word: 'beta', frequency: { selectionRank: 1 } }, { word: 'alpha', frequency: { selectionRank: 1 } }, { word: 'aardvark' }]);
  assert.deepEqual(selectWords(words).map(word => word.word), ['alpha', 'beta', 'aardvark', 'zebra']);
  assert.deepEqual(selectWords(words, { sort: 'asc' }).map(word => word.word), ['aardvark', 'alpha', 'beta', 'zebra']);
});
