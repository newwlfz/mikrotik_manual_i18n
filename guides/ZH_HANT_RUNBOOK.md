# 線上從零建站：繁體中文（zh-Hant）操作手冊

本手冊給你照著簡體流程自己動手，把繁體站從空倉做到上線。全程只動 GitHub 上的設定與純文字檔（`locales.json`、骨架內的佔位符），不碰任何私密值。原理背景見 `guides/ONBOARDING.md`、`guides/ARCHITECTURE-MULTISITE.md`、`guides/CI.md`。

## 0. 先記住四個「坑」（簡體跑通後才補上的）

- **骨架首次 push 後的第一個 run 失敗是正常的。** 骨架還沒有 `docs/` 等內容根，`pages.yml` 會在 "verify content roots" 步驟直接停住；等 hub 第一次推內容後的下一個 run 才會真的翻譯。
- **publisher 的 `.gitignore` 否定規則 bug 已修。** 舊版把 `!/locales.json`、`!/docs/` 這類否定規則誤判成「被忽略」而中止推送；現在已修正（hub commit `271633ec`，8 個 fixture 全過）。若看到類似 abort，先確認 hub 已含這個修正。
- **建置堆積要 6144 MB。** `pages.yml` 的 `BUILD_HEAP_MB` 必須是 `'6144'`（對應 `NODE_OPTIONS=--max-old-space-size=6144`）；在 16 GiB runner 上靜態渲染才不會 OOM。別沿用舊骨架 README 裡的舊數值（4 GiB）。
- **Pages 的 Source 必須是 GitHub Actions。** 若停在 "Deploy from a branch"，即使 build 全綠，網站仍會是 404。

## 1. 前置確認清單（逐項打勾再開始）

- [ ] `github.com/newwlfz/mikrotik_manual_zh_hant` 已建立，且**完全空倉**：不要勾 README、.gitignore、license，否則首推會 non-fast-forward。
- [ ] 該倉 **Settings → Pages → Build and deployment → Source: GitHub Actions**。
- [ ] hub 的 Actions secret `CROSS_REPO_TOKEN`（細粒度 PAT）白名單**含 zh_hant**，且具 `Contents: read and write`、`Actions: read and write`。值只存在 hub secret，不進任何檔案或指令。
- [ ] zh_hant 倉 **Settings → Secrets and variables → Actions** 已設：`LLM_BASE_URL`、`LLM_MODEL`（Variables），`LLM_API_KEY`（Secrets）；若範本讀取再加選用的 `LLM_TIMEOUT_MS`（預設 120000 ms）。只填名字，不要把值寫進文件或 commit。
- [ ] hub Release `skeleton-v0.1.0` 的兩個 asset（`skeleton-v0.1.0.tar.gz` 與 `skeleton-v0.1.0.manifest.json`）可下載；第 2 節的命令會自動下載並驗雜湊，無須手動備檔。2026-11-25 重建後的新記錄：`source.commit = d4ff0b6b`、archive sha256 `f4806932da7765ab8ee9ec8d85e30752287483e25d86afc88dd382279b7e5c8a`（manifest：`file_count = 245`、required 19/19、逐檔 245/245 雜湊吻合）。若仍拿到舊值 `4a06da043563553523af1184b5897d24703057b291452ff57e6c2c9f2f6c4c9d`（`source.commit = 4a40c31d`），代表是重建前的資產，請重新下載。

## 2. 步驟一：一鍵下載骨架、展開 11 個佔位符、首次推送

第 1 節的人工前置已完成（空倉、PAT 白名單、LLM 變數/金鑰、Pages Source），且 `locales.json` 已註冊 zh-Hant 後，在**空的 zh_hant 工作目錄**執行一條命令（也可加 `--dir` 指向空目錄）：

