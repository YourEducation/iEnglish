# iEnglish

**让每个单词都有来处。**

面向英语学习者的网页词典，采用 Material 3 视觉风格。支持中英文查词、权威词典跳转、收藏和学习笔记，适合日常查阅与词汇学习。

词库由独立的 [YourEducation/iDICT](https://github.com/YourEducation/iDICT) 仓库维护。iEnglish 通过公开清单读取词条，前端仓库无需保存词库副本。

## 功能

- **查词与详情**：按英文单词、中文释义或标签搜索，查看音标、中英文释义、考试标签和数据出处。搜索优先显示完整单词、前缀及单词内匹配，再显示释义匹配。
- **词库浏览**：按考试等标签筛选并查看词数；支持推荐、词频、A–Z 和 Z–A 排序，每页 36 词，可前后翻页或输入页码跳转。
- **查证入口**：跳转至剑桥、牛津、韦氏、柯林斯、朗文和 Etymonline，支持设置常用来源。
- **学习记录**：收藏单词、记录学习笔记、查看最近 30 条查阅记录；收藏页支持在已收藏单词中搜索。
- **词库管理**：查看清单提供的词库名称、版本、词数与来源，支持刷新和下载公开词库 JSON。
- **多端使用**：响应式布局、手机抽屉导航、深浅色主题、键盘搜索建议和减少动态效果适配。

推荐排序在搜索时按匹配程度排列，未搜索时按词库提供的选词顺序排列。词频顺序取自词条的 `frequency.selectionRank`，缺失该信息的词条排在末尾。

## 快速开始

需要 **Node.js 18 或更高版本**及现代浏览器。项目使用原生 HTML、CSS、JavaScript 和 Node.js 内置模块，无需安装依赖或执行构建。

```sh
git clone https://github.com/YourEducation/iEnglish.git
cd iEnglish
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。默认词库来自 iDICT 公开地址，首次加载需要网络连接。请通过开发服务器访问页面，直接双击 HTML 无法正常使用模块与词库加载。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm start` | 启动同一个本地服务器 |
| `npm test` | 运行数据处理与词库加载器测试 |

开发服务器监听 `127.0.0.1`，默认端口为 `5173`。在 PowerShell 中更改端口：

```powershell
$env:PORT = '5174'
npm run dev
```

## 词库配置

接入配置位于 [src/config.js](src/config.js)：

```js
export const vocabularyConfig = Object.freeze({
  manifestUrl: 'https://raw.githubusercontent.com/YourEducation/iDICT/main/manifest.json',
  repositoryUrl: 'https://github.com/YourEducation/iDICT',
  localManifestUrl: './vocabulary/manifest.json',
  timeoutMs: 30000
});
```

| 配置 | 说明 |
| --- | --- |
| `manifestUrl` | 公开词库清单地址，支持绝对 URL 或站点内相对路径；配置后优先使用 |
| `repositoryUrl` | 词库说明与缺少单独来源的词条所使用的仓库链接 |
| `localManifestUrl` | 公开地址为空时，仅在本地回环主机启用的清单地址 |
| `timeoutMs` | 词库加载超时时间，单位为毫秒，默认 30 秒 |

### 使用公开词库

默认地址跟随 iDICT 的 `main` 分支。正式发布需要固定数据时，可将地址中的 `main` 替换为实际存在的标签或提交。接入其他兼容词库时，同时更新清单地址与仓库链接。

加载流程如下：

1. 获取清单，读取词库名称、版本、词数、来源与许可声明。
2. 按清单下载 JSON 数据；相对路径以最终清单地址为基准，支持清单重定向。
3. 校验文件字节数、SHA-256 与词条数量，通过后提供搜索和浏览。

加载器支持 `schemaVersion: 1`，当前接受 1–20,000 条词条、最大 32 MiB 的 JSON 文件。数据格式与发布要求见 [iDICT README](https://github.com/YourEducation/iDICT#readme)。

请求不携带登录凭据。跨域托管需允许浏览器通过 CORS 读取清单和数据；完整性校验需要 HTTPS 或受信任的本地回环环境。

配置了公开地址后，加载失败会显示错误与重试入口。清空 `manifestUrl` 后，生产站点显示“公开词库即将开放”，仍可使用权威词典查询入口。

### 使用本地词库

本地联调前，将 `manifestUrl` 设为 `''`。仅设置目录环境变量不会覆盖已配置的公开地址。

开发服务器默认将 `/vocabulary/` 映射至前端目录旁的 `iEnglish-vocabulary`：

```text
workspace/
├── iEnglish/                  本仓库
└── iEnglish-vocabulary/       兼容的本地词库目录
    ├── manifest.json
    ├── words.json
    └── licenses/
        └── *.txt
```

使用其他位置的词库时，在 PowerShell 中指定目录后启动：

```powershell
$env:IENGLISH_VOCABULARY_DIR = 'C:\Projects\iDICT'
npm run dev
```

请使用 [http://localhost:5173](http://localhost:5173) 或 [http://127.0.0.1:5173](http://127.0.0.1:5173) 访问。本地回退仅对 `localhost`、`127.0.0.1` 和 `[::1]` 主机名生效；内置服务器监听 IPv4。

本地映射仅开放 `manifest.json`、`words.json` 与 `licenses/` 下的 `.txt` 文件。前端使用 JSON，CSV 与其他数据维护文件由 iDICT 仓库管理。

## 学习记录与快捷键

收藏、笔记、最近查阅、常用来源和主题偏好保存在当前站点、当前浏览器的 `localStorage` 中，不上传或跨设备同步。清除站点数据会移除这些记录；更换域名或端口也会使用不同的存储空间。

笔记在停止输入 400 毫秒后自动保存，关闭详情、页面隐藏或离开页面时会尝试立即保存，也可点击“保存笔记”手动保存。界面提供保存状态，存储不可用时会提示保留笔记副本。

学习笔记独立于公开释义，下载词库得到的是公开原始数据，不包含个人学习记录。

| 快捷键 | 操作 |
| --- | --- |
| `Ctrl + K` / `Cmd + K` | 聚焦搜索框 |
| `/` | 非文本编辑状态下聚焦搜索框 |
| `↑` / `↓` | 循环选择搜索建议 |
| `Enter` | 打开选中的建议词条 |
| `Esc` | 收起搜索建议 |

## 部署

项目可部署到 GitHub Pages 等静态托管服务，无需构建或后端服务。发布 `index.html`、`favicon.svg` 与完整的 `src/` 目录，并保持相对目录结构。

- 使用 HTTPS，以支持浏览器的 SHA-256 校验。
- 确保词库清单与数据可公开读取；跨域资源需配置 CORS，也可使用同源地址。
- 发布词库时同步更新清单和数据，使用固定版本地址可减少更新过程中的版本混用。

`server.mjs` 用于本地预览和词库联调，默认仅监听本机。

## 开发

```text
index.html                       页面入口
favicon.svg                      站点图标
package.json                     启动与测试命令
server.mjs                       本地服务器及词库文件映射
src/
├── app.js                       页面与学习交互
├── config.js                    词库接入配置
├── data.js                      词条解析、搜索及个人记录
├── sources.js                   权威词典入口配置
├── styles.css                   主题与响应式样式
└── vocabulary.js                 清单加载、完整性校验与异常处理
tests/
├── data.test.js                 数据、搜索与个人记录测试
└── vocabulary-loader.test.js    词库加载器测试
```

运行 `npm test` 检查词条格式、搜索与组合筛选、排序、来源链接、个人数据隔离，以及词库地址选择、重定向、完整性校验和超时处理。测试使用构造数据与模拟请求，无需访问公开词库。

修改页面交互时，还应在浏览器中检查查词、筛选分页、收藏、笔记保存、键盘操作和移动端布局。

## 数据来源与许可

公开词库、JSON / CSV、格式约定和许可文件在 [iDICT](https://github.com/YourEducation/iDICT) 仓库统一维护。

iDICT 以 MIT 许可发布，初始词条来自同样采用 MIT 许可的 [ECDICT](https://github.com/skywind3000/ECDICT)，后续由 iDICT 整理、修订与维护。具体声明以词库仓库及发布清单为准。

剑桥、牛津等词典链接用于查证，不代表这些词典提供或核验了 iDICT 中的释义。
