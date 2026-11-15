# 翻译记忆库：哪些入库，哪些不入库

这个目录是翻译流水线的本地状态。**不是所有文件都该进 git**：判断标准只有一条——
它能不能从仓库里已有的东西（`i18n/` 下的 overlay，加上另一份记忆）重建出来。

- 能重建、或者只是本机日志的：**不入库**，留在本地（或在 `.gitignore` 里）。
- 千字节级、重建会丢信息的状态：**入库**，因为 CI 的下一批翻译要靠它接着上一批跑。
- 体积大又重建不了：**作为本地资产保留**，做压缩备份放在仓库外；不进 git，也不进工作流。

`.gitignore` 里对应的规则注释会指回本文件；改策略时两处一起改。

## 一、速查表

| 文件 | 作用 | 可删？ | 删了会断什么 |
| --- | --- | --- | --- |
| `translation-memory.json` | 已审校的旧版语料对齐结果，内存 TM 的第一来源 | **不可删**（**已入库基线快照**） | `derive` / `translate tm` 直接抛错；`translate --refresh-changed` 会跳过并告警；`apply` / `translate` / `pending` 退化成只靠覆盖层 + `keep-english`。legacy 语料已从工作区移除，**无法重建** |
| `model-memory.json` | 按 section 记录模型产出的译文，`apply`/`derive` 运行时并入内存 TM | **不可删**（**已入库基线快照**，可重建但有损） | `keep-english.json` 缺失时无法从它播种（`loadLocks({seedFrom})`），新克隆要重新发现「保持英文」的块；`refresh --changed` 少一批可复用译文，只能把旧覆盖层的措辞按块指纹沿用或重翻 |
| `keep-english.json` | 「故意保持英文」的块账本 | **不可删** | 每批都会把译不动的技术记号重新送翻，`pending` 永远归不了零。它记的是语义判断，覆盖层重建不出来 |
| `comment-memory.json` | 代码围栏里行首注释的译文 | 建议留 | 注释会重翻一次（多花钱、措辞可能漂移）；覆盖层不受影响 |
| `state/translation-state.json`（仓库根 `state/`） | 每页的翻译进度 | **不可删** | `pending` / `translate:verify` 的页面级判据全丢，要整树重扫；`pendingBlocks` 也没了 |
| `tm-global.<locale>.json` | 三源合并出的全局 TM 快照，只供检查 | 可删（派生，且 {{LOCALE}} 那份无人读） | 只由 `translate tm` 手动写；`apply` / `translate` / `verify` 都不读它，仅非默认语种的 `derive` 读自己语种的那份。删了下次 `translate tm` 重新合并即可 |
| `table-memory.json` | 表格行的翻译缓存 | 可删（派生） | 下次跑 `tools/translate/tables.mjs` 时按 overlay / 模型记忆补建，未命中的行重新调模型（变慢） |
| `legacy-index.json`、迁移备份、`usage.jsonl` | 旧 legacy 索引 / 一次性快照 / 本机成本流水 | 可删，或移出本目录 | 都不参与流水线：`legacy-index` 已失效、迁移备份零引用、`usage.jsonl` 删了只丢历史成本 |
| `shards/*.json` | 增量译文分片，**CI 里新译文唯一能进 git 的载体** | 合并后可删 | 删掉尚未并入 `model-memory.json` 的条目，下一批会重新翻译（花钱、措辞可能漂移）。见第七节 |

## 二、入库（提交到 git）

| 文件 | 体积 | 作用 |
| --- | --- | --- |
| `keep-english.json` | 696 KiB | 故意保持英文的块。删了它，每批都会重新送翻，`pending` 永远归不了零。 |
| `comment-memory.json` | 20 KiB | 代码围栏里行首注释的译文，保证一条注释只翻一次。 |
| `run.json` | 523 B | 上一批的日志（停止原因、`pending`、token 成本），含 `refresh` 摘要。 |
| `state/translation-state.json`（仓库根 `state/`） | 约 2.9 MiB（含每页块指纹，首次基线后） | 每页翻译进度 + `source_sha256`/`overlay_sha256`/`source_blocks`；`translate:verify` / `pending` 都读它。 |
| `translation-memory.json` | 18.2 MiB（打包约 3.5 MB） | **基线快照**：审校过的旧版记忆，`refresh --changed` 与 `apply`/`derive` 的第一来源。之后**不再重写**。 |
| `model-memory.json` | 25.3 MiB（打包约 4 MB） | **基线快照**：截至入库时模型产出的全部译文。之后**不再重写**，新增只走分片。 |
| `shards/*.json` | 每批几十到几百 KiB | 增量译文分片（第七节）：基线之后新译文的唯一入库载体。 |