```bash
# <你的 hub checkout 路径> 是占位符，请替换成你本机 hub checkout 的真实绝对路径
node <你的 hub checkout 路径>/templates/locale-repo/tools/bootstrap/from-release.mjs \
  --locale zh-Hant --label 繁體中文 --repo newwlfz/mikrotik_manual_zh_hant --slug zh_hant
# 若在 template checkout 內執行（npm script 定義在 hub 的 package.json）：
npm run bootstrap:from-release -- --locale zh-Hant --label 繁體中文 \
  --repo newwlfz/mikrotik_manual_zh_hant --slug zh_hant --dir <你的真实空目录>
```

**路徑與參數寫法（踩坑提醒）：**`<你的 hub checkout 路径>`／`<你的真实空目录>` 是占位符，也就是本文其他說明裡的 `<HUB>`；請換成你自己本機的真實絕對路徑。本機真實例子（僅供參考，不要照抄）：hub 為 `/home/evan/mikrotik_manual_i18n/mikrotik_manual_i18n`，空目標為 `/home/evan/tmp/empty-zh-hant`。**照抄別人的路徑會讓 Node 回 `Cannot find module ... code: 'MODULE_NOT_FOUND'`**——那是腳本檔案找不到，不是套件沒裝。此腳本只 `import` Node 內建模組（`node:fs`、`node:path`、`node:os`、`node:crypto`、`node:child_process`），不依賴 hub 的 `node_modules` 或 `package.json`，因此可從任意空目錄（例如 `~/tmp`）直接用絕對路徑呼叫。預設 target 是**目前工作目錄**，必須不存在或為空；非空會在寫入前中止。若不想 `cd`，用 `--dir` 指向**真實空路徑**（可不存在但不可有檔案）。`--locale zh-Hant` 與 `--locale=zh-Hant` 兩種寫法都支援（`--label=...`、`--repo=...`、`--slug=...` 同理），差異只在排版。

只需這四個參數；`BASE_URL`／`SITE`／`SITE_ORIGIN`／`HUB_REPO`／`HUB_BASE_URL`／`ASSET_ORIGIN` 一律讀 Release 的 `manifest.hub`，不要在命令列重複設定。`--dry-run` 仍會下載（除非另給 `--asset-dir <本機 asset 目錄>` 做離線預演），但只校驗並列出計劃、不寫入目標；`--version`／`--hub` 可指向別的 Release tag 或 hub 倉。

這條命令會：下載 `skeleton-v0.1.0.manifest.json` 與 `.tar.gz` → 比對 `archive.sha256` 與**逐檔** SHA-256 → 拒絕非空目標 → 展開 11 個佔位符（**內容與路徑**，`i18n/{{LOCALE}}/.gitkeep` → `i18n/zh-Hant/.gitkeep`）→ 複驗 0 殘留、關鍵值（label／repo／baseUrl／site／assetOrigin／env prefix）與無產物混入 → 才移入工作目錄並印出 git 指令。任何失敗立即中止、不留下半成品；它**不 commit、不 push、不寫任何金鑰**。JSX/JS lookalike、`${{ ... }}` Actions 運算式與 `tools/translate/readme.mjs` 中的字面範例會原樣保留；未知或殘留佔位符是硬錯誤。

模板只有共用英文 `README.md`；若取得的是舊資產，命令會跳過並列出 `README.zh-Hans.md`／`README.zh-Hant.md` 兩個舊覆蓋檔。語言倉根 README 由該倉的 `translate:readme` 工作流從 hub-docs 英文源本地化，勿手寫語言別 README 進模板。`LOCALE_ENV` 沿用 `add-locale.mjs` 的 derivation（主語言子標籤大寫，zh-Hant → `ZH`）。

### 手動排錯（僅在無網路／無 Node 時）

