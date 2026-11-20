import { sources, sourceUrl } from './sources.js';
import { STORAGE_KEY, emptyState, selectWords, wordTags, personalSnapshot, readPersonalNotes } from './data.js';
import { vocabularyConfig } from './config.js';
import { loadPublicVocabulary } from './vocabulary.js';

const icons = {
  book: '<path d="M3 5.5c3.5-1 6-.5 9 1.5 3-2 5.5-2.5 9-1.5v15c-3.5-1-6-.5-9 1.5-3-2-5.5-2.5-9-1.5z"/><path d="M12 7v15M6.5 10l2 .5m-2 4 2 .5m7-4.5 2-.5m-2 5 2-.5"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
  library: '<path d="M4 4h4v16H4zM11 4h4v16h-4zM18 4l3 15"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7m2-4v5l3 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external: '<path d="M8 5H5v14h14v-3M12 4h8v8m0-8L10 14"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  moon: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  leaf: '<path d="M5 19C0 5 14 3 21 3c0 7-2 21-16 16Zm0 0L16 8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
const esc = (text = '') => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const app = document.querySelector('#app');
const aboutDialog = document.querySelector('#about-dialog');
const wordDialog = document.querySelector('#word-dialog');
const mobileLayout = matchMedia('(max-width: 760px)');
const pageNames = { discover: '发现单词', library: '公开词库', favorites: '学习收藏', sources: '词典来源', recent: '最近查阅' };
let state = emptyState();
let storageWarning = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved) state = {
    ...state, notes: readPersonalNotes(saved),
    favorites: Array.isArray(saved.favorites) ? saved.favorites.filter(x => typeof x === 'string') : [],
    recent: Array.isArray(saved.recent) ? saved.recent.filter(x => x && typeof x.word === 'string' && Number.isFinite(x.time) && Math.abs(x.time) <= 8640000000000000).slice(0, 30) : [],
    preferredSources: Array.isArray(saved.preferredSources) ? saved.preferredSources.filter(id => sources.some(s => s.id === id)) : state.preferredSources,
    theme: saved.theme === 'dark' ? 'dark' : 'light'
  };
} catch { storageWarning = true; }
let page = pageNames[location.hash.slice(1)] ? location.hash.slice(1) : 'discover';
let query = '';
let searchDraft = '';
let sourceFilter = 'all';
let sort = 'recommended';
let wordTag = '';
let wordPage = 1;
const PAGE_SIZE = 36;
let vocabulary = { status: 'loading', error: '', manifest: null, metadata: {}, wordsUrl: '' };
let loadSequence = 0;
let toastTimer;
let activeWordKey = '';
let notesDirty = false;
let notesTimer;
document.documentElement.dataset.theme = state.theme;
document.querySelector('meta[name="theme-color"]').content = state.theme === 'dark' ? '#1b1921' : '#f7f5fb';