前五份是“接着上一批继续”的最小状态，必须入库：CI 的翻译 job 从仓库恢复状态，
不入库等于每批从零开始。两份大记忆是**一次性基线**（约 7.4 MB packed），入库后
`translate --refresh-changed` 才有记忆可用；它们不会被批次重写，所以不会让每个
batch commit 都背上一份 26 MB 的 diff。

## 三、不入库：可重建的大记忆

| 文件 | 体积 | 重建方式 |
| --- | --- | --- |
| `tm-global.{{LOCALE}}.json` | 13.9 MiB | 纯派生：只有 `npm run translate:tm` 会写它（把 `translation-memory` + `model-memory` + `comment-memory` 合并后的快照落盘）。`apply` / `translate` / `verify` 都不读它，所以删掉不影响流水线。 |
| `table-memory.json` | 321 KiB | 表格行的翻译缓存。跑 `node tools/translate/tables.mjs` 时按 overlay/模型记忆补建；未命中的行才会调用模型。 |
| `usage.jsonl` | 519 B | 本地成本流水，`tools/translate/lib/provider.mjs` 追加写入。属于本机日志，不是可移植状态。 |

`model-memory.json` 已作为基线入库（见第二节），不再需要“重建后开箱即热”的本地备份。
`translate:harvest` 仍可从 overlay 反向重建它：重建结果依赖当时的 overlay，是有损的，
只在基线损坏时作为最后手段。

## 四、不可重建但已入库：`translation-memory.json`

`translation-memory.json`（18.2 MiB）是已审校的旧版语料对齐结果，**无法从当前仓库重建**
——生成它的 legacy 语料已经从工作区移除。丢了它，模型只能重翻，等于丢掉审校过的措辞。

它现在是**入库的基线快照**（`.gitignore` 用 `!/work/translate/translation-memory.json`
放行，打包约 3.5 MB）。入库的理由：`translate --refresh-changed` 要用它按英文块
重建被改动的页面；CI 的 checkout 以前没有它，只能把整页重新送去翻译。入库之后它
**不再被批次重写**（`import-legacy` 不可用，也没有别的写入路径），所以不会污染
每个 batch commit。

仍建议在仓库外留一份压缩备份（约 5 MB）作灾难恢复：

```bash
cd work/translate
mkdir -p ../translate-archive
gzip -9 -c translation-memory.json > ../translate-archive/translation-memory.$(date +%Y-%m).json.gz
```

需要恢复时解压回本目录：

```bash
gunzip -c ../translate-archive/translation-memory.2026-11.json.gz > translation-memory.json
```

备份只是灾难恢复手段（误删、坏盘）。仓库里没有它时：`refresh --changed` 跳过并告警
（**不会**把中文页打回英文），`translate` / `apply` / `pending` 从覆盖层 +
`keep-english.json` 继续跑，`derive` / `tm` 硬依赖它会直接报错。

## 五、变更流程

1. 正常翻译/审校。`translation-memory.json` 与 `model-memory.json` 是**基线**：
   批次不再重写它们，新译文由 `shards/*.json` 追加（第七节）。
2. 确需刷新基线（例如把分片并回、或从 `translate:harvest` 重建模型记忆）时，用
   `saveModelMemory(..., {writeBaseline: true})` 的显式入口，**一次提交只动一份基线**，
   并在提交信息里写清体积变化。
3. 需要长期保留新的 `translation-memory.json` 时，另做一份压缩备份（`gzip -9`，
   约 5 MB，见上），放在仓库外；**不要覆盖**旧备份。
4. 派生物（`tm-global`、`table-memory`、`usage.jsonl`、以及其他一次性备份）直接删或
   移到仓库外的 `../work/translate-archive/`；它们不该长期躺在 `work/translate/` 里。

## 六、本地归档目录

仓库外（工作区 `work/translate-archive/`）保留了一份派生物副本，仅作本机排查用，
不发布、不提交：

