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
type VersionInfo = {version: string; count: number};
type CliIndex = {current: string; versions: VersionInfo[]};
type DiffKind = 'param' | 'flag';
type DiffItem = {command: string; name: string; kind: DiffKind};
type Diff = {
  addedParameters: DiffItem[];
  removedParameters: DiffItem[];
  newCommands: string[];
  removedCommands: string[];
  changedCommands: {command: string; added: number; removed: number}[];
};

const EMPTY_DIFF: Diff = {
  addedParameters: [],
  removedParameters: [],
  newCommands: [],
  removedCommands: [],
  changedCommands: [],
};

function namesOf(command: Command, kind: DiffKind) {
  const list =
    kind === 'flag'
      ? command.flags
      : [...command.arguments, ...command.readOnlyArguments];
  return new Set(list.map((arg) => arg.name));
}

function diff(from: CliData, to: CliData): Diff {
  const addedParameters: Diff['addedParameters'] = [];
  const removedParameters: Diff['removedParameters'] = [];
  const changedCommands: Diff['changedCommands'] = [];
  const fromNames = new Set(Object.keys(from.commands));
  const toNames = new Set(Object.keys(to.commands));
  const newCommands = Array.from(toNames).filter((name) => !fromNames.has(name));
  const removedCommands = Array.from(fromNames).filter((name) => !toNames.has(name));
  for (const name of Array.from(fromNames).filter((n) => toNames.has(n))) {
    let addedCount = 0;
    let removedCount = 0;
    for (const kind of ['param', 'flag'] as const) {
      const before = namesOf(from.commands[name], kind);
      const after = namesOf(to.commands[name], kind);
      const added = Array.from(after).filter((arg) => !before.has(arg));
      const removed = Array.from(before).filter((arg) => !after.has(arg));
      added.forEach((arg) => addedParameters.push({command: name, name: arg, kind}));
      removed.forEach((arg) => removedParameters.push({command: name, name: arg, kind}));
      addedCount += added.length;
      removedCount += removed.length;
    }
    if (addedCount || removedCount) {
      changedCommands.push({command: name, added: addedCount, removed: removedCount});
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
  const cliBase = useBaseUrl('/cli/');
  const [index, setIndex] = useState<CliIndex | null>(null);
  const [data, setData] = useState<Record<string, CliData>>({});
  const [fromVersion, setFromVersion] = useState('');
  const [toVersion, setToVersion] = useState('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${cliBase}index.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: CliIndex) => {
        if (cancelled) return;
        setIndex(payload);
        const versions = payload.versions.map((entry) => entry.version);
        const previous = versions.filter((version) => version !== payload.current).at(-1);
        setFromVersion(previous ?? payload.current);
        setToVersion(payload.current);
      })
      .catch((cause) => {
        if (!cancelled) setError(String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [cliBase]);

  useEffect(() => {
    if (!index) return;
    const missing = [fromVersion, toVersion].filter(
      (version) => version && !data[version],
    );
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (version) => {
        const response = await fetch(`${cliBase}${version}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return [version, (await response.json()) as CliData] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) setData((previous) => ({...previous, ...Object.fromEntries(entries)}));
      })
      .catch((cause) => {
        if (!cancelled) setError(String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [index, fromVersion, toVersion, cliBase, data]);

  const from = data[fromVersion];
  const to = data[toVersion];
  const result = useMemo(() => {
    if (!from || !to) return null;
    if (fromVersion === toVersion) return EMPTY_DIFF;
    return diff(from, to);
  }, [from, to, fromVersion, toVersion]);

  if (error) {
    return <div className="root_EuB2">CLI data unavailable: {error}</div>;
  }
  if (!index || !result) {
    return <div className="root_EuB2" />;
  }

  const versions = index.versions;
  const filtered = result.changedCommands.filter((item) =>
    item.command.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const hasChanges =
    result.addedParameters.length ||
    result.removedParameters.length ||
    result.newCommands.length ||
    result.removedCommands.length ||
    result.changedCommands.length;

  const commandHref = (version: string, command: string) => {
    const base =
      version === index.current
        ? '/docs/cli-reference'
        : `/docs/${version}/cli-reference`;
    return `${base}${command}`;
  };

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
              {versions.map((entry) => (
                <option value={entry.version} key={entry.version}>
                  {optionLabel(entry.version, entry.count)}
                </option>
              ))}
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
              {versions.map((entry) => (
                <option value={entry.version} key={entry.version}>
                  {optionLabel(entry.version, entry.count)}
                </option>
              ))}
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
                  <a
                    className="chip_rQgJ chipLink_TZ7w"
                    href={commandHref(toVersion, command)}
                    key={command}>
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
        <section>
          <div className="listHeader_Hahl">
            <h2 className="listTitle_jQDQ">Parameter changes</h2>
            <span className="listCount__lmH">{filtered.length} commands</span>
          </div>
          <ul className="commandList_JIu9">
            {filtered.map((item) => {
              const added = result.addedParameters.filter(
                (parameter) => parameter.command === item.command,
              );
              const removed = result.removedParameters.filter(
                (parameter) => parameter.command === item.command,
              );
              const groups: {kind: DiffKind; sign: '+' | '−'; items: DiffItem[]; add: boolean}[] = [
                {kind: 'param', sign: '+', items: added.filter((p) => p.kind === 'param'), add: true},
                {kind: 'flag', sign: '+', items: added.filter((p) => p.kind === 'flag'), add: true},
                {kind: 'param', sign: '−', items: removed.filter((p) => p.kind === 'param'), add: false},
                {kind: 'flag', sign: '−', items: removed.filter((p) => p.kind === 'flag'), add: false},
              ];
              return (
                <li className="commandRow_Sd0w" key={item.command}>
                  <div className="rowHeader_lPgh">
                    <a
                      className="path_G9dr pathLink_E0dm"
                      href={commandHref(toVersion, item.command)}>
                      {item.command}
                    </a>
                    <div className="rowCounts_xplj">
                      {added.length ? (
                        <span className="countBadge_N8vL badgeAdd_iBlj">+{added.length}</span>
                      ) : null}
                      {removed.length ? (
                        <span className="countBadge_N8vL badgeRemove_W3hi">−{removed.length}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="lines_VluA">
                    {groups
                      .filter((group) => group.items.length)
                      .map((group) => (
                        <div
                          className={`diffLine_hziN ${
                            group.add ? 'diffAdd_WPoi' : 'diffRemove_KYro'
                          }`}
                          key={`${group.kind}-${group.sign}`}>
                          <span className="sign_wADf">{group.sign}</span>
                          <div className="diffContent_oNS4">
                            <span className="kind_m0oH">{group.kind === 'param' ? 'parameters' : 'flags'}</span>
                            {group.items.map((parameter) => (
                              <span className="diffChip_qYMd" key={parameter.name}>
                                {parameter.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
