import React, {useEffect, useMemo, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';

type Arg = {
  name: string;
  type: string;
  mandatory?: boolean;
  description?: string;
};

type Command = {
  path: string;
  title: string;
  url: string;
  arguments: Arg[];
  flags: Arg[];
  readOnlyArguments: Arg[];
};

type CliData = {
  version: string;
  commandCount: number;
  commands: Record<string, Command>;
};

type Diff = {
  addedParameters: {command: string; name: string}[];
  removedParameters: {command: string; name: string}[];
  newCommands: string[];
  removedCommands: string[];
  changedCommands: {command: string; added: number; removed: number}[];
};

function argNames(command: Command) {
  return new Set(
    [...command.arguments, ...command.flags, ...command.readOnlyArguments].map(
      (arg) => arg.name,
    ),
  );
}

function diff(from: CliData, to: CliData): Diff {
  const addedParameters: Diff['addedParameters'] = [];
  const removedParameters: Diff['removedParameters'] = [];
  const changedCommands: Diff['changedCommands'] = [];
  const fromNames = new Set(Object.keys(from.commands));
  const toNames = new Set(Object.keys(to.commands));
  const newCommands = [...toNames].filter((name) => !fromNames.has(name));
  const removedCommands = [...fromNames].filter((name) => !toNames.has(name));
  for (const name of [...fromNames].filter((n) => toNames.has(n))) {
    const before = argNames(from.commands[name]);
    const after = argNames(to.commands[name]);
    const added = [...after].filter((arg) => !before.has(arg));
    const removed = [...before].filter((arg) => !after.has(arg));
    added.forEach((arg) => addedParameters.push({command: name, name: arg}));
    removed.forEach((arg) => removedParameters.push({command: name, name: arg}));
    if (added.length || removed.length) {
      changedCommands.push({command: name, added: added.length, removed: removed.length});
    }
  }
  changedCommands.sort((a, b) => b.added + b.removed - (a.added + a.removed));
  return {addedParameters, removedParameters, newCommands, removedCommands, changedCommands};
}

function Option({version, count}: {version: string; count: number}) {
  return `RouterOS ${version} · ${count.toLocaleString('en-US')} commands`;
}

export default function CliCompare() {
  const dataUrl = useBaseUrl('/cli/7.24.json');
  const [data, setData] = useState<CliData | null>(null);
  const [fromVersion, setFromVersion] = useState('7.24');
  const [toVersion, setToVersion] = useState('7.24');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: CliData) => {
        if (!cancelled) setData(payload);
      })
      .catch((error) => console.error('CLI data unavailable', error));
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  const result = useMemo(() => {
    if (!data) return null;
    if (fromVersion === toVersion) {
      return {
        addedParameters: [],
        removedParameters: [],
        newCommands: [],
        removedCommands: [],
        changedCommands: [],
      };
    }
    return diff(data, data);
  }, [data, fromVersion, toVersion]);

  if (!data || !result) {
    return <div className="cli-compare__notice">Loading CLI reference versions…</div>;
  }

  const filtered = result.changedCommands.filter((item) =>
    item.command.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="cli-compare">
      <div className="cli-compare__selectors">
        <label>
          <span>From</span>
          <select value={fromVersion} onChange={(event) => setFromVersion(event.target.value)}>
            <option value="7.24">{Option({version: '7.24', count: data.commandCount})}</option>
          </select>
        </label>
        <label>
          <span>To</span>
          <select value={toVersion} onChange={(event) => setToVersion(event.target.value)}>
            <option value="7.24">{Option({version: '7.24', count: data.commandCount})}</option>
          </select>
        </label>
        <label>
          <span>Filter</span>
          <input
            type="search"
            value={filter}
            placeholder="Filter commands…"
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
      </div>

      <div className="cli-compare__stats">
        <div><strong>+{result.addedParameters.length}</strong><span>PARAMETERS ADDED</span></div>
        <div><strong>−{result.removedParameters.length}</strong><span>PARAMETERS REMOVED</span></div>
        <div><strong>{result.changedCommands.length}</strong><span>COMMANDS CHANGED</span></div>
        <div><strong>+{result.newCommands.length}</strong><span>NEW COMMANDS</span></div>
        <div><strong>−{result.removedCommands.length}</strong><span>COMMANDS REMOVED</span></div>
      </div>

      <p className="cli-compare__hint">
        Only RouterOS {data.version} is available in this phase; comparing it with itself
        correctly reports zero differences.
      </p>

      {filtered.length === 0 ? (
        <p className="cli-compare__empty">No parameter changes for the selected versions.</p>
      ) : (
        <div className="cli-compare__changes">
          <h2>Parameter changes <span>{filtered.length} commands</span></h2>
          {filtered.map((item) => (
            <div className="cli-compare__command" key={item.command}>
              <code>{item.command}</code>
              <span>{item.added ? `+${item.added}` : ''} {item.removed ? `−${item.removed}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
