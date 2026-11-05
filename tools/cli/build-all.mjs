import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

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
  fs.mkdirSync('static/cli', {recursive: true});
  fs.copyFileSync(source, `static/cli/${version}.json`);
  index.versions.push({version, count: payload.commandCount});
}

fs.writeFileSync('static/cli/index.json', JSON.stringify(index, null, 2) + '\n');
execFileSync(process.execPath, ['tools/cli/build-compare.mjs'], {stdio: 'inherit'});
fs.copyFileSync(`data/cli/${current}/en.json`, 'static/cli/current.json');
console.log(
  `[cli] wrote static/cli/index.json versions=${index.versions
    .map((entry) => `${entry.version}:${entry.count}`)
    .join(',')}`,
);
