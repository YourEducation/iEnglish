export const STORAGE_KEY = 'ienglish.workspace.v1';
export const emptyState = () => ({ words: [], notes: {}, favorites: [], recent: [], preferredSources: ['cambridge', 'oxford', 'etymonline'], theme: 'light' });

// Public definitions never enter browser preferences. Only personal annotations
// and navigation preferences are persisted, so public updates remain authoritative.
export function personalSnapshot(state) {
  return { notes: state.notes, favorites: state.favorites, recent: state.recent, preferredSources: state.preferredSources, theme: state.theme };
}

export function readPersonalNotes(saved) {
  const entries = Object.entries(saved?.notes && typeof saved.notes === 'object' && !Array.isArray(saved.notes) ? saved.notes : {})
    .filter(([, value]) => typeof value === 'string' && value.length <= 20000);
  const notes = new Map(entries.map(([word, value]) => [word.toLowerCase(), value]));
  // Preserve notes from the previous personal-import UI without retaining its
  // private dictionary definitions or replacing any public records.
  for (const word of Array.isArray(saved?.words) ? saved.words : []) {
    if (word && typeof word.word === 'string' && typeof word.notes === 'string' && word.notes.trim() && word.notes.length <= 20000 && !notes.has(word.word.toLowerCase())) notes.set(word.word.toLowerCase(), word.notes);
  }
  return Object.fromEntries(notes);
}

function cleanString(value, field, max = 20000) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error(`${field} 必须是文本。`);
  if (value.length > max) throw new Error(`${field} 内容过长。`);
  return value.trim();
}

export function parseWords(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  const words = Array.isArray(data) ? data : data?.words;
  if (!Array.isArray(words)) throw new Error('请提供单词数组，或包含 words 数组的 JSON 文件。');
  if (words.length > 20000) throw new Error('一次最多导入 20,000 个单词。');
  const unique = new Map();
  for (const entry of words) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('每个单词都需要是一个对象。');
    const word = cleanString(entry.word, 'word', 200);
    if (!word) throw new Error('每个单词都需要填写 word。');
    if (entry.sources !== undefined && !Array.isArray(entry.sources)) throw new Error(`${word} 的 sources 必须是数组。`);
    if (entry.definitions !== undefined && !Array.isArray(entry.definitions)) throw new Error(`${word} 的 definitions 必须是数组。`);
    if (entry.tags !== undefined && !Array.isArray(entry.tags)) throw new Error(`${word} 的 tags 必须是数组。`);
    const sources = (entry.sources || []).map(source => {
      if (!source || typeof source !== 'object') throw new Error(`${word} 的来源格式不正确。`);
      const name = cleanString(source.name, '来源名称', 200);
      const url = cleanString(source.url, '来源网址', 4000);
      let parsed;
      try { parsed = new URL(url); } catch { throw new Error(`${word} 的来源网址无效。`); }
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('来源网址只支持不含登录信息的 HTTP / HTTPS 链接。');
      return { name: name || parsed.hostname, url: parsed.href };
    });
    const definitions = (entry.definitions || []).map(definition => {
      if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error(`${word} 的释义格式不正确。`);
      return {
        partOfSpeech: cleanString(definition.partOfSpeech, '词性', 100),
        definition: cleanString(definition.definition, '英文释义'),
        translation: cleanString(definition.translation, '中文释义'),
        example: cleanString(definition.example, '例句')
      };
    });
    let frequency;
    if (entry.frequency !== undefined) {
      if (!entry.frequency || typeof entry.frequency !== 'object' || Array.isArray(entry.frequency)) throw new Error(`${word} 的 frequency 必须是对象。`);
      frequency = {};
      for (const key of ['selectionRank', 'contemporaryRank', 'bncRank']) {
        const value = entry.frequency[key];
        if (value === undefined || value === null) { frequency[key] = null; continue; }
        if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${word} 的词频顺序必须是正整数或 null。`);
        frequency[key] = value;
      }
    }
    unique.set(word.toLocaleLowerCase(), {
      word, phonetic: cleanString(entry.phonetic, '音标', 300), meaning: cleanString(entry.meaning, '简要释义'),
      partOfSpeech: cleanString(entry.partOfSpeech, '词性', 100), notes: cleanString(entry.notes, '笔记'),
      tags: (entry.tags || []).map(tag => cleanString(tag, '标签', 100)).filter(Boolean), definitions, sources,
      ...(frequency ? { frequency } : {})
    });
  }
  return [...unique.values()];
}

export function mergeWords(existing, incoming) {
  const map = new Map(existing.map(word => [word.word.toLocaleLowerCase(), word]));
  for (const word of incoming) map.set(word.word.toLocaleLowerCase(), word);
  return [...map.values()].sort((a, b) => a.word.localeCompare(b.word));
}

export function searchWords(words, query) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return words;
  return words.map(entry => {
    const headword = entry.word.toLocaleLowerCase();
    const rank = headword === term ? 0 : headword.startsWith(term) ? 1 : headword.includes(term) ? 2 : 3;
    const matches = rank < 3 || [entry.meaning, ...entry.tags, ...entry.definitions.flatMap(d => [d.definition, d.translation])]
      .some(text => text.toLocaleLowerCase().includes(term));
    return { entry, rank, matches };
  }).filter(result => result.matches)
    .sort((a, b) => a.rank - b.rank || a.entry.word.localeCompare(b.entry.word))
    .map(result => result.entry);
}

export function wordTags(words) {
  const counts = new Map();
  for (const word of words) {
    for (const tag of new Set(word.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'));
}

export function selectWords(words, { query = '', tag = '', sort = 'recommended' } = {}) {
  const filtered = tag ? words.filter(word => word.tags.includes(tag)) : words;
  const matches = searchWords(filtered, query);
  if (sort === 'recommended' && query.trim()) return matches;
  return [...matches].sort((a, b) => {
    if (sort === 'asc') return a.word.localeCompare(b.word);
    if (sort === 'desc') return b.word.localeCompare(a.word);
    const rank = word => word.frequency?.selectionRank ?? Number.MAX_SAFE_INTEGER;
    return rank(a) - rank(b) || a.word.localeCompare(b.word);
  });
}
