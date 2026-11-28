# New-session prompt: the three-part UI work

> Copy the entire "Prompt body" section below and submit it to the new session.

---

## Prompt body

You are taking over the **site experience trio** for the MikroTik manual mirror.
Read this note first, then `guides/PIPELINE.md`, then start work.

### 0. Repository and current state

- repository: the hub checkout `newwlfz/mikrotik_manual_i18n`, branch `main`, remote synced to `ed3d19c` (the work tree should be clean)
- Docusaurus 3.10.1, two locales: `en` (default), `zh-Hans`; three documentation versions: 7.26 (`docs/`), 7.25, 7.24
- build with `npm run build` (`tools/build/index.mjs` injects a 10 GiB heap, about 25 minutes, **only one build at a time**)
- existing verification: `node tools/pipeline/verify.mjs` (structure/tables/CLI/labels/sidebars), with `--browser` adding 22 browser assertions
- ground rules: never hand-edit `docs/`, `versioned_docs/`, `i18n/`, `sidebars.ts`; never push; reports and commit messages are in Chinese; every rule must land as "data + stage + assertion"

### 1. The three features

#### A. Automatic switch by browser language (fall back to English when there is no locale match)

- create `src/clientModules/locale-detect.js` and add it to `clientModules` in `docusaurus.config.ts`
- rule: on the **first visit** (no `docusaurus_locale` cookie), read `navigator.languages`:
  - if the preferred language starts with `zh` → redirect to the `/zh-Hans` version of the same path;
  - otherwise stay in English (no redirect).
- after redirecting, write a cookie (one year); afterwards respect manual switching by the user (Docusaurus writes `docusaurus_locale` itself).
- must be SSR-safe (no `window` access at module top level), must not create a redirect loop, and must not drop the hash or query string.
- known path shapes: English `/docs/...`, `/hardware/...`, `/blog/...`; Chinese `/zh-Hans/docs/...`, etc.

#### B. One-time first-visit consent modal

- create `src/theme/Root.tsx` (Docusaurus' official global wrapper point) rendering `<ConsentGate>`; put the component in `src/components/ConsentGate/index.tsx`
- three sections, with language following the current locale (use `useDocusaurusContext().i18n.currentLocale` plus i18n resources available to `src/theme/Root`, or a constant table in `src/i18n/consent.ts`):
  1. **Purpose of the site**: help non-native-English MikroTik users read the official documentation;
  2. **Scope of translation**: only natural language is translated; RouterOS UI, commands, parameters and enumerated values follow the official English;
  3. **Copyright**: documentation and trademarks belong to MikroTik; this mirror is for study purposes only and links back to the official originals.
- two buttons: **「我已了解，继续访问」** (write localStorage + cookie, dismiss) and **「前往官方文档」** (`location.href` to the official URL corresponding to the current page; fall back to `https://manual.mikrotik.com/` if it cannot be derived).
- show only once (per browser, not per language); ESC / clicking the backdrop does not dismiss it (a choice is mandatory); lock scrolling while open and focus the primary button.
- accessibility: `role="dialog"` `aria-modal="true"`, title via `aria-labelledby`, keyboard-operable buttons.

#### C. Source information at the bottom of each page

- swizzle `DocItem/Footer` (`src/theme/DocItem/Footer/index.tsx`; if a directory with that name already exists, extend inside it); docs / archived versions / hardware are docs plugin instances and share that swizzle
- blog / changelog are blog plugin instances, so add a `BlogPostItem/Footer` swizzle too; both call the shared component `src/components/SourceFooter/index.tsx`, so all four page families use the same fields / copy / testids
- English pages show: **official original URL** (front matter `source`) + **capture time** (`captured_at`)
- translated pages additionally show: **translation time**, **provider + model name**
- data comes from front matter, never runtime probing. Three fields must be added to the pipeline:
  - `translated_at`: written by apply/derive with the current time (ISO 8601 with timezone)
  - `translation_provider` / `translation_model`: provider from `config/translation.yml`'s `provider`; model prefers `LLM_MODEL`, falling back to `config/translation.yml`'s `model` when offline and unconfigured
  - edit points: the front matter assembly in `tools/translate/lib/apply.mjs` and `tools/translate/derive.mjs`;
  - note: `translate verify`'s `frontMatterDiff` only compares keys already present in the source file, so new keys will not cause false positives — but run it yourself to confirm.
- presentation: small monospace text, `rel="noopener"`, localised dates (`Intl.DateTimeFormat`), readable in dark mode.

### 2. Assertions (must be added)

Append to `tools/verify/browser-check.mjs`:

1. `locale auto-switch`: in a fresh context (no cookie), set `navigator.language='zh-CN'` and open `/docs/`; the final URL must start with `/zh-Hans/`; with language `en-US` there must be no redirect;
2. `consent gate`: the modal appears on first open; after clicking "continue" it disappears and does not reappear after refresh; the copy changes with locale (Chinese under `/zh-Hans/`);
3. `source footer`: for five fixed pages across docs, versioned_docs, blog, changelog and hardware, both the **official URL** (`[data-testid="source-footer-source"]`) and `<time data-testid="source-footer-captured" datetime>` appear, with `datetime` equal to the corresponding capture manifest's top-level `generated_at` (docs/archives use `upstream/<v>/manifest.json`, the three sections use `data/manifests/{blog,changelog,hardware}.json`); `/zh-Hans/` pages also show translation time and "provider · model".

### 3. Constraints and pitfalls

- do **not** use `[...document.querySelectorAll()]` in `clientModules` (it compiles to `[].concat` and crashes the whole client); use `Array.from(...)`.
- never read `localStorage` during SSR; use the mounted pattern with `useEffect` + `useState` to avoid hydration mismatches.
- redirect with `location.replace` (do not `push` into history) and only once, on "first visit with a language mismatch".
- the modal's `z-index` must be higher than the medium-zoom overlay (`--ifm-z-index-overlay`).
- do not break the existing `DocItem/Footer` previous/next and feedback components.
- artifact check: `build/zh-Hans/.../index.html` should contain markers such as `官方原文` and `翻译时间`; check with `grep -c`.

### 4. Delivery and report

1. commit locally (do not push), `git log --oneline -3`;
2. `npm run build` exit code and the Pagefind page count;
3. output of `node tools/pipeline/verify.mjs --browser` (should be 25 items, 22 + 3 new);
4. three screenshots: Chinese modal, English footer, Chinese footer;
5. one sentence each explaining: the auto-switch decision rule, the cookie name, and how loops are avoided.

### 5. Already done (do not redo)

- hardware model headings backfilled in English (`series` → `系列`), PDFs cached to `static/assets/files`;
- CLI reference tables localised, `verify:cli` green;
- sidebar/pagination labels backfilled, `verify:labels` green.
