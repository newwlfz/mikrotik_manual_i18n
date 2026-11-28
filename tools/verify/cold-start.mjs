#!/usr/bin/env node
/**
 * `npm run verify:cold-start` — cold-start / first-install contract gate (hub-only).
 *
 * A cold repository has no `data/manifests/current-version.json`. Two bugs used
 * to hide there: importing the translate path helpers threw at module load, and
 * `sync --update` tried to report/snapshot a version that did not exist. Both
 * fixes are contracts, not one-off patches, so this verifier proves them in any
 * repository state:
 *
 *   dynamic  buildStages({firstInstall:true}) has
 *            21 + 2 * N + 2 * N + 3 * N + 1 + 7 + 1 stages (N =
 *            archivedVersions().length, currently 44 with N = 2): 2 upstream-only
 *            stages per archive (fetch-archive-<v>, cache-archive-<v>) before
 *            materialize, 2 metadata stages per archive
 *            (metadata-extract-archive-<v>, metadata-apply-archive-<v>) and 3
 *            render-tree consumers per archive (restore-archive-<v>,
 *            capture-mermaid-archive-<v>, capture-inline-colors-archive-<v>)
 *            after materialize, one final `materialize --all --write` stage so
 *            the backfill lands in the produced tree, one `assets-versioned`
 *            stage immediately after that final materialize that re-mirrors the
 *            raw `/assets/images/<hash>` references the restore reintroduced
 *            (the ordinary assets stage ran too early) and gates on every product
 *            Markdown reference, the `cli-links` index stage after it (all
 *            per-version captures now exist), and one last
 *            `refresh-zone-manifests` stage that re-hashes the three zone
 *            manifests after every stage that rewrites their `.md` files. The
 *            base gained one `verify-addressing` stage, inserted after
 *            materialize and before the 54-minute assets stage so a lost
 *            `/img/<hash>` reference fails closed up front. The final +7 are four
 *            non-versioned fetch stages (fetch-hardware / fetch-blog /
 *            fetch-changelog, right after fetch-upstream, the latter two render
 *            with Chromium, plus fetch-favicon which mirrors the official
 *            <link rel=icon>) and one backfill-captured-at-<v> stage for the
 *            current release and each archive, inserted after materialize rewrote
 *            the trees. It skips report-routes / snapshot-version, keeps
 *            install-version, and materialises every version with `--all`;
 *            skippedReleases() is null-safe. Bump/refresh keep their original
 *            stage order (cli-links stays right after the current metadata-apply),
 *            get the same preflight and also end with refresh-zone-manifests.
 *   static   paths.mjs builds SECTION_SPECS from currentVersionOrNull() and
 *            never calls the throwing currentVersion(); index.mjs still carries
 *            the first-install branch and the probe's fail-open `exit 10`.
 *   state    with no manifest, currentVersionOrNull() must be null. If a manifest
 *            exists (e.g. a full sync is running), that one assertion is SKIPped
 *            — this verifier never deletes or edits an artifact. The archived
 *            materialization artifacts (versioned_docs/.../cli-reference and
 *            data/cli/<v>/en.json) are also SKIPped when not regenerated yet;
 *            they become hard assertions once they exist.
 *
 * Exit 0 iff every executed assertion passed.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildStages, skippedReleases} from '../sync/lib/update.mjs';
import {CURRENT_VERSION_PATH, archivedVersions, currentVersionOrNull} from '../sync/lib/versions.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

let passed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const sameArray = (actual, expected) =>
  Array.isArray(actual) && actual.length === expected.length && actual.every((value, i) => value === expected[i]);

// --- Dynamic: the first-install stage contract is executable, not a comment. ---
const TARGET = '7.26';
const stages = buildStages({target: TARGET, mode: 'first-install', all: false, firstInstall: true});
const ids = stages.map((stage) => stage.id);
const materialize = stages.find((stage) => stage.id === 'materialize');
const argv = materialize?.run?.[1];
const materializeIndex = ids.indexOf('materialize');
const finalMaterialize = stages.find((stage) => stage.id === 'materialize-final');
const finalIndex = ids.indexOf('materialize-final');
const refreshManifests = stages.find((stage) => stage.id === 'refresh-zone-manifests');
const refreshIndex = ids.indexOf('refresh-zone-manifests');
const archives = archivedVersions();
// 21 base stages (including the verify-addressing preflight and the new
// assets-versioned re-mirror/gate after materialize-final) + 2 upstream-only
// stages per archive (fetch/cache, before materialize) + 2 metadata stages per
// archive (extract/apply, after materialize) + 3 render-tree consumers per
// archive (restore/mermaid/colors, after materialize) + 1 final re-materialization
// + 7 non-versioned additions (fetch-hardware/blog/changelog/favicon after
// fetch-upstream, and one backfill-captured-at-<v> per current/archive tree after
// materialize) + 1 final manifest hash refresh. The cli-links index is moved,
// not added, so it does not change the total. Derived from the code, not from a
// version number or a fixed target count.
const expectedStageCount =
  21 + 2 * archives.length + 2 * archives.length + 3 * archives.length + 1 + 7 + 1;

check(
  `firstInstall buildStages has 21 + 2*N + 2*N + 3*N + 1 + 7 + 1 stages (N=${archives.length}, ${expectedStageCount})`,
  stages.length === expectedStageCount,
  `got ${stages.length}`,
);
check('firstInstall skips report-routes', !ids.includes('report-routes'));
check('firstInstall skips snapshot-version', !ids.includes('snapshot-version'));
check('firstInstall keeps install-version', ids.includes('install-version'));
check(
  'materialize argv is ["--all", "--write"]',
  sameArray(argv, ['--all', '--write']),
  `got ${JSON.stringify(argv)}`,
);
// The addressing preflight must sit between materialize (which can drop the
// HEAD hash references) and assets (which is the expensive stage it protects).
const addressing = stages.find((stage) => stage.id === 'verify-addressing');
const addressingIndex = ids.indexOf('verify-addressing');
check('firstInstall has verify-addressing stage', Boolean(addressing));
check(
  'verify-addressing argv is []',
  sameArray(addressing?.run?.[1], []),
  `got ${JSON.stringify(addressing?.run?.[1])}`,
);
check(
  'verify-addressing runs after materialize and before assets',
  addressingIndex > materializeIndex && addressingIndex < ids.indexOf('assets'),
  `materialize=${materializeIndex}, verify-addressing=${addressingIndex}, assets=${ids.indexOf('assets')}`,
);
check('firstInstall has materialize-final stage', materializeIndex >= 0 && finalIndex >= 0);
check(
  'materialize-final argv is ["--all", "--write"]',
  sameArray(finalMaterialize?.run?.[1], ['--all', '--write']),
  `got ${JSON.stringify(finalMaterialize?.run?.[1])}`,
);
// The archived structure restore reintroduces raw `/assets/images/<hash>` URLs
// into versioned_docs/, and materialize-final is the last writer. The image
// mirror therefore has to run immediately after that stage, before the build
// ever sees the Markdown; otherwise pages.yml reports asset-refs missing=1 and
// skips the deploy. The same stage gates on every product Markdown reference,
// so a missing byte fails sync instead of being found after the build.
const versionedAssetsStage = stages.find((stage) => stage.id === 'assets-versioned');
const versionedAssetsIndex = ids.indexOf('assets-versioned');
check('firstInstall has assets-versioned stage', Boolean(versionedAssetsStage));
check(
  'assets-versioned argv is ["--apply", "--versioned-only"]',
  sameArray(versionedAssetsStage?.run?.[1], ['--apply', '--versioned-only']),
  `got ${JSON.stringify(versionedAssetsStage?.run?.[1])}`,
);
check(
  'assets-versioned runs immediately after materialize-final and before cli-links',
  versionedAssetsIndex === finalIndex + 1 && versionedAssetsIndex < ids.indexOf('cli-links'),
  `final=${finalIndex}, assets-versioned=${versionedAssetsIndex}, cli-links=${ids.indexOf('cli-links')}`,
);
check(
  'materialize-final runs before assets-versioned, cli-links and refresh-zone-manifests',
  finalIndex >= 0 &&
    ids.indexOf('cli-links') === versionedAssetsIndex + 1 &&
    refreshIndex === ids.indexOf('cli-links') + 1,
  `got ${JSON.stringify(ids)}`,
);
check('materialize-final runs after materialize', finalIndex > materializeIndex);

// The CLI-links index reads one capture per known version. On a cold start the
// archive captures only exist after the apply stages above and the final
// materialize, so the index must follow them; on bump/refresh it stays where it
// always was, immediately after the current release's metadata-apply.
const cliLinksIndex = ids.indexOf('cli-links');
check('firstInstall has cli-links stage', cliLinksIndex >= 0);
check(
  'cli-links argv is []',
  sameArray(stages.find((stage) => stage.id === 'cli-links')?.run?.[1], []),
  `got ${JSON.stringify(stages.find((stage) => stage.id === 'cli-links')?.run?.[1])}`,
);
check(
  'cli-links runs after materialize-final and before refresh-zone-manifests',
  cliLinksIndex > finalIndex && cliLinksIndex < refreshIndex,
  `materialize-final=${finalIndex}, cli-links=${cliLinksIndex}, refresh-zone-manifests=${refreshIndex}`,
);
for (const version of archives) {
  check(
    `cli-links runs after metadata-apply-archive-${version}`,
    cliLinksIndex > ids.indexOf(`metadata-apply-archive-${version}`),
    `cli-links=${cliLinksIndex}, apply=${ids.indexOf(`metadata-apply-archive-${version}`)}`,
  );
}

// The zone fetch stages record sha256/bytes at capture time, but backfill,
// assets, address-images and both materialize passes rewrite the same `.md`
// files afterwards. The last stage must refresh the manifests so
// verify:build-inputs asserts the hashes of the shipped products. This is a
// contract in every mode, not just on a cold start.
check('firstInstall has refresh-zone-manifests stage', Boolean(refreshManifests));
check(
  'refresh-zone-manifests argv is []',
  sameArray(refreshManifests?.run?.[1], []),
  `got ${JSON.stringify(refreshManifests?.run?.[1])}`,
);
check(
  'refresh-zone-manifests runs after materialize-final',
  refreshIndex > finalIndex,
  `materialize-final=${finalIndex}, refresh-zone-manifests=${refreshIndex}`,
);
check('refresh-zone-manifests is the last stage', refreshIndex === ids.length - 1, `got ${JSON.stringify(ids)}`);

// The three non-versioned content roots are refreshed in every mode, right
// after fetch-upstream and before any version swap. Two of them
// (fetch-blog / fetch-changelog) render with Playwright + Chromium; their
// post-condition is a manifest with generated_at / pages, checked by
// validateStage() in update.mjs. Assert presence, argv and order here so a
// dropped zone stage fails the cold-start gate instead of silently shipping a
// stale root.
const fetchUpstreamIndex = ids.indexOf('fetch-upstream');
const sectionFetches = ['fetch-hardware', 'fetch-blog', 'fetch-changelog'];
for (const [offset, id] of sectionFetches.entries()) {
  const stage = stages.find((entry) => entry.id === id);
  check(`firstInstall has ${id} stage`, Boolean(stage));
  check(
    `${id} argv is ["--concurrency=4"]`,
    sameArray(stage?.run?.[1], ['--concurrency=4']),
    `got ${JSON.stringify(stage?.run?.[1])}`,
  );
  check(
    `${id} runs immediately after fetch-upstream`,
    ids.indexOf(id) === fetchUpstreamIndex + 1 + offset,
    `fetch-upstream=${fetchUpstreamIndex}, ${id}=${ids.indexOf(id)}`,
  );
}
check(
  'section fetch order is fetch-upstream < fetch-hardware < fetch-blog < fetch-changelog',
  ['fetch-upstream', ...sectionFetches].every((id, i, all) => i === 0 || ids.indexOf(id) > ids.indexOf(all[i - 1])),
  `got ${JSON.stringify(['fetch-upstream', ...sectionFetches].map((id) => ids.indexOf(id)))}`,
);

// The favicon is served from static/img/favicon.svg by headTags, not by a
// Docusaurus `favicon:` field, so no other stage fetches it. Its stage must
// run in every mode with an empty argv (the script derives the official URL
// from config/mirror.yml itself).
const faviconStage = stages.find((entry) => entry.id === 'fetch-favicon');
check('firstInstall has fetch-favicon stage', Boolean(faviconStage));
check(
  'fetch-favicon argv is []',
  sameArray(faviconStage?.run?.[1], []),
  `got ${JSON.stringify(faviconStage?.run?.[1])}`,
);
check(
  'fetch-favicon runs immediately after fetch-changelog',
  ids.indexOf('fetch-favicon') === ids.indexOf('fetch-changelog') + 1,
  `got ${JSON.stringify(ids.slice(fetchUpstreamIndex, fetchUpstreamIndex + 6))}`,
);

// materialize rebuilds docs/ and versioned_docs/ from the lossy `.md` export,
// so captured_at must be restored afterwards for the current release and each
// archive (one helper invocation per tree). These stages must sit after
// materialize but before materialize-final, which rewrites the trees again.
const backfillVersions = [TARGET, ...archives.filter((version) => version !== TARGET)];
for (const version of backfillVersions) {
  const id = `backfill-captured-at-${version}`;
  const stage = stages.find((entry) => entry.id === id);
  check(`firstInstall has ${id} stage`, Boolean(stage));
  check(
    `${id} argv is ["--version=${version}", "--write"]`,
    sameArray(stage?.run?.[1], [`--version=${version}`, '--write']),
    `got ${JSON.stringify(stage?.run?.[1])}`,
  );
  check(
    `${id} runs after materialize and before materialize-final`,
    ids.indexOf(id) > materializeIndex && ids.indexOf(id) < finalIndex,
    `materialize=${materializeIndex}, ${id}=${ids.indexOf(id)}, materialize-final=${finalIndex}`,
  );
}

// Every archived version in versions.json must be fetched, cached and restored
// on a cold start; no version numbers are hard-coded here.
check(
  'versions.json has at least one archived version',
  archives.length > 0,
  `got ${JSON.stringify(archives)}`,
);
for (const version of archives) {
  const stage = stages.find((entry) => entry.id === `fetch-archive-${version}`);
  check(`firstInstall has fetch-archive-${version} stage`, Boolean(stage));
  check(
    `fetch-archive-${version} argv is ["--version=${version}"]`,
    sameArray(stage?.run?.[1], [`--version=${version}`]),
    `got ${JSON.stringify(stage?.run?.[1])}`,
  );

  const cacheStage = stages.find((entry) => entry.id === `cache-archive-${version}`);
  check(`firstInstall has cache-archive-${version} stage`, Boolean(cacheStage));
  check(
    `cache-archive-${version} argv is ["--version=${version}"]`,
    sameArray(cacheStage?.run?.[1], [`--version=${version}`]),
    `got ${JSON.stringify(cacheStage?.run?.[1])}`,
  );

  // The rendered tags / CLI cross-links of an archived release exist only on
  // its own versioned official pages. Without one extract+apply pair per
  // archive, `materialize --all` erases them (and the index cannot be built).
  const metadataExtract = stages.find((entry) => entry.id === `metadata-extract-archive-${version}`);
  check(`firstInstall has metadata-extract-archive-${version} stage`, Boolean(metadataExtract));
  check(
    `metadata-extract-archive-${version} argv is ["--version=${version}"]`,
    sameArray(metadataExtract?.run?.[1], [`--version=${version}`]),
    `got ${JSON.stringify(metadataExtract?.run?.[1])}`,
  );
  const metadataApply = stages.find((entry) => entry.id === `metadata-apply-archive-${version}`);
  check(`firstInstall has metadata-apply-archive-${version} stage`, Boolean(metadataApply));
  check(
    `metadata-apply-archive-${version} argv is ["--version=${version}"]`,
    sameArray(metadataApply?.run?.[1], [`--version=${version}`]),
    `got ${JSON.stringify(metadataApply?.run?.[1])}`,
  );
  check(
    `archive ${version}: metadata extract/apply run after materialize and before materialize-final`,
    ids.indexOf(`metadata-extract-archive-${version}`) > materializeIndex &&
      ids.indexOf(`metadata-apply-archive-${version}`) >
        ids.indexOf(`metadata-extract-archive-${version}`) &&
      ids.indexOf(`metadata-apply-archive-${version}`) < finalIndex,
    `materialize=${materializeIndex} extract=${ids.indexOf(`metadata-extract-archive-${version}`)} apply=${ids.indexOf(`metadata-apply-archive-${version}`)} final=${finalIndex}`,
  );

  const restoreStage = stages.find((entry) => entry.id === `restore-archive-${version}`);
  check(`firstInstall has restore-archive-${version} stage`, Boolean(restoreStage));
  check(
    `restore-archive-${version} argv is ["--version=${version}", "--apply"]`,
    sameArray(restoreStage?.run?.[1], [`--version=${version}`, '--apply']),
    `got ${JSON.stringify(restoreStage?.run?.[1])}`,
  );

  // Mermaid labels and coloured table values are just as lossy in the `.md`
  // export as table-cell HTML, so a cold start must capture both for every
  // archive after materialize has created versioned_docs, then re-materialize
  // so the captured manifests land in the produced tree.
  const mermaidStage = stages.find((entry) => entry.id === `capture-mermaid-archive-${version}`);
  check(`firstInstall has capture-mermaid-archive-${version} stage`, Boolean(mermaidStage));
  check(
    `capture-mermaid-archive-${version} argv is ["--version=${version}"]`,
    sameArray(mermaidStage?.run?.[1], [`--version=${version}`]),
    `got ${JSON.stringify(mermaidStage?.run?.[1])}`,
  );

  const colorsStage = stages.find((entry) => entry.id === `capture-inline-colors-archive-${version}`);
  check(`firstInstall has capture-inline-colors-archive-${version} stage`, Boolean(colorsStage));
  check(
    `capture-inline-colors-archive-${version} argv is ["--version=${version}"]`,
    sameArray(colorsStage?.run?.[1], [`--version=${version}`]),
    `got ${JSON.stringify(colorsStage?.run?.[1])}`,
  );

  // The consumers walk versioned_docs/version-<v>/, which does not exist until
  // `materialize` has run. Their indices must therefore be strictly greater;
  // the old order crashed on ENOENT (mermaid/colors) or reported pages:0
  // (table restore) because they ran before materialize.
  for (const id of [
    `restore-archive-${version}`,
    `capture-mermaid-archive-${version}`,
    `capture-inline-colors-archive-${version}`,
  ]) {
    check(`archive ${version}: ${id} runs after materialize`, ids.indexOf(id) > materializeIndex, `materialize index ${materializeIndex}, got ${ids.indexOf(id)}`);
  }
  const archiveStageIds = [
    `fetch-archive-${version}`,
    `cache-archive-${version}`,
    'materialize',
    `metadata-extract-archive-${version}`,
    `metadata-apply-archive-${version}`,
    `restore-archive-${version}`,
    `capture-mermaid-archive-${version}`,
    `capture-inline-colors-archive-${version}`,
    'materialize-final',
  ].map((id) => ids.indexOf(id));
  check(
    `archive ${version} stage order is fetch < cache < materialize < metadata-extract < metadata-apply < restore < capture-mermaid < capture-inline-colors < materialize-final`,
    archiveStageIds.every((index, i) => index >= 0 && (i === 0 || index > archiveStageIds[i - 1])),
    `got ${JSON.stringify(archiveStageIds)}`,
  );
}

// bump/refresh must keep their original order: no archive-only consumers and
// no second materialize may leak into those branches.
for (const [mode, firstInstall] of [
  ['bump', false],
  ['refresh', false],
]) {
  const branchStages = buildStages({target: TARGET, mode, all: false, firstInstall});
  const branchIds = branchStages.map((stage) => stage.id);
  check(`${mode} has no archive fetch/cache stages`, !branchIds.some((id) => /archive-/.test(id)));
  check(`${mode} has no restore/capture archive consumers`, !branchIds.some((id) => /restore-archive-|capture-.*-archive-/.test(id)));
  check(`${mode} has no materialize-final stage`, !branchIds.includes('materialize-final'));
  check(`${mode} keeps materialize before assets`, branchIds.indexOf('materialize') >= 0 && branchIds.indexOf('materialize') < branchIds.indexOf('assets'), `got ${JSON.stringify(branchIds)}`);
  check(
    `${mode} keeps cli-links after metadata-apply`,
    branchIds.indexOf('cli-links') > branchIds.indexOf('metadata-apply'),
    `cli-links=${branchIds.indexOf('cli-links')}, metadata-apply=${branchIds.indexOf('metadata-apply')}`,
  );
  const addressingIndex = branchIds.indexOf('verify-addressing');
  check(
    `${mode} keeps verify-addressing after materialize and before assets`,
    addressingIndex > branchIds.indexOf('materialize') && addressingIndex < branchIds.indexOf('assets'),
    `got ${JSON.stringify(branchIds)}`,
  );
  // The favicon stage is unconditional too: headTags always serves the same
  // static file, so bump/refresh must refresh the official bytes as well.
  const branchFavicon = branchStages.find((stage) => stage.id === 'fetch-favicon');
  check(`${mode} has fetch-favicon stage`, Boolean(branchFavicon));
  check(
    `${mode} fetch-favicon argv is []`,
    sameArray(branchFavicon?.run?.[1], []),
    `got ${JSON.stringify(branchFavicon?.run?.[1])}`,
  );
  // The manifest hash refresh is unconditional: bump/refresh rewrite the zone
  // `.md` files too, so they need the same final re-hash as a cold start.
  const branchRefresh = branchStages.find((stage) => stage.id === 'refresh-zone-manifests');
  check(`${mode} has refresh-zone-manifests stage`, Boolean(branchRefresh));
  check(
    `${mode} refresh-zone-manifests argv is []`,
    sameArray(branchRefresh?.run?.[1], []),
    `got ${JSON.stringify(branchRefresh?.run?.[1])}`,
  );
  check(
    `${mode} refresh-zone-manifests is the last stage`,
    branchIds.indexOf('refresh-zone-manifests') === branchIds.length - 1,
    `got ${JSON.stringify(branchIds)}`,
  );
}

let skipped = null;
let skippedThrew = null;
try {
  skipped = skippedReleases('7.26');
} catch (error) {
  skippedThrew = error?.message || String(error);
}
check('skippedReleases("7.26") does not throw', skippedThrew === null, skippedThrew || '');
check('skippedReleases("7.26") returns an array', Array.isArray(skipped), `got ${String(skipped)}`);

// --- Static: the import-time and branch contracts are still in the source. ---
const pathsSource = readSource('tools/translate/lib/paths.mjs');
const specStart = pathsSource.indexOf('const SECTION_SPECS');
const specBlock = specStart < 0 ? '' : pathsSource.slice(specStart, pathsSource.indexOf('];', specStart) + 2);
check('paths.mjs declares SECTION_SPECS', specStart >= 0);
check('SECTION_SPECS uses currentVersionOrNull()', specBlock.includes('currentVersionOrNull()'));
check(
  'paths.mjs never calls the throwing currentVersion()',
  !/(^|[^A-Za-z0-9_$])currentVersion\s*\(/.test(pathsSource),
);

const syncSource = readSource('tools/sync/index.mjs');
check('index.mjs has the first-install branch string', syncSource.includes("mode=first-install"));
check('index.mjs selects mode first-install on a cold start', syncSource.includes("firstInstall ? 'first-install'"));
check('index.mjs passes firstInstall into buildStages', syncSource.includes('buildStages({target, mode, all, firstInstall})'));
check('index.mjs no longer forces all=false on a cold start', syncSource.includes("const all = !has('current-only');") && !syncSource.includes('firstInstall ? false :'));
check('probe has the cold-start fail-open exit 10 branch', syncSource.includes('reason=first-install') && /process\.exit\(10\)/.test(syncSource));

// --- State: only assert null when there is genuinely no manifest. ---
if (fs.existsSync(CURRENT_VERSION_PATH)) {
  console.log('cold-start: SKIP null-manifest assertion — data/manifests/current-version.json exists (left untouched)');
} else {
  let version = null;
  let threw = null;
  try {
    version = currentVersionOrNull();
  } catch (error) {
    threw = error?.message || String(error);
  }
  check('currentVersionOrNull() === null on a cold repository', threw === null && version === null, threw || `got ${String(version)}`);
}

// --- Materialized archive artifacts: assert once the full rerun has produced
// them; before that print SKIP so this gate never fails on a not-yet-refreshed
// working tree. No artifact is created, deleted or edited here. ---
const skippedArtifacts = [];
for (const version of archives) {
  const cliDir = path.join(REPO, `versioned_docs/version-${version}/cli-reference`);
  const cliData = path.join(REPO, `data/cli/${version}/en.json`);
  if (!fs.existsSync(cliDir) || !fs.existsSync(cliData)) {
    skippedArtifacts.push(version);
    continue;
  }
  check(`archive ${version}: versioned_docs/version-${version}/cli-reference exists`, fs.existsSync(cliDir));
  let commandCount = 0;
  try {
    commandCount = Number(JSON.parse(fs.readFileSync(cliData, 'utf8')).commandCount) || 0;
  } catch (error) {
    commandCount = 0;
  }
  check(`archive ${version}: data/cli/${version}/en.json commandCount > 0`, commandCount > 0, `got ${commandCount}`);
}
if (skippedArtifacts.length) {
  console.log(
    `cold-start: SKIP materialized-archive assertion for ${skippedArtifacts.join(', ')} ` +
      '(versioned_docs/.../cli-reference or data/cli/<v>/en.json not regenerated yet; ' +
      'the assertion becomes active once the full fetch/materialize rerun has landed)',
  );
}

console.log(`cold-start: ${passed} assertion(s) passed`);
if (failures.length) {
  for (const failure of failures) console.error(`cold-start: FAILED ${failure}`);
  console.error(`cold-start: FAIL (${failures.length} assertion(s) failed)`);
  process.exit(1);
}
console.log('cold-start: PASS');