| 文件 | 体积 | 说明 |
| --- | --- | --- |
| `translation-memory.before-html-links.json` | 18.2 MiB | 链接改写前的一次性快照，零引用。 |
| `translation-memory.<年月>.json.gz` | 约 6 MB | `translation-memory.json` 的压缩备份，灾难恢复用。 |
| `tm-global.{{LOCALE}}.json` | 13.9 MiB | 旧的合并结果，纯派生。 |
| `legacy-index.json` | 2.5 MiB | 旧 legacy 索引，已失效。 |
| `table-memory.json` | 321 KiB | 表格行缓存。 |
| `usage.jsonl` | 519 B | 旧的成本流水。 |

确认没用了就可以连同目录一起删。

## 七、分片（shards）：基线之后新译文的入库路径

`model-memory.json`（26 MB）现在是入库的**基线快照**。`saveModelMemory()` 不再
重写它——否则每批 commit 都会多一份 26 MB 的 diff——而是把**新增或值变了的键**
写成一个**增量分片**：

```
work/translate/shards/20261115-055422-{{LOCALE}}.json
```

```json
{"schema":1,"locale":"{{LOCALE}}","created_at":"2026-11-15T05:54:22.000Z","entries":{"docs-7.25\u0000The general menu is used to manage certificates.":"常规菜单用于管理证书。"}}
```

### 何时写

- 保存模型记忆时，把内存里的每个键与「`model-memory.json` + 已提交分片」的合并
  结果比较；**只写新增或值变了的键**，值没变的不写。
- `translate`/`translate:batch` 调用 `saveModelMemory(..., {writeBaseline: false})`：
  只写分片，不重写 26 MB 基线；`translate:harvest`、表格/标题维护脚本仍会显式重写
  基线（它们本来就是“重建记忆”的命令）。这是“基线快照，之后只追加分片”的代码保证。
- **没有新增/变更就不写文件**。纯加载、重跑同一批不会制造空分片。
- 文件名是 UTC 时间戳 + 语种（`YYYYMMDD-HHMMSS-<locale>.json`）；同一秒内保存
  两次会合并进同一个文件，后写覆盖。
- 格式固定：紧凑 JSON（无缩进）、UTF-8、`entries` 按 key 升序。顶层键顺序是
  `schema`、`locale`、`created_at`、`entries`。

### 何时合并（加载）

`createGlobalTm()` 与 `loadModelMemory()` 都先读 `work/translate/model-memory.json`
（若存在），再按**文件名顺序**叠加 `work/translate/shards/*.json`：

1. 分片优先于大文件；
2. 后写的分片优先于先写的；
3. 单个分片损坏只跳过该文件（丢掉它带来的条目，下一批重翻），不让整批失败。

CI 里的基线来自仓库快照，此后新增的记忆只在分片里，所以**分片必须入库**。
`.gitignore` 已用 `!/work/translate/shards/` 与 `!/work/translate/shards/*.json`
放行，`translate` job 现有的 `git add -A work/translate` 会自动带上它们。

### 体积控制

只告警、不拦截（是否压缩由人决定）：

| 条件 | 行为 |
| --- | --- |
| 单次新增/变更 > 5,000 条 | stderr 告警，仍然写入 |
| 单个分片 > 2 MB | stderr 告警，仍然写入 |

告警文本会指回本节。分片变多不等于译文变多：同一批里同一英文块被改写、或后续
批次修正旧译文，都会各写一条（后写覆盖）；真正要担心的是**目录总大小**和
**加载时间**。

### 如何压缩

按文件名顺序合并成一个分片（后写覆盖），然后删掉被合并的文件。在仓库根执行：

```bash
node --input-type=module - <<'JS'
import fs from 'node:fs';
const dir = 'work/translate/shards';
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
const entries = new Map();
for (const name of files) {
  const payload = JSON.parse(fs.readFileSync(`${dir}/${name}`, 'utf8'));
  for (const [key, value] of Object.entries(payload.entries || {})) entries.set(key, value);
}
const sorted = Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const out = `${dir}/${stamp}-{{LOCALE}}.json`;
fs.writeFileSync(out, `${JSON.stringify({
  schema: 1,
  locale: '{{LOCALE}}',
  created_at: new Date().toISOString(),
  entries: sorted,
})}\n`);
for (const name of files) fs.unlinkSync(`${dir}/${name}`);
console.log(`merged ${files.length} shard(s) into ${out} (${entries.size} entries)`);
JS
```

压缩是幂等的：合并后再跑 `translate`，已覆盖的键不会再产生分片。长期策略是**按
月合并**（每月一个文件），而不是每批一个；单仓分片目录稳定超过几十 MB 时，说明
该把它们并进 `model-memory.json` 的归档流程（`translate:harvest` + 仓库外备份），
而不是继续堆分片。