手動下載兩個 asset，先用 `sha256sum skeleton-v0.1.0.tar.gz` 比對 manifest 的 `archive.sha256`（目前值 `f4806932da7765ab8ee9ec8d85e30752287483e25d86afc88dd382279b7e5c8a`；舊值 `4a06da043563553523af1184b5897d24703057b291452ff57e6c2c9f2f6c4c9d` 是重建前的資產，請重新下載），再解到空目錄，用 `add-locale.mjs` 的嚴格 `substitute()`／`substitutePath()` 語意展開 11 個名稱：

| 佔位符 | 繁體值 | 佔位符 | 繁體值 |
| --- | --- | --- | --- |
| `LOCALE` | `zh-Hant` | `LOCALE_LABEL` | `繁體中文` |
| `SLUG` | `zh_hant` | `REPO` | `newwlfz/mikrotik_manual_zh_hant` |
| `BASE_URL` | `/mikrotik_manual_zh_hant/` | `SITE` | `https://newwlfz.github.io/mikrotik_manual_zh_hant/` |
| `SITE_ORIGIN` | `https://newwlfz.github.io` | `LOCALE_ENV` | `ZH` |
| `HUB_REPO` | `newwlfz/mikrotik_manual_i18n` | `HUB_BASE_URL` | `/mikrotik_manual_i18n/` |
| `ASSET_ORIGIN` | `https://newwlfz.github.io/mikrotik_manual_i18n` | | |

有 6 個檔案把 `{{` 當成 JSX/JS 運算式（manifest 的 `jsx_lookalike_files`），不要動；殘留檢查：

```bash
grep -R -n -E '\{\{(LOCALE|LOCALE_LABEL|SLUG|REPO|BASE_URL|SITE|SITE_ORIGIN|HUB_REPO|HUB_BASE_URL|ASSET_ORIGIN|LOCALE_ENV)\}\}' . --exclude-dir=.git && echo "STOP: 還有佔位符"
```

保留骨架的 `.gitignore`、`.gitattributes`、`.env.local.example` 與 workflows；真實 `.env.local` 不在骨架裡，也不要建立。命令印出（或手動執行）的首次提交：

```bash
git add -A
git commit -m "init: locale skeleton"
git remote add origin https://github.com/newwlfz/mikrotik_manual_zh_hant.git
git push -u origin main
```

## 3. 步驟二：在 hub 的 locales.json 註冊 zh-Hant

在 hub 根目錄的 `locales.json`，於 `locales` 下加一筆（七個欄位都要有，`siteTitle`／`tagline` 用繁體字）：

```json
"zh-Hant": {
  "label": "繁體中文",
  "available": true,
  "repo": "newwlfz/mikrotik_manual_zh_hant",
  "baseUrl": "/mikrotik_manual_zh_hant/",
  "site": "https://newwlfz.github.io/mikrotik_manual_zh_hant/",
  "siteTitle": "RouterOS 手冊",
  "tagline": "MikroTik RouterOS 文檔、硬體指南、新聞與 CLI 參考"
}
```

`default` 維持 `en`。提交前先在本機檢查，再看 diff 自己 push：

```bash
npm run locales:check
npm run content:publish:dry
```

這個檔案是全站事件：三個站的下拉選單、hreflang、導向中繼資料都從它來。若遠端倉尚未存在，先以 `available: false` 落盤，第二次再翻 `true`（每次翻動都會重建所有站）。

## 4. 步驟三：等 hub 推內容，觸發 zh_hant 的翻譯

hub 的 `main` 被 push 後會跑 `pages.yml`：先驗 `locales.json`、檢查 `CROSS_REPO_TOKEN`，再執行 `tools/content/publish.mjs`。它會 clone zh_hant，覆寫十個內容根（`docs/`、`versioned_docs/`、`hardware/`、`blog/`、`changelog/`、`data/`、`sidebars.ts`、`sidebars-hardware.ts`、`versioned_sidebars/`、`versions.json`）與 `locales.json`，**只在有變更時才 commit/push**；`static/` 不隨內容推送，圖片走 `ASSET_ORIGIN`。否定規則修正已上線，這一步應該成功。

