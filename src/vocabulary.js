import { parseWords } from './data.js';

function publicUrl(value, base) {
  const url = new URL(value, base);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('词库地址需要使用 HTTP 或 HTTPS。');
  return url.href;
}

export async function loadPublicVocabulary(config, { baseUrl = globalThis.location?.href, fetchImpl = globalThis.fetch, cryptoImpl = globalThis.crypto } = {}) {
  const hostname = baseUrl ? new URL(baseUrl).hostname : '';
  const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  const address = config.manifestUrl?.trim() || (localPreview ? config.localManifestUrl : '');
  if (!address) {
    const error = new Error('公开词库正在准备中，你可以先通过权威词典继续查词。');
    error.code = 'VOCABULARY_NOT_CONFIGURED';
    throw error;
  }
  const manifestUrl = publicUrl(address, baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs || 30000);
  try {
    const manifestResponse = await fetchImpl(manifestUrl, { signal: controller.signal, cache: 'no-cache', credentials: 'omit' });
    if (!manifestResponse.ok) throw new Error('暂时无法读取公开词库清单。');
    const manifest = await manifestResponse.json();
    if (manifest?.schemaVersion !== 1 || typeof manifest.name !== 'string' || typeof manifest.version !== 'string' || !Number.isSafeInteger(manifest.wordCount) || manifest.wordCount < 1 || manifest.wordCount > 20000 || typeof manifest.words?.path !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.words.sha256) || !Number.isSafeInteger(manifest.words.bytes) || manifest.words.bytes <= 0 || manifest.words.bytes > 32 * 1024 * 1024) throw new Error('公开词库清单格式不正确。');
    // Relative paths belong to the final manifest location, including CDN redirects.
    const resolvedManifestUrl = publicUrl(manifestResponse.url || manifestUrl, manifestUrl);
    const wordsUrl = publicUrl(manifest.words.path, resolvedManifestUrl);
    const response = await fetchImpl(wordsUrl, { signal: controller.signal, cache: 'no-cache', credentials: 'omit' });
    if (!response.ok) throw new Error('暂时无法下载公开词库。');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== manifest.words.bytes) throw new Error('词库文件大小与发布清单不一致，请稍后重试。');
    if (!cryptoImpl?.subtle) throw new Error('请通过 HTTPS 或 localhost 打开网站，以验证词库文件。');
    const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
    const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (hash !== manifest.words.sha256) throw new Error('词库校验未通过，可能正在更新，请稍后重试。');
    const dataset = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const words = parseWords(dataset).map(word => ({ ...word, notes: '' }));
    if (words.length !== manifest.wordCount || dataset.words?.length !== manifest.wordCount) throw new Error('词条数量与发布清单不一致。');
    return { words, manifest, metadata: dataset.metadata || {}, wordsUrl, manifestUrl: resolvedManifestUrl };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('词库加载超时，请检查网络后重试。');
    throw error;
  } finally { clearTimeout(timer); }
}
