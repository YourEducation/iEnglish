# iEnglish

面向所有英语学习者的公开网页词典，采用 Material 3 视觉风格。访客打开页面即可查词，词库由独立仓库统一维护。前端不再提供个人词库导入功能。

## 两个独立仓库

- `D:/Github/iEnglish`：静态前端、词库加载器、浏览器中的学习功能。
- [YourEducation/iDICT](https://github.com/YourEducation/iDICT)：公开词库、发布清单、格式说明和许可。当前 2.0.0 版收录 8,000 词，词数会随上游维护变化。

前端不保存词库副本，也不依赖数据仓库中的源代码。两者通过公开的 `manifest.json` 和 `words.json` 连接。

## 本地预览

Node.js 18+，无需安装依赖。在前端目录运行：

```sh
npm run dev
```

打开 http://localhost:5173 。本地预览与部署站点默认都从 iDICT 的公开地址读取词库，刷新词库即可读取 `main` 分支的最新清单。

开发服务器也保留本地词库映射：将 `src/config.js` 的 `manifestUrl` 暂时设为空字符串后，回环地址上的页面会使用 `/vocabulary/manifest.json`，对应同级 `iEnglish-vocabulary` 目录。目录在其他位置时，可设置 `IENGLISH_VOCABULARY_DIR` 指定绝对路径。配置了公开地址时，网络错误会显示失败与重试，不会悄悄切换到另一份数据。`PORT` 可更改端口。直接双击 HTML 不支持模块和网络加载。

## 接入公开的数据仓库

唯一的接入配置位于 `src/config.js`：

```js
export const vocabularyConfig = Object.freeze({
  manifestUrl: 'https://raw.githubusercontent.com/YourEducation/iDICT/main/manifest.json',
  repositoryUrl: 'https://github.com/YourEducation/iDICT',
  localManifestUrl: './vocabulary/manifest.json',
  timeoutMs: 30000
});
```

`manifestUrl` 已接入 iDICT 的公开清单，`repositoryUrl` 用于词库说明及缺少单独来源的词条。页面从清单读取名称、版本、词数、来源声明与许可名称，不将它们固定在前端。词库无需复制到前端仓库；将前端部署到静态托管服务即可，GitHub Raw 已支持跨域读取。

切换其他数据仓库时修改这两个公开地址即可。也可以将 `manifestUrl` 设置为部署站点内的相对清单地址。若清单经过 CDN 重定向，数据相对路径会以重定向后的清单位置为准。

清空 `manifestUrl` 后，`localManifestUrl` 仅在 `localhost`、`127.0.0.1` 和 IPv6 回环地址上生效；其他站点会显示“公开词库即将开放”，权威词典入口仍可使用。

正式发布可用固定标签或提交代替 `main`。发布词库时清单和数据需一起提交；使用固定版本地址可避免更新过程中的版本混用。

加载器自动解析清单中的相对数据地址，校验文件大小、SHA-256 和词数，并提供加载中、失败和重试状态。校验需要 HTTPS 或 localhost。前端只读取公开数据，网络请求不携带登录凭据。

## 功能

- iDICT 公开词库，英文、中文释义和标签搜索；依次优先显示完整单词、前缀及单词内匹配，词数以发布清单为准。
- 单词详情、音标、中英文释义、考试标签和数据出处。
- 剑桥、牛津、韦氏、柯林斯、朗文和 Etymonline 查询入口。
- 词库信息展示名称、版本、词条总数，支持刷新及下载公开词库。
- 按考试等词汇标签筛选，显示各标签词数；可与英文、中文搜索组合使用。
- 每页 36 词，支持匹配优先、词频及字母排序、前后翻页和输入页码跳转。浏览词库默认按词库发布的选词顺序排列，未提供词频顺序的单词排在末尾。
- 个人收藏、自动保存的学习笔记、最近查阅及常用来源。
- 手机抽屉导航、深浅色模式、键盘操作和减少动态效果适配。
- `Ctrl/Cmd + K` 或 `/` 聚焦搜索框。
- 搜索建议支持上下方向键循环选择、回车打开详情、Esc 收起；收藏页只建议已收藏的单词。

笔记在停止输入 400 毫秒后自动保存，关闭详情或切换到其他页面时也会立即尝试保存；仍可点击“保存笔记”手动重试。页面会显示保存状态，浏览器存储不可用时会提示保留笔记副本。

收藏、笔记、历史和外观偏好只保存在当前浏览器的 localStorage 中。公开词库的释义始终以数据仓库为准，笔记不会覆盖它，也不会上传。旧版本浏览器记录中只迁移个人笔记、收藏和历史，不再加载旧的个人词库释义。下载词库获取的是公开原始数据，不包含访客笔记。

## 数据维护

数据格式、JSON / CSV、许可和发布清单在 [iDICT 仓库](https://github.com/YourEducation/iDICT) 维护，具体约定见该仓库 README。前端仓库不维护词库副本或词库生成脚本。

iDICT 以 MIT 许可发布，初始词条来自 MIT 许可的 ECDICT，之后由 iDICT 整理、修订与维护。页面展示词库清单的来源声明；剑桥、牛津等权威词典链接用于查证，不代表这些词典提供或核验了 iDICT 的释义。

## 前端文件

```text
index.html          页面入口
src/styles.css      Material 3 主题与响应式样式
src/app.js          页面与学习交互
src/config.js       独立词库接入配置
src/vocabulary.js   清单加载、校验与异常处理
src/data.js         词条解析、搜索及个人记录
src/sources.js      权威词典入口的界面配置
server.mjs          本地静态服务器与词库公开文件映射
tests/              前端和加载器测试
```

运行 `npm test` 检查格式校验、来源链接、搜索与组合筛选、词频排序、公开地址预留、本地回退、清单重定向、完整性验证、超时和个人数据隔离。