這次 push（或 2 小時排程、手動 dispatch）會啟動 zh_hant 的 `pages.yml`：preflight → 一批翻譯 → 把 `i18n/`、`work/translate/`、`state/` 以 `[skip ci]` 提交。看到 translate run 就表示鏈路通了。想先本機預演：`npm run content:publish:dry`；單站可 `npm run content:publish -- --only=zh-Hant`。

## 5. 步驟四：等翻譯多輪收斂

翻譯按 checkpoint 續跑，約 **9–15 批、18–30 小時**；每輪後看 `pending` 是否下降。頑固的識別碼、技術記號、專有名詞會被模型原樣保留，寫入 `work/translate/keep-english.json`，planner 就不再排程它們——這是為了收斂，不是把英文文章混進正文。做法：

- 依然卡住的塊：在 zh_hant 倉開 PR 補 `config/glossary/zh-Hant.yml` 與 `config/locale-profiles/zh-Hant.md`（只影響**新**翻譯；既有 overlay 要 `--refresh-changed` 才更新）。
- 確定某塊要強制翻：用 `config/force-translate.yml` 覆蓋 keep-English 鎖。
- 排查用：`npm run translate:pending`、`npm run translate:verify`、`node tools/ci/release-gate.mjs --json`。

401/402/403/429 代表金鑰或配額問題，檢查 zh_hant 倉（不是 hub）的 LLM 設定；別用 `skip_translate` 假綠燈。

## 6. 步驟五：build / deploy 與驗收

只有 `pending == 0` 且 release gate `pass`（`translate:verify`、`verify:deploy` 全綠）才會跑 `build` → `deploy`；失敗的批次會保留上一次部署。

上線後到 `https://newwlfz.github.io/mikrotik_manual_zh_hant/` 驗收：

- [ ] 導覽列三語下拉（English／简体中文／繁體中文）都在，切換正確。
- [ ] 正文是繁體（標題、段落、按鈕），不是英文或簡體。
- [ ] 三版 Tags 數量為 **3 / 4 / 4**（current／7.25／7.24）。
- [ ] CLI 參考連結可點、指向正確版本。
- [ ] PDF 提示有出現（`verify:pdf-notice`）。
- [ ] 裸鏈（未帶 baseUrl 的絕對路徑）為 **0**（`verify:base-url`、`verify:links`）。

## 7. 排錯對照表

| 現象 | 原因與處理 |
| --- | --- |
| `Cannot find module '<示範路徑>/templates/...'`，`code: 'MODULE_NOT_FOUND'` | 把文件裡的示意路徑當成字面路徑執行；改用 `<你的 hub checkout 路径>` 對應的真實絕對路徑（本機真實例子，僅供參考：`/home/evan/mikrotik_manual_i18n/mikrotik_manual_i18n/templates/locale-repo/tools/bootstrap/from-release.mjs`）。不是缺少 npm 套件。 |
| 骨架 push 後首個 run 快速失敗 | 缺內容根（`docs/` 還沒有），`pages.yml` 在 "verify content roots" 停下——**預期**；等 hub 首次 publish 後的下一個 run。 |
| publisher clone/commit 失敗並提到被忽略的根 | 舊版 check-ignore 誤判 `!/...` 否定規則；確認 hub 已含修正（`271633ec`），或檢查 `.gitignore` 是否仍真正忽略 `locales.json`／`docs/`。 |
| build 全綠但網站 404 | Pages Source 不是 GitHub Actions；到 Settings → Pages 改回來再跑部署。 |
| `pending` 卡住不降 | 先看 preflight（金鑰／配額），再看 `work/translate/keep-english.json` 與 glossary；保持 2 小時排程或手動 dispatch，必要時用 PR 補 profile/glossary。 |

詳細契約見 `guides/CONTRACT.md`、`guides/FANOUT.md`、`guides/LLM.md`。
