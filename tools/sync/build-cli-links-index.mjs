import fs from 'node:fs';

const current = JSON.parse(
  fs.readFileSync('data/manifests/current-version.json', 'utf8'),
).version;
const versioned = fs.existsSync('versions.json')
  ? JSON.parse(fs.readFileSync('versions.json', 'utf8'))
  : [];
const versions = [...versioned, current].sort((a, b) =>
  a.localeCompare(b, undefined, {numeric: true}),
);

const byVersion = {};
for (const version of versions) {
  const file = `data/manifests/cli-links-${version}.json`;
  if (!fs.existsSync(file)) {
    console.warn(`[cli-links] missing ${file}`);
    continue;
  }
  const key = version === current ? 'current' : version;
  byVersion[key] = JSON.parse(fs.readFileSync(file, 'utf8'));
}

fs.writeFileSync(
  'data/manifests/cli-links.json',
  JSON.stringify(byVersion, null, 2) + '\n',
);
console.log(
  `[cli-links] wrote data/manifests/cli-links.json keys=${Object.keys(byVersion).join(',')}`,
);
