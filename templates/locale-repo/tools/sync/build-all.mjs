import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const skipExtract = process.argv.includes('--skip-extract');
const only = process.argv.includes('--version')
  ? process.argv[process.argv.indexOf('--version') + 1]
  : null;

const current = JSON.parse(
  fs.readFileSync('data/manifests/current-version.json', 'utf8'),
).version;
const versioned = fs.existsSync('versions.json')
  ? JSON.parse(fs.readFileSync('versions.json', 'utf8'))
  : [];
const versions = [...versioned, current].sort((a, b) =>
  a.localeCompare(b, undefined, {numeric: true}),
);

function run(script, args) {
  execFileSync(process.execPath, [script, ...args], {stdio: 'inherit'});
}

for (const version of versions) {
  if (only && version !== only) continue;
  const docs =
    version === current ? 'docs' : `versioned_docs/version-${version}`;
  const isCurrent = version === current;
  if (!skipExtract) {
    const args = ['--version', version, '--docs', docs];
    // The 7.24 metadata cache predates the versioned layout and is reusable.
    if (version === '7.24' && fs.existsSync('../.work/doc-metadata-cache')) {
      args.push('--cache', '../.work/doc-metadata-cache');
      args.push('--html-cache', '../.work/doc-html');
    }
    run('tools/sync/extract-doc-metadata.mjs', args);
  }
  run('tools/sync/apply-doc-metadata.mjs', ['--version', version, '--docs', docs]);
  run('tools/sync/build-category-metadata.mjs', [
    '--version',
    version,
    '--sidebar',
    isCurrent
      ? 'sidebars.ts'
      : `versioned_sidebars/version-${version}-sidebars.json`,
  ]);
}

if (!only) {
  run('tools/sync/build-cli-links-index.mjs', []);
  run('tools/cli/build-all.mjs', []);
}
console.log('[build-all] done');