function persist({ notify = true } = {}) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(personalSnapshot(state))); return true; }
  catch {
    if (notify) toast('浏览器存储不可用，本次修改仅保留在当前页面。');
    return false;
  }
}
function saveWordNotes({ notify = false } = {}) {
  clearTimeout(notesTimer);
  if (!activeWordKey || !notesDirty) return true;
  const saved = persist({ notify });
  notesDirty = !saved;
  const status = wordDialog.querySelector('#notes-status');
  if (status) status.textContent = saved ? '已自动保存到此浏览器' : '尚未保存：浏览器存储不可用，请复制笔记后再离开。';
  return saved;
}
function updateWordNotes() {
  if (!activeWordKey) return;
  state.notes = { ...state.notes, [activeWordKey]: wordDialog.querySelector('#word-notes').value };
  notesDirty = true;
  wordDialog.querySelector('#notes-status').textContent = '正在保存…';
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => saveWordNotes(), 400);
}
function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3800);
}
function navItem(id, name, count) {
  return `<a class="nav-item ${page === id ? 'active' : ''}" href="#${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(name)}<span>${pageNames[id]}</span>${count !== undefined ? `<span class="nav-count">${count}</span>` : ''}</a>`;
}
function render() {
  app.innerHTML = `
    <button class="skip-link" data-action="skip-main">跳到主要内容</button><button class="nav-scrim" data-action="close-nav" aria-label="关闭导航" tabindex="-1"></button>
    <aside class="sidebar" aria-label="主导航">
      <a class="brand" href="#discover" aria-label="iEnglish 首页"><span class="brand-mark">${icon('book')}</span><span>iEnglish<span class="brand-caption">让每个单词都有来处</span></span></a>
      <div class="workspace-label">英语探索空间<span class="tiny-dot"></span></div>
      <nav>${navItem('discover', 'explore')}${navItem('library', 'library', state.words.length)}${navItem('favorites', 'star', state.words.filter(word => state.favorites.includes(word.word.toLowerCase())).length)}
      <div class="nav-divider"></div><div class="nav-label">探索与回顾</div>${navItem('sources', 'globe')}${navItem('recent', 'history', state.recent.length)}</nav>
      <div class="sidebar-bottom"><div class="sidebar-note"><span class="note-icon">${icon('leaf')}</span><p>不必一下记住所有。<br>每天，多认识一点世界。</p><span class="note-small">A LITTLE EVERY DAY.</span></div>
      <button class="theme-button" data-action="theme">${icon(state.theme === 'dark' ? 'sun' : 'moon')}<span>${state.theme === 'dark' ? '切换浅色模式' : '切换深色模式'}</span><span class="theme-switch ${state.theme === 'dark' ? 'on' : ''}"><span></span></span></button><div class="sidebar-footer">MADE FOR YOUR CURIOSITY <span>✳</span></div></div>
    </aside>
    <div class="main-shell"><header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" data-action="open-nav" aria-label="打开导航">${icon('menu')}</button><span>公开词典</span>${icon('chevron')}<strong>${pageNames[page]}</strong></div><div class="topbar-actions"><span class="local-indicator"><span></span>开放共享</span><button class="button about-top" data-action="about">${icon('info')}<span>词库说明</span></button><span class="avatar public-avatar" title="公开英语词典">${icon('globe')}</span></div></header>
    <main id="main" class="main-content" tabindex="-1">
      ${page === 'discover' && !query ? hero() : pageHeading()}
      ${searchBox()}
      <div id="page-content">${content()}</div>
      <footer class="main-footer"><span><span class="footer-logo">iE.</span> 为每一份好奇心，找到可靠的答案。</span><span>慢慢积累，自有回响 ${icon('spark')}</span></footer>
    </main></div>`;
  bindSearch();
  syncNav();
}
function syncNav() {
  const open = document.body.classList.contains('nav-open');
  document.querySelector('.sidebar').inert = mobileLayout.matches && !open;
  document.querySelector('.mobile-menu').setAttribute('aria-expanded', String(open));
}
mobileLayout.addEventListener('change', () => { document.body.classList.remove('nav-open'); syncNav(); });
function hero() {
  return `<section class="hero"><div class="hero-copy"><div class="eyebrow"><span></span> AN OPEN WORLD OF WORDS</div><h1>世界很大，<br>从一个<span class="hero-word">单词</span>开始<span class="title-dot">。</span></h1><p>连接权威释义，探索词源与用法。<br class="mobile-break">让每一次查词，都成为一次发现。</p><span class="hero-footnote"><span class="mini-line"></span> STAY CURIOUS. KEEP EXPLORING.</span></div><div class="hero-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><span class="art-star star-one">✳</span><span class="art-star star-two">✧</span><span class="art-dot"></span><div class="floating-label label-top">a little curiosity</div><div class="word-card card-back"><span>WORDS</span><div class="back-line"></div><div class="back-line short"></div><span class="card-mini-star">✦</span></div><div class="word-card card-front"><span class="card-index">01 / ∞</span><span class="card-aa">Aa<span>·</span></span><div class="card-rule"></div><div class="card-caption">a world of possibilities</div><span class="card-book">${icon('book')}</span></div><span class="floating-label label-bottom">无限可能，始于好奇 ${icon('spark')}</span></div></section>`;
}
function pageHeading() {
  const descriptions = {
    discover: '连接词库与权威来源，找到你想了解的单词。',
    library: '公开的常用英语词库，打开就能查，探索随时开始。',
    favorites: '留下让你停顿的单词，给理解多一点时间。',
    sources: '好的理解，从可靠的来源开始。',
    recent: '沿着好奇心的足迹，重温每一次发现。'
  };
  return `<section class="page-heading"><div class="eyebrow">${{ discover: 'FOLLOW YOUR CURIOSITY', library: 'OPEN ENGLISH VOCABULARY', favorites: 'WORDS WORTH KEEPING', sources: 'TRUSTED DICTIONARIES', recent: 'YOUR EXPLORATION TRAIL' }[page]}</div><h1>${query ? `寻找「${esc(query)}」` : pageNames[page]}</h1><p>${descriptions[page]}</p></section>`;
}
function searchBox() {
  return `<section class="search-section" aria-label="单词搜索"><form id="search-form" class="search-box" role="search">${icon('search')}<label class="sr-only" for="word-search">搜索英文单词或中文释义</label><input id="word-search" type="search" placeholder="想了解哪个单词？输入英文或中文释义…" value="${esc(searchDraft)}" autocomplete="off" maxlength="200" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="search-suggestions" aria-expanded="false"/><kbd class="shortcut">Ctrl K</kbd><button class="search-submit" type="submit">探索单词 ${icon('arrow')}</button></form><div id="search-suggestions" class="suggestions" role="listbox" aria-label="匹配的单词" hidden></div><div class="search-hint"><span>${icon('globe')} 让好奇心，遇见有据可循的答案</span><span>6 个权威来源，一处连接</span></div></section>`;
}
function sourceCards() {
  let selected = sources.filter(source => sourceFilter === 'all' || (sourceFilter === 'preferred' ? state.preferredSources.includes(source.id) : source.category === sourceFilter));
  return selected.length ? selected.map(source => `<article class="source-card"><div class="source-card-top"><span class="source-logo ${source.color}" aria-hidden="true">${source.monogram}</span><a class="source-arrow" data-source="${source.id}" href="${sourceUrl(source, query)}" target="_blank" rel="noopener noreferrer" aria-label="${query ? '查询 ' + esc(query) + ' · ' : '打开 '}${esc(source.name)}（新标签页）">${icon('external')}</a></div><a class="source-name" data-source="${source.id}" href="${sourceUrl(source, query)}" target="_blank" rel="noopener noreferrer"><h3>${source.name}</h3><span>${source.chinese}</span></a><p>${source.description}</p><div class="source-card-bottom"><span class="source-tag">${source.label}</span><button class="source-favorite ${state.preferredSources.includes(source.id) ? 'is-favorite' : ''}" data-action="source-favorite" data-id="${source.id}" aria-pressed="${state.preferredSources.includes(source.id)}" aria-label="${state.preferredSources.includes(source.id) ? '取消常用' : '设为常用'}：${source.chinese}" title="${state.preferredSources.includes(source.id) ? '取消常用' : '设为常用'}">${icon('star')}</button></div></article>`).join('') : `<div class="filter-empty">${icon('star')}<p>还没有常用来源。点击词典卡片上的星标，将它留在这里。</p><button class="button tonal" data-action="all-sources">浏览全部来源</button></div>`;
}
function sourcesSection() {
  return `<section class="sources-section"><div class="section-heading"><div class="section-title"><span class="section-icon">${icon('globe')}</span><h2>${query ? '去权威词典继续探索' : '好词典，常相伴'}</h2><span class="section-caption">${query ? '查询 ' + esc(query) : 'TRUSTED SOURCES'}</span></div><span class="external-note">${icon('external')} 在新标签页打开</span></div><div class="filter-row" role="group" aria-label="筛选词典来源">${[['all', '全部来源', '6'], ['dictionary', '英语词典'], ['etymology', '词源探索'], ['preferred', '我的常用']].map(([id, title, count]) => `<button data-action="filter" data-filter="${id}" class="filter-chip ${sourceFilter === id ? 'selected' : ''}" aria-pressed="${sourceFilter === id}">${sourceFilter === id ? icon('check') : id === 'preferred' ? icon('star') : ''}${title}${count ? `<span>${count}</span>` : ''}</button>`).join('')}<span class="filter-tip">多一个视角，多一层理解。</span></div><div id="source-grid" class="source-grid">${sourceCards()}</div></section>`;
}
function homeBottom() {
  const ready = vocabulary.status === 'ready';
  return `<section class="home-bottom"><div class="collection-card"><div class="section-heading"><div class="section-title">${icon('library')}<h2>公开词库，随时探索</h2></div><a class="text-link" href="#library">浏览词库 ${icon('arrow')}</a></div><div class="collection-body"><div class="empty-book-art" aria-hidden="true">${icon('book')}<span>✦</span></div><div><h3>${ready ? '开放共享的 ' + state.words.length.toLocaleString('zh-CN') + ' 个单词' : vocabulary.status === 'loading' ? '正在打开公开词库…' : vocabulary.status === 'unconfigured' ? '公开词库即将开放' : '词库暂时无法连接'}</h3><p>${ready ? '释义、音标与可靠来源，打开就能查。' : vocabulary.status === 'loading' ? '为你的好奇心，准备可靠的答案。' : '你仍可以通过上方词典，继续探索。'}</p><button class="text-link" data-action="${vocabulary.status === 'error' ? 'retry-vocabulary' : 'go-library'}">${vocabulary.status === 'error' ? '重新加载词库' : '探索全部词汇'} ${icon('arrow')}</button></div></div></div><div class="quote-card"><span class="quote-symbol">“</span><p>A different language is<br>a different vision of life.</p><div>另一种语言，另一种看世界的方式。</div><span class="quote-attribution">— FEDERICO FELLINI</span><span class="quote-flower" aria-hidden="true">✳</span></div></section>`;
}
function vocabularyStatus() {
  const loading = vocabulary.status === 'loading';
  const unconfigured = vocabulary.status === 'unconfigured';
  return `<section class="empty-panel vocabulary-status" aria-live="polite" aria-busy="${loading}"><div class="empty-icon">${icon(loading ? 'book' : 'globe')}<span>✧</span></div><span class="eyebrow">OPEN TO EVERY CURIOUS MIND</span><h2>${loading ? '正在打开公开词库…' : unconfigured ? '公开词库即将开放' : '词库暂时无法连接'}</h2><p>${loading ? '稍等一下，单词和它们的故事即将到来。' : esc(vocabulary.error)}</p>${loading ? '<span class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : unconfigured ? '<a class="button primary" href="#sources">浏览权威词典</a>' : '<button class="button primary" data-action="retry-vocabulary">重新加载词库</button>'}</section>`;
}
function wordCards(words) {
  const pages = Math.ceil(words.length / PAGE_SIZE);
  wordPage = Math.max(1, Math.min(wordPage, pages || 1));
  const start = (wordPage - 1) * PAGE_SIZE;
  return wordCardGrid(words.slice(start, start + PAGE_SIZE)) + (pages > 1 ? `<nav class="pagination" aria-label="单词列表分页"><span class="pagination-summary" role="status">显示 ${start + 1}–${Math.min(start + PAGE_SIZE, words.length)}，共 ${words.length} 个单词</span><div><button class="button tonal" data-action="word-page" data-page="${wordPage - 1}" ${wordPage === 1 ? 'disabled' : ''} aria-label="上一页">上一页</button><label for="word-page">第 <input id="word-page" type="number" inputmode="numeric" min="1" max="${pages}" value="${wordPage}" aria-label="跳转页码" /> / ${pages} 页</label><button class="button tonal" data-action="word-page" data-page="${wordPage + 1}" ${wordPage === pages ? 'disabled' : ''} aria-label="下一页">下一页</button></div></nav>` : '');
}
function wordCardGrid(words) {
  return `<div class="word-grid">${words.map(word => `<article class="entry-card"><div class="entry-top"><button class="word-open" data-action="word" data-word="${esc(word.word)}"><h3>${esc(word.word)}</h3><span>${esc(word.phonetic || word.partOfSpeech || '查看单词')}</span></button><button class="icon-button word-star ${state.favorites.includes(word.word.toLowerCase()) ? 'is-favorite' : ''}" data-action="favorite" data-word="${esc(word.word)}" aria-label="${state.favorites.includes(word.word.toLowerCase()) ? '取消收藏' : '收藏'} ${esc(word.word)}" aria-pressed="${state.favorites.includes(word.word.toLowerCase())}">${icon('star')}</button></div><p>${esc(word.meaning || word.definitions[0]?.translation || word.definitions[0]?.definition || '打开单词，探索更多信息。')}</p><div class="entry-bottom">${word.tags.slice(0, 3).map(tag => `<span class="source-tag">${esc(tag)}</span>`).join('')}<button class="text-link" data-action="word" data-word="${esc(word.word)}">查看详情 ${icon('arrow')}</button></div></article>`).join('')}</div>`;
}
function emptyPanel(kind) {
  const values = {
    library: ['library', '公开词库正在准备中', '稍后再试，或先到权威词典中继续探索。', '重新加载', 'retry-vocabulary'],
    favorites: ['star', '留住那些想再见一面的单词', '在公开词库中点击星标，收藏的单词就会出现在这里。', '浏览公开词库', 'go-library'],
    recent: ['history', '每一次好奇，都值得被记住', '搜索一个单词，你的查阅足迹会自动保存在这里。', '开始探索', 'go-discover']
  };
  const [graphic, title, description, label, action] = values[kind];
  return `<div class="empty-panel"><div class="empty-icon">${icon(graphic)}<span>✧</span></div><span class="eyebrow">ROOM FOR NEW DISCOVERIES</span><h2>${title}</h2><p>${description}</p><button class="button primary" data-action="${action}">${icon('arrow')}${label}</button><span class="empty-note">不急，一点点积累也是进步。</span></div>`;
}
function wordScope() {
  return page === 'favorites' ? state.words.filter(word => state.favorites.includes(word.word.toLowerCase())) : state.words;
}
function libraryOverview() {
  const manifest = vocabulary.manifest;
  if (!manifest) return '';
  return `<section class="vocabulary-overview" aria-label="词库信息"><div><h2>${esc(manifest.name)}</h2><p>${state.words.length.toLocaleString('zh-CN')} 个词条<span>·</span>版本 ${esc(manifest.version)}<span>·</span>开放共享</p></div><div class="vocabulary-actions"><button class="text-link" data-action="retry-vocabulary">${icon('history')}刷新词库</button><a class="text-link" href="${esc(vocabulary.wordsUrl)}" target="_blank" rel="noopener noreferrer" download="ienglish-vocabulary.json">${icon('download')}下载词库</a></div></section>`;
}
function wordFilters(scope) {
  return `<div class="word-filters"><div class="word-filter-fields"><label>词汇标签<select id="word-tag" aria-label="词汇标签"><option value="">全部标签（${scope.length}）</option>${wordTags(scope).map(([tag, count]) => `<option value="${esc(tag)}" ${wordTag === tag ? 'selected' : ''}>${esc(tag)}（${count}）</option>`).join('')}</select></label><label>排列顺序<select id="sort" aria-label="排列顺序"><option value="recommended" ${sort === 'recommended' ? 'selected' : ''}>${query ? '匹配优先' : '推荐顺序'}</option><option value="frequency" ${sort === 'frequency' ? 'selected' : ''}>常用词优先</option><option value="asc" ${sort === 'asc' ? 'selected' : ''}>字母 A — Z</option><option value="desc" ${sort === 'desc' ? 'selected' : ''}>字母 Z — A</option></select></label></div>${wordTag || sort !== 'recommended' ? '<button class="text-link" data-action="reset-word-filters">重置筛选 ' + icon('close') + '</button>' : '<span class="word-filter-hint">按学习目标，找到适合你的词汇。</span>'}</div>`;
}
function filteredEmpty() {
  return `<div class="filter-empty"><p>没有符合当前筛选条件的单词。</p><button class="button tonal" data-action="reset-word-filters">重置筛选</button></div>`;
}
function content() {
  if (vocabulary.status !== 'ready' && (page === 'library' || page === 'favorites' || query)) return vocabularyStatus() + (query ? sourcesSection() : '');
  if (query) {
    const scope = wordScope();
    const found = selectWords(scope, { query, tag: wordTag, sort });
    return `${page === 'library' ? libraryOverview() : ''}${wordFilters(scope)}<section class="results-section"><div class="section-heading"><div class="section-title">${icon('search')}<h2>${page === 'favorites' ? '收藏中的匹配' : '词库中的匹配'}</h2><span class="count-badge">${found.length}</span></div><button class="text-link" data-action="clear-search">清除搜索 ${icon('close')}</button></div>${found.length ? wordCards(found) : wordTag ? filteredEmpty() : `<div class="no-results">${icon('book')}<div><h3>公开词库中暂时没有匹配</h3><p>试试其他拼写或中文释义，也可以到下方的权威词典中继续查询。</p></div><button class="button tonal" data-action="go-library">${icon('library')}浏览词库</button></div>`}</section>${sourcesSection()}`;
  }
  if (page === 'discover') return sourcesSection() + homeBottom();
  if (page === 'sources') return sourcesSection() + `<div class="subtle-note">${icon('info')} 点击星标设置常用来源。搜索单词后，词典入口将直达对应的查询页面。</div>`;
  if (page === 'recent') return state.recent.length ? `<div class="section-heading"><div class="section-title"><h2>最近的发现</h2><span class="count-badge">${state.recent.length}</span></div><button class="text-link" data-action="clear-recent">清空记录 ${icon('close')}</button></div><div class="history-list">${state.recent.map(item => `<button class="history-row" data-action="lookup" data-word="${esc(item.word)}"><span class="history-icon">${icon('history')}</span><strong>${esc(item.word)}</strong><time datetime="${new Date(item.time).toISOString()}">${new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(item.time)}</time>${icon('arrow')}</button>`).join('')}</div>` : emptyPanel('recent');
  const scope = wordScope();
  if (!scope.length) return emptyPanel(page);
  const words = selectWords(scope, { tag: wordTag, sort });
  return `${page === 'library' ? libraryOverview() : ''}${wordFilters(scope)}<div class="section-heading"><div class="section-title"><h2>${page === 'favorites' ? '珍藏的单词' : wordTag ? esc(wordTag) : '全部单词'}</h2><span class="count-badge" role="status">${words.length}</span></div></div>${words.length ? wordCards(words) : filteredEmpty()}`;
}
function bindSearch() {
  const input = document.querySelector('#word-search');
  const suggestions = document.querySelector('#search-suggestions');
  let activeIndex = -1;
  let composing = false;
  const close = () => {
    suggestions.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    for (const option of suggestions.children) option.setAttribute('aria-selected', 'false');
  };
  const update = () => {
    searchDraft = input.value;
    if (composing) return;
    const term = input.value.trim();
    const matches = term ? selectWords(wordScope(), { query: term, tag: wordTag }).slice(0, 5) : [];
    close();
    suggestions.innerHTML = matches.map((word, index) => `<button type="button" role="option" id="suggestion-${index}" tabindex="-1" aria-selected="false" data-action="word" data-word="${esc(word.word)}"><span><strong>${esc(word.word)}</strong><small>${esc(word.meaning || word.phonetic)}</small></span>${icon('arrow')}</button>`).join('');
    suggestions.hidden = !matches.length;
    input.setAttribute('aria-expanded', String(matches.length > 0));
  };
  document.querySelector('#search-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!composing) lookup(input.value);
  });
  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('compositionstart', () => { composing = true; close(); });
  input.addEventListener('compositionend', () => { composing = false; update(); });
  input.addEventListener('blur', close);
  // Retain input focus until the option's click opens the word dialog.
  suggestions.addEventListener('mousedown', event => event.preventDefault());
  input.addEventListener('keydown', event => {
    if (event.isComposing || composing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.hidden) update();
      const options = [...suggestions.children];
      if (!options.length) return;
      event.preventDefault();
      activeIndex = activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
        : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options.forEach((option, index) => option.setAttribute('aria-selected', String(index === activeIndex)));
      input.setAttribute('aria-activedescendant', options[activeIndex].id);
      options[activeIndex].scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter' && !suggestions.hidden && activeIndex >= 0) {
      event.preventDefault();
      openWord(suggestions.children[activeIndex].dataset.word);
    }
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  });
}
function changeWordPage(value) {
  wordPage = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 1;
  render();
  document.querySelector('#page-content').scrollIntoView({ block: 'start', behavior: 'smooth' });
  document.querySelector('#word-page')?.focus({ preventScroll: true });
}
function record(word) {
  state.recent = [{ word, time: Date.now() }, ...state.recent.filter(item => item.word.toLowerCase() !== word.toLowerCase())].slice(0, 30);
  persist();
}
function lookup(word) {
  const clean = word.trim().slice(0, 200);
  searchDraft = clean;
  if (!clean) { if (query) { query = ''; render(); } document.querySelector('#word-search').focus(); return; }
  query = clean;
  wordPage = 1;
  record(clean);
  render();
}
function go(destination) {
  query = '';
  searchDraft = '';
  wordTag = '';
  wordPage = 1;
  if (page === destination) { render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else location.hash = destination;
}
function openAbout() {
  const manifest = vocabulary.manifest;
  const attribution = typeof manifest?.attribution === 'string' ? manifest.attribution : typeof vocabulary.metadata?.attribution === 'string' ? vocabulary.metadata.attribution : '词条由公开词库维护。权威词典链接用于进一步查证，详细来源说明请查看词库仓库。';
  const license = typeof manifest?.license?.name === 'string' ? manifest.license.name : '许可详见词库仓库';
  aboutDialog.innerHTML = `<div class="dialog-header"><span class="dialog-icon">${icon('globe')}</span><button class="icon-button" data-action="close-about" aria-label="关闭词库说明">${icon('close')}</button></div><div class="eyebrow">WORDS FOR EVERYONE</div><h2 id="about-title">好奇心，向所有人开放。</h2><p class="dialog-description">iEnglish 是一部公开的英语学习词典。无需导入，打开即可查阅常用词汇，并连接权威释义与词源。</p><div class="about-stats"><div><strong>${manifest ? manifest.wordCount.toLocaleString('zh-CN') : '—'}</strong><span>公开词条</span></div><div><strong>6</strong><span>权威查询入口</span></div><div><strong>${esc(manifest?.version || '—')}</strong><span>词库版本</span></div></div><section class="about-section"><h3>资料从哪里来？</h3><p>${esc(attribution)}</p>${vocabularyConfig.repositoryUrl ? '<a class="text-link" href="' + esc(vocabularyConfig.repositoryUrl) + '" target="_blank" rel="noopener noreferrer">公开词库仓库 ' + icon('external') + '</a>' : ''}</section><section class="about-section"><h3>你的学习，留在你这里。</h3><p>收藏、笔记和查阅记录仅保存在当前浏览器。它们不会修改公开词库，也不会上传到其他地方。</p></section><div class="dialog-footer"><span class="about-license">${esc(manifest?.name || '公开词库')} · ${esc(license)}</span><button class="button tonal" data-action="close-about">开始探索</button></div>`;
  aboutDialog.showModal();
}
async function refreshVocabulary() {
  const sequence = ++loadSequence;
  vocabulary = { ...vocabulary, status: 'loading', error: '' };
  render();
  try {
    const result = await loadPublicVocabulary(vocabularyConfig);
    if (sequence !== loadSequence) return;
    state.words = result.words.sort((a, b) => a.word.localeCompare(b.word));
    vocabulary = { ...result, status: 'ready', error: '' };
  } catch (error) {
    if (sequence !== loadSequence) return;
    vocabulary = { ...vocabulary, status: error.code === 'VOCABULARY_NOT_CONFIGURED' ? 'unconfigured' : 'error', error: error.message || '请检查网络后重试。' };
  }
  render();
}
function toggleFavorite(word) {
  const key = word.toLowerCase();
  const has = state.favorites.includes(key);
  state.favorites = has ? state.favorites.filter(item => item !== key) : [...state.favorites, key];
  persist();
  render();
  if (wordDialog.open) {
    const button = wordDialog.querySelector('[data-action="favorite"]');
    button.innerHTML = `${icon('star')}${has ? '收藏单词' : '已收藏'}`;
    button.setAttribute('aria-pressed', String(!has));
  }
  toast(has ? '已取消收藏' : '已加入学习收藏');
}
function openWord(name) {
  const word = state.words.find(item => item.word.toLowerCase() === name.toLowerCase());
  if (!word) return;
  saveWordNotes({ notify: true });
  activeWordKey = word.word.toLowerCase();
  const dataSources = word.sources.filter(source => !sources.some(reference => sourceUrl(reference, word.word) === source.url));
  if (!dataSources.length && vocabularyConfig.repositoryUrl) dataSources.push({ name: vocabulary.manifest?.name || '公开词库', url: vocabularyConfig.repositoryUrl });
  record(word.word);
  render();
  wordDialog.innerHTML = `<div class="dialog-header"><span class="eyebrow">A WORD TO EXPLORE</span><button class="icon-button" data-action="close-word" aria-label="关闭单词详情">${icon('close')}</button></div><div class="word-detail-heading"><div><h2 id="word-title">${esc(word.word)}</h2><span class="phonetic">${esc(word.phonetic)}</span></div><button class="button tonal" data-action="favorite" data-word="${esc(word.word)}" aria-pressed="${state.favorites.includes(word.word.toLowerCase())}">${icon('star')}${state.favorites.includes(word.word.toLowerCase()) ? '已收藏' : '收藏单词'}</button></div>${word.partOfSpeech ? `<span class="source-tag">${esc(word.partOfSpeech)}</span>` : ''}${word.meaning ? `<p class="main-meaning">${esc(word.meaning)}</p>` : ''}<div class="word-tags">${word.tags.map(tag => `<span class="source-tag">${esc(tag)}</span>`).join('')}</div>${word.definitions.length ? `<section class="definition-section"><h3>释义与用法</h3>${word.definitions.map((d, i) => `<div class="definition"><span>${String(i + 1).padStart(2, '0')}</span><div>${d.partOfSpeech ? `<em>${esc(d.partOfSpeech)}</em>` : ''}${d.definition ? `<p>${esc(d.definition)}</p>` : ''}${d.translation ? `<p class="translation">${esc(d.translation)}</p>` : ''}${d.example ? `<blockquote>${esc(d.example)}</blockquote>` : ''}</div></div>`).join('')}</section>` : ''}${dataSources.length ? `<section class="detail-sources"><h3>词条资料来源</h3>${dataSources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${icon('globe')}<span>${esc(source.name)}</span>${icon('external')}</a>`).join('')}</section>` : ''}<section class="detail-sources"><h3>继续探索</h3><div class="detail-source-grid">${sources.map(source => `<a href="${sourceUrl(source, word.word)}" target="_blank" rel="noopener noreferrer"><span class="source-dot ${source.color}">${source.monogram}</span><span>${source.chinese}</span>${icon('external')}</a>`).join('')}</div></section><section class="notes-section"><label for="word-notes">${icon('book')}我的学习笔记</label><textarea id="word-notes" rows="3" maxlength="20000" placeholder="记下你的理解，或一句喜欢的表达…">${esc(typeof state.notes[word.word.toLowerCase()] === 'string' ? state.notes[word.word.toLowerCase()] : '')}</textarea><div><span id="notes-status" role="status" aria-live="polite">输入后自动保存到此浏览器</span><button class="button tonal" data-action="save-notes" data-word="${esc(word.word)}">保存笔记</button></div></section>`;
  if (!wordDialog.open) wordDialog.showModal();
  if (notesDirty) wordDialog.querySelector('#notes-status').textContent = '尚未保存：浏览器存储不可用，请复制笔记后再离开。';
  wordDialog.querySelector('#word-notes').addEventListener('input', updateWordNotes);
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  const source = event.target.closest('[data-source]');
  if (source && query) record(query);
  if (!event.target.closest('.search-section')) { const suggestions = document.querySelector('#search-suggestions'); if (suggestions) suggestions.hidden = true; document.querySelector('#word-search')?.setAttribute('aria-expanded', 'false'); }
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'skip-main') document.querySelector('#main').focus();
  if (action === 'word-page') changeWordPage(button.dataset.page);
  if (action === 'reset-word-filters') { wordTag = ''; sort = 'recommended'; wordPage = 1; render(); document.querySelector('#word-tag')?.focus(); }
  if (action === 'about') openAbout();
  if (action === 'close-about') aboutDialog.close();
  if (action === 'retry-vocabulary') refreshVocabulary();
  if (action === 'theme') { state.theme = state.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = state.theme; document.querySelector('meta[name="theme-color"]').content = state.theme === 'dark' ? '#1b1921' : '#f7f5fb'; persist(); render(); }
  if (action === 'filter' || action === 'all-sources') { sourceFilter = button.dataset.filter || 'all'; document.querySelector('#page-content').innerHTML = content(); const selected = document.querySelector(`[data-action="filter"][data-filter="${sourceFilter}"]`); selected?.focus({ preventScroll: true }); }
  if (action === 'source-favorite') { const id = button.dataset.id; state.preferredSources = state.preferredSources.includes(id) ? state.preferredSources.filter(item => item !== id) : [...state.preferredSources, id]; persist(); document.querySelector('#source-grid').innerHTML = sourceCards(); toast(state.preferredSources.includes(id) ? '已设为常用来源' : '已移出常用来源'); }
  if (action === 'go-library') go('library');
  if (action === 'go-discover') { go('discover'); requestAnimationFrame(() => document.querySelector('#word-search').focus()); }
  if (action === 'clear-search') { query = ''; searchDraft = ''; wordPage = 1; render(); document.querySelector('#word-search').focus(); }
  if (action === 'lookup') lookup(button.dataset.word);
  if (action === 'word') openWord(button.dataset.word);
  if (action === 'favorite') toggleFavorite(button.dataset.word);
  if (action === 'close-word') wordDialog.close();
  if (action === 'save-notes') {
    notesDirty = true;
    if (saveWordNotes({ notify: true })) toast('学习笔记已保存');
  }
  if (action === 'clear-recent') { state.recent = []; persist(); render(); toast('查阅记录已清空'); }
  if (action === 'open-nav') { document.body.classList.add('nav-open'); syncNav(); document.querySelector('.sidebar .nav-item').focus(); }
  if (action === 'close-nav') { document.body.classList.remove('nav-open'); syncNav(); document.querySelector('.mobile-menu').focus(); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'sort' || event.target.id === 'word-tag') {
    const id = event.target.id;
    if (id === 'sort') sort = event.target.value;
    else wordTag = event.target.value;
    wordPage = 1;
    render();
    document.getElementById(id)?.focus({ preventScroll: true });
  }
  if (event.target.id === 'word-page') changeWordPage(event.target.value);
});
window.addEventListener('hashchange', () => { page = pageNames[location.hash.slice(1)] ? location.hash.slice(1) : 'discover'; query = ''; searchDraft = ''; wordTag = ''; wordPage = 1; document.body.classList.remove('nav-open'); render(); window.scrollTo({ top: 0 }); });
document.addEventListener('keydown', event => {
  if (event.target.id === 'word-page' && event.key === 'Enter') {
    event.preventDefault(); changeWordPage(event.target.value); return;
  }
  if (event.key === 'Tab' && mobileLayout.matches && document.body.classList.contains('nav-open')) {
    const focusable = [...document.querySelector('.sidebar').querySelectorAll('a[href],button:not(:disabled)')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if ((event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !editing)) {
    if (aboutDialog.open || wordDialog.open) return;
    event.preventDefault(); document.querySelector('#word-search').focus(); document.querySelector('#word-search').select();
  }
  if (event.key === 'Escape' && document.body.classList.contains('nav-open')) { document.body.classList.remove('nav-open'); syncNav(); document.querySelector('.mobile-menu').focus(); }
});
for (const dialog of [aboutDialog, wordDialog]) dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
wordDialog.addEventListener('close', () => { saveWordNotes({ notify: true }); document.querySelector('#word-search')?.focus({ preventScroll: true }); });
wordDialog.addEventListener('cancel', () => saveWordNotes());
window.addEventListener('pagehide', () => saveWordNotes());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveWordNotes(); });
refreshVocabulary();
if (storageWarning) toast('上次的学习记录暂时无法读取，公开词库仍可正常使用。');
