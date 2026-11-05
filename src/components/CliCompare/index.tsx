import React, {useEffect, useMemo, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';

type Arg = {name: string; type: string; mandatory?: boolean; description?: string};
type Command = {
  path: string;
  title: string;
  url: string;
  arguments: Arg[];
  flags: Arg[];
  readOnlyArguments: Arg[];
};
type CliData = {version: string; commandCount: number; commands: Record<string, Command>};
type Diff = {
  addedParameters: {command: string; name: string}[];
  removedParameters: {command: string; name: string}[];
  newCommands: string[];
  removedCommands: string[];
  changedCommands: {command: string; added: number; removed: number}[];
};

function argNames(command: Command) {
  return new Set(
    [...command.arguments, ...command.flags, ...command.readOnlyArguments].map((arg) => arg.name),
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

function optionLabel(version: string, count: number) {
  return `RouterOS ${version} · ${count.toLocaleString('en-US')} commands`;
}

function SelectChevron() {
  return (
    <svg className="selectChevron_UQlQ" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="searchIcon_gOn3" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function CliCompare() {
  const dataUrl = useBaseUrl('/cli/current.json');
  const [data, setData] = useState<CliData | null>(null);
  const [fromVersion, setFromVersion] = useState('');
  const [toVersion, setToVersion] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: CliData) => {
        if (cancelled) return;
        setData(payload);
        setFromVersion(payload.version);
        setToVersion(payload.version);
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
    return <div className="root_EuB2" />;
  }

  const filtered = result.changedCommands.filter((item) =>
    item.command.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const hasChanges =
    result.addedParameters.length ||
    result.removedParameters.length ||
    result.newCommands.length ||
    result.removedCommands.length ||
    result.changedCommands.length;

  return (
    <div className="root_EuB2">
      <div className="toolbar_PFPH">
        <label className="field_G8QJ" htmlFor="cli-compare-from">
          <span className="fieldLabel_Iokb">From</span>
          <span className="selectWrap_wiqE">
            <select
              id="cli-compare-from"
              className="select_Kbg9"
              value={fromVersion}
              onChange={(event) => setFromVersion(event.target.value)}>
              <option value={data.version}>{optionLabel(data.version, data.commandCount)}</option>
            </select>
            <SelectChevron />
          </span>
        </label>
        <button
          type="button"
          className="swapBtn_P3vE"
          title="Swap versions"
          aria-label="Swap From and To versions"
          onClick={() => {
            setFromVersion(toVersion);
            setToVersion(fromVersion);
          }}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M2 5h9L8.5 2.5M14 11H5l2.5 2.5"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <label className="field_G8QJ" htmlFor="cli-compare-to">
          <span className="fieldLabel_Iokb">To</span>
          <span className="selectWrap_wiqE">
            <select
              id="cli-compare-to"
              className="select_Kbg9"
              value={toVersion}
              onChange={(event) => setToVersion(event.target.value)}>
              <option value={data.version}>{optionLabel(data.version, data.commandCount)}</option>
            </select>
            <SelectChevron />
          </span>
        </label>
        <label className="field_G8QJ searchField_zQ_9" htmlFor="cli-compare-filter">
          <span className="fieldLabel_Iokb">Filter</span>
          <span className="searchWrap_fent">
            <SearchIcon />
            <input
              id="cli-compare-filter"
              className="searchInput_ZexK"
              placeholder="path, e.g. ip/firewall"
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </span>
        </label>
      </div>

      <div className="stats_c16J">
        <div className="stat_H70o statAdd_e9OD">
          <span className="statValue_KInA">+{result.addedParameters.length}</span>
          <span className="statLabel_CfG4">parameters added</span>
        </div>
        <div className="stat_H70o statRemove_ZPFd">
          <span className="statValue_KInA">−{result.removedParameters.length}</span>
          <span className="statLabel_CfG4">parameters removed</span>
        </div>
        <div className="stat_H70o">
          <span className="statValue_KInA">{result.changedCommands.length}</span>
          <span className="statLabel_CfG4">commands changed</span>
        </div>
        <div className="stat_H70o statAdd_e9OD">
          <span className="statValue_KInA">+{result.newCommands.length}</span>
          <span className="statLabel_CfG4">new commands</span>
        </div>
        <div className="stat_H70o statRemove_ZPFd">
          <span className="statValue_KInA">−{result.removedCommands.length}</span>
          <span className="statLabel_CfG4">commands removed</span>
        </div>
      </div>

      {hasChanges ? (
        <div className="chipsRow_rke_">
          {result.newCommands.length ? (
            <details className="chipsBlock_NSmx">
              <summary className="summaryAdd_XxR4">
                <span className="chevron_UIoq" aria-hidden="true">›</span>
                New commands
                <span className="chipCount_q5DY">{result.newCommands.length}</span>
              </summary>
              <div className="chips_zpAM">
                {result.newCommands.map((command) => (
                  <a className="chip_rQgJ chipLink_TZ7w" href={`/docs/cli-reference${command}`} key={command}>
                    {command}
                  </a>
                ))}
              </div>
            </details>
          ) : null}
          {result.removedCommands.length ? (
            <details className="chipsBlock_NSmx">
              <summary className="summaryRemove_UMTG">
                <span className="chevron_UIoq" aria-hidden="true">›</span>
                Removed commands
                <span className="chipCount_q5DY">{result.removedCommands.length}</span>
              </summary>
              <div className="chips_zpAM">
                {result.removedCommands.map((command) => (
                  <span className="chip_rQgJ" key={command}>{command}</span>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {filtered.length ? (
        <div>
          <h2>Parameter changes <span>{filtered.length} commands</span></h2>
          {filtered.map((item) => (
            <div key={item.command}>
              <code>{item.command}</code>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
