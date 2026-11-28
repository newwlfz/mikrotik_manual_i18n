import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

/**
 * Where the generated CLI data goes.
 *
 * The English site publishes it under `static/cli/` (`/cli/…` is served from
 * the hub). A localized site sets `ASSET_ORIGIN`: it ships no `static/` at all,
 * so writing the files there would recreate the tree this design removes. Put
 * them under `work/` (git-ignored scratch) instead — nothing reads them back in
 * that mode. The one file the site does fetch (`cli-compare.json`) is copied
 * into `build/` by `tools/build/index.mjs`, because `fetch()` needs CORS.
 */
const SHARED_ASSET_ORIGIN = (process.env.ASSET_ORIGIN || '').trim().replace(/\/+$/, '');
const CLI_ASSET_DIR = SHARED_ASSET_ORIGIN ? 'work/cli' : 'static/cli';
const CLI_COMPARE_OUT = SHARED_ASSET_ORIGIN ? 'work/cli/cli-compare.json' : 'static/cli-compare.json';

const current = JSON.parse(
  fs.readFileSync('data/manifests/current-version.json', 'utf8'),
).version;
const versioned = fs.existsSync('versions.json')
  ? JSON.parse(fs.readFileSync('versions.json', 'utf8'))
  : [];
const versions = [...versioned, current].sort((a, b) =>
  a.localeCompare(b, undefined, {numeric: true}),
);

const index = {current, versions: []};
for (const version of versions) {
  const docs =
    version === current ? 'docs' : `versioned_docs/version-${version}`;
  execFileSync(
    process.execPath,
    ['tools/cli/build-cli-data.mjs', '--version', version, '--docs', docs],
    {stdio: 'inherit'},
  );
  const source = `data/cli/${version}/en.json`;
  const payload = JSON.parse(fs.readFileSync(source, 'utf8'));
  fs.mkdirSync(CLI_ASSET_DIR, {recursive: true});
  fs.copyFileSync(source, `${CLI_ASSET_DIR}/${version}.json`);
  index.versions.push({version, count: payload.commandCount});
}

fs.writeFileSync(`${CLI_ASSET_DIR}/index.json`, JSON.stringify(index, null, 2) + '\n');
execFileSync(process.execPath, ['tools/cli/build-compare.mjs'], {
  stdio: 'inherit',
  env: {...process.env, CLI_COMPARE_OUT},
});
fs.copyFileSync(`data/cli/${current}/en.json`, `${CLI_ASSET_DIR}/current.json`);
console.log(
  `[cli] wrote ${CLI_ASSET_DIR}/index.json versions=${index.versions
    .map((entry) => `${entry.version}:${entry.count}`)
    .join(',')}`,
);
