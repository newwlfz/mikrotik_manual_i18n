import fs from 'node:fs';
import path from 'node:path';

const CLI_DIR = 'data/cli';
const OUT = 'static/cli-compare.json';

const versions = fs
  .readdirSync(CLI_DIR, {withFileTypes: true})
  .filter(
    (entry) =>
      entry.isDirectory() &&
      fs.existsSync(path.join(CLI_DIR, entry.name, 'en.json')),
  )
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));

const data = Object.fromEntries(
  versions.map((version) => [
    version,
    JSON.parse(fs.readFileSync(path.join(CLI_DIR, version, 'en.json'), 'utf8')),
  ]),
);

const normalize = (command) => command.replace(/^\/+/, '');
const parameterNames = (command) =>
  [...(command.arguments ?? []), ...(command.readOnlyArguments ?? [])].map(
    (argument) => (typeof argument === 'string' ? argument : argument.name),
  );
const flagNames = (command) =>
  (command.flags ?? []).map((flag) =>
    typeof flag === 'string' ? flag : flag.name,
  );

const commandsOf = (payload) =>
  new Map(
    Object.entries(payload.commands).map(([command, value]) => [
      normalize(command),
      value,
    ]),
  );

const pairs = {};
for (let fromIndex = 0; fromIndex < versions.length; fromIndex += 1) {
  for (let toIndex = fromIndex + 1; toIndex < versions.length; toIndex += 1) {
    const fromVersion = versions[fromIndex];
    const toVersion = versions[toIndex];
    const fromCommands = commandsOf(data[fromVersion]);
    const toCommands = commandsOf(data[toVersion]);

    const addedCommands = [...toCommands.keys()]
      .filter((command) => !fromCommands.has(command))
      .sort();
    const removedCommands = [...fromCommands.keys()]
      .filter((command) => !toCommands.has(command))
      .sort();

    const changedCommands = [];
    for (const [command, toCommand] of toCommands) {
      const fromCommand = fromCommands.get(command);
      if (!fromCommand) continue;

      const fromParams = parameterNames(fromCommand);
      const toParams = parameterNames(toCommand);
      const fromFlags = flagNames(fromCommand);
      const toFlags = flagNames(toCommand);

      const addedParams = toParams.filter((name) => !fromParams.includes(name));
      const addedFlags = toFlags.filter((name) => !fromFlags.includes(name));
      const removedParams = fromParams.filter((name) => !toParams.includes(name));
      const removedFlags = fromFlags.filter((name) => !toFlags.includes(name));

      if (
        addedParams.length ||
        addedFlags.length ||
        removedParams.length ||
        removedFlags.length
      ) {
        changedCommands.push({
          path: command,
          added: {params: addedParams, flags: addedFlags},
          removed: {params: removedParams, flags: removedFlags},
        });
      }
    }

    changedCommands.sort((a, b) => a.path.localeCompare(b.path));
    pairs[`${fromVersion}->${toVersion}`] = {
      changedCommands,
      addedCommands,
      removedCommands,
    };
  }
}

const payload = {
  versions,
  commands: Object.fromEntries(
    versions.map((version) => [version, data[version].commandCount]),
  ),
  pairs,
};

fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, JSON.stringify(payload) + '\n');
console.log(
  `[cli] wrote ${OUT} versions=${versions.join(',')} pairs=${Object.keys(pairs).length}`,
);
