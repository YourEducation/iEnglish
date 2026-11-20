export const sources = [
  { id: 'cambridge', name: 'Cambridge Dictionary', chinese: '剑桥词典', category: 'dictionary', label: '英汉双解', description: '从清晰的释义开始，理解每一种表达。', monogram: 'C', color: 'red', url: 'https://dictionary.cambridge.org/', search: 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/{word}' },
  { id: 'oxford', name: 'Oxford Learner’s Dictionaries', chinese: '牛津学习词典', category: 'dictionary', label: '学习词典', description: '掌握地道用法，让英语自然一点。', monogram: 'O', color: 'blue', url: 'https://www.oxfordlearnersdictionaries.com/', search: 'https://www.oxfordlearnersdictionaries.com/definition/english/{word}' },
  { id: 'merriam', name: 'Merriam-Webster', chinese: '韦氏词典', category: 'dictionary', label: '美式英语', description: '探索准确释义，走近真实的美式英语。', monogram: 'M', color: 'burgundy', url: 'https://www.merriam-webster.com/', search: 'https://www.merriam-webster.com/dictionary/{word}' },
  { id: 'collins', name: 'Collins Dictionary', chinese: '柯林斯词典', category: 'dictionary', label: '语境例句', description: '在真实语境里，找到单词的恰当位置。', monogram: 'c', color: 'coral', url: 'https://www.collinsdictionary.com/', search: 'https://www.collinsdictionary.com/dictionary/english/{word}' },
  { id: 'longman', name: 'Longman Dictionary', chinese: '朗文当代英语词典', category: 'dictionary', label: '词语搭配', description: '了解常见搭配，从认识单词到学会使用。', monogram: 'L', color: 'cyan', url: 'https://www.ldoceonline.com/', search: 'https://www.ldoceonline.com/dictionary/{word}' },
  { id: 'etymonline', name: 'Online Etymology Dictionary', chinese: '在线词源词典', category: 'etymology', label: '词源探索', description: '沿着语言的足迹，发现单词背后的故事。', monogram: 'Et', color: 'olive', url: 'https://www.etymonline.com/', search: 'https://www.etymonline.com/word/{word}' }
];

export function sourceUrl(source, word = '') {
  return word.trim() ? source.search.replace('{word}', encodeURIComponent(word.trim())) : source.url;
}
