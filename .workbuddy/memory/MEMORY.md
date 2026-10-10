# MLF 投研报告库 — 项目长期笔记

## 项目性质
纯静态本地站点（无后端、无构建工具），双击 `index.html` 即可打开。用途是归档个人 A 股投研报告。

## 核心约定（改动前必须遵守）
- `data/reports.js` 是**自动生成**文件，禁止手改。改索引一律跑 `python3 tools/build-index.py`（mac）或 `update-index.bat`（Win）。
- 板块归属由 `reports/<板块>/_sector.json` 的 `group` 决定，四个取值：`market`（趋势）/ `sector`（板块，默认）/ `stock`（个股）/ `other`。
- 报告文件命名必须是 `YYYYMMDD_主题.html`；日期从文件名解析，标题取 `<title>`（脚本会自动剥掉尾部 `| 2026-10-09` 这类后缀）。
- 报告 `<head>` 可选两个 meta：`description`（列表页显示的一句话结论）、`report-type`（类型标签）。缺省时 `js/site.js` 用标题关键词正则兜底推断。
- `tools/build-index.py` 刻意复刻 PowerShell `ConvertTo-Json` 的缩进（4/8/24/28/20），目的是两个脚本产出字节一致，不要"优化"缩进。
- 排序逻辑：板块按 `latest` 倒序，同日期时沿用旧文件里的既有顺序（`existing_order()` 兜底），新板块排前面。

## 外部报告入库流程（已重复执行多次，照做即可）
1. **确认源文件**：`ls` 目标目录。用户粘贴的 URL 可能因为多字/少字与实际文件名不符，或同一文件重复粘贴 —— 先比对真实文件名再动手，有疑问就问。
2. **定日期**：优先用文件名里的日期；没有则从正文「数据截至 / 数据基准 YYYY-MM-DD」取。**不要用 mtime**（生成日往往比数据基准日晚一天）。
3. **复制并重命名**为 `reports/<板块>/YYYYMMDD_主题.html`。同板块同一天有多份时，文件名要能互相区分（例如「产业深度与量价择时」vs「细分方向与 10 只标的拆解」）。
4. **补两个 meta**（外部产出的报告几乎都没有）：`description` 写一句话结论（含关键数字、评级/评分、买卖与止损位），`report-type` 写类型标签。
   - report-type 必须**显式写**，`site.js` 的兜底正则很容易误判：含「深度」→ 个股深度；含「大盘」→ 大盘扫描。
5. 新板块要建 `_sector.json`（写 `desc`，`group` 非 sector 时才需要显式写），并在 `about.html` 的目录树里补一行。
6. 跑 `python3 tools/build-index.py`，用一段 json.loads 校验 group / date / type 是否符合预期。

## 已知状态
- 报告目录：半导体材料(3)、PCB(2)、个股(4)、AI短剧(2)、端侧SoC(1)、传媒(2)、保险(4)、大盘(1)、其他(1)。共 9 板块 20 份。
- 前端三个脚本加载顺序固定：`data/reports.js` → `js/main.js`（主题切换/导航高亮/年份）→ `js/site.js`（列表渲染）。
- `js/site.js` 同时服务 index 与 sector 两个页面，靠 `#report-list` 是否存在来分支。
- 主题切换用 `document.documentElement[data-theme]` + localStorage key `mlf-theme`。

## 记录功能（notes）
- `notes.html` + `js/notes.js`：本地速记本。**数据主存储是 `data/notes.js`**（`window.NOTES = [...]`，script 标签加载；写入通道三选一按优先级自动探测：**① 本地服务** `tools/notes-server.py`，双击 `start-server.command`（mac）/`start-server.bat`（Win）启动，端口 8765，GET/POST `/api/notes` 读写文件，页面 probeApi 探测到即 apiMode；② Chrome/Edge File System Access API 直写（句柄存 IndexedDB `mlf-notes-fs`，连接一次后自动读写）；③ localStorage key `mlf-notes` 纯缓存/降级**。
- 服务模式静态文件 + API 都由 `notes-server.py` 提供（SimpleHTTPRequestHandler directory=ROOT），所以 localhost:8765 也能正常浏览全站；服务未启动时双击 index.html 照常（只读 localStorage / FSA）。
- 导航四个页面（index/sector/notes/about）顺序：首页 | 记录 | 关于；`main.js` 的 data-nav 高亮对 notes.html 自动生效，不要改 main.js。
- 功能：标题留空自动取正文首行（30 字截断）、可选关联板块（下拉来自 SECTORS）、搜索过滤、编辑/删除、Ctrl+Enter 保存、超 3 行折叠展开（`.clamp`，先施加限高再比较 `scrollHeight > clientHeight`）、导出 JSON 备份（`mlf-notes-backup-YYYYMMDD.json`）。
- 渲染全部用 createElement + textContent，防 XSS；样式在 style.css 末尾 `/* ---- notes ---- */` 段。
- merge 策略：load = merge(localStorage, 数据源) 按 id 并集取 updatedAt 新；persist 会同步更新 window.NOTES 防已删条目从旧文件内容复活。`data/notes.js` **会被用户记录写入，不要手改**。
