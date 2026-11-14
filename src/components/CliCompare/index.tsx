import React, {useEffect, useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useAssetBaseUrl} from '@site/src/lib/asset-url';
import {compareLabel} from './labels';

type DiffNames = {params: string[]; flags: string[]};
type ChangedCommand = {
  path: string;
  added: DiffNames;
  removed: DiffNames;
};
type ComparePair = {
  changedCommands: ChangedCommand[];
  addedCommands: string[];
  removedCommands: string[];
};
type CompareData = {
  versions: string[];
  commands: Record<string, number>;
  pairs: Record<string, ComparePair>;
};
type ResolvedLink = {url: string; exact: boolean};

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');

function SelectChevron() {
  return (
    <svg
      className="selectChevron_UQlQ"
      viewBox="0 0 16 16"
      aria-hidden="true">
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

function SwapIcon() {
  return (
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
  );
}

function SearchIcon() {
  return (
    <svg
      className="searchIcon_gOn3"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M10.5 10.5L14 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VersionSelect({
  id,
  label,
  value,
  versions,
  commands,
  zh,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  versions: string[];
  commands: Record<string, number>;
  zh: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field_G8QJ" htmlFor={id}>
      <span className="fieldLabel_Iokb">{label}</span>
      <span className="selectWrap_wiqE">
        <select
          id={id}
          className="select_Kbg9"
          value={value}
          onChange={(event) => onChange(event.target.value)}>
          {versions.map((version) => (
            <option value={version} key={version}>
              RouterOS {version} · {commands[version] ?? '?'}{' '}
              {compareLabel('commands', zh)}
            </option>
          ))}
        </select>
        <SelectChevron />
      </span>
    </label>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'add' | 'remove' | 'neutral';
}) {
  const toneClass =
    tone === 'add'
      ? 'statAdd_e9OD'
      : tone === 'remove'
        ? 'statRemove_ZPFd'
        : '';
  return (
    <div className={`stat_H70o ${toneClass}`.trim()}>
      <span className="statValue_KInA">
        {tone === 'add' ? '+' : tone === 'remove' ? '−' : ''}
        {value}
      </span>
      <span className="statLabel_CfG4">{label}</span>
    </div>
  );
}

function DiffLine({
  names,
  sign,
  kind,
  zh,
  page,
  section,
}: {
  names: string[];
  sign: '+' | '−';
  kind: 'parameters' | 'flags';
  zh: boolean;
  page?: ResolvedLink;
  section: string;
}) {
  if (!names.length) return null;
  return (
    <div
      className={`diffLine_hziN ${
        sign === '+' ? 'diffAdd_WPoi' : 'diffRemove_KYro'
      }`}>
      <span className="sign_wADf">{sign}</span>
      <div className="diffContent_oNS4">
        <span className="kind_m0oH">{compareLabel(kind, zh)}</span>
        {names.map((name) => {
          const href = page
            ? page.exact
              ? `${page.url}#${name === 'advertise' ? 'advertise_' : name}`
              : `${page.url}#${section}`
            : undefined;
          return href ? (
            <Link
              to={href}
              className="diffChip_qYMd chipLink_TZ7w"
              key={name}>
              {name}
            </Link>
          ) : (
            <code className="diffChip_qYMd" key={name}>
              {name}
            </code>
          );
        })}
      </div>
    </div>
  );
}

function CommandRow({
  change,
  fromLink,
  toLink,
  zh,
}: {
  change: ChangedCommand;
  fromLink?: ResolvedLink;
  toLink?: ResolvedLink;
  zh: boolean;
}) {
  const added = change.added.params.length + change.added.flags.length;
  const removed = change.removed.params.length + change.removed.flags.length;
  const section = slug(change.path);
  const link = toLink ?? fromLink;
  const href = link
    ? link.exact
      ? link.url
      : `${link.url}#${section}`
    : undefined;

  return (
    <li className="commandRow_Sd0w">
      <div className="rowHeader_lPgh">
        {href ? (
          <Link to={href} className="path_G9dr pathLink_E0dm">
            /{change.path}
          </Link>
        ) : (
          <code className="path_G9dr">/{change.path}</code>
        )}
        <span className="rowCounts_xplj">
          {added > 0 ? (
            <span className="countBadge_N8vL badgeAdd_iBlj">+{added}</span>
          ) : null}
          {removed > 0 ? (
            <span className="countBadge_N8vL badgeRemove_W3hi">−{removed}</span>
          ) : null}
        </span>
      </div>
      <div className="lines_VluA">
        <DiffLine
          names={change.added.params}
          sign="+"
          kind="parameters"
          zh={zh}
          page={toLink}
          section={section}
        />
        <DiffLine
          names={change.added.flags}
          sign="+"
          kind="flags"
          zh={zh}
          page={toLink}
          section={section}
        />
        <DiffLine
          names={change.removed.params}
          sign="−"
          kind="parameters"
          zh={zh}
          page={fromLink}
          section={section}
        />
        <DiffLine
          names={change.removed.flags}
          sign="−"
          kind="flags"
          zh={zh}
          page={fromLink}
          section={section}
        />
      </div>
    </li>
  );
}

function CommandChips({
  paths,
  title,
  tone,
  urlFor,
}: {
  paths: string[];
  title: string;
  tone: 'add' | 'remove';
  urlFor: (path: string) => string | undefined;
}) {
  if (!paths.length) return null;
  return (
    <details className="chipsBlock_NSmx">
      <summary
        className={tone === 'add' ? 'summaryAdd_XxR4' : 'summaryRemove_UMTG'}>
        <span className="chevron_UIoq" aria-hidden="true">
          ›
        </span>
        {title}
        <span className="chipCount_q5DY">{paths.length}</span>
      </summary>
      <div className="chips_zpAM">
        {paths.map((path) => {
          const url = urlFor(path);
          return url ? (
            <Link to={url} className="chip_rQgJ chipLink_TZ7w" key={path}>
              /{path}
            </Link>
          ) : (
            <code className="chip_rQgJ" key={path}>
              /{path}
            </code>
          );
        })}
      </div>
    </details>
  );
}

export default function CliCompare() {
  const {i18n} = useDocusaurusContext();
  const zh = i18n.currentLocale === 'zh-Hans';
  /** English is the key; `labels.ts` supplies the zh-Hans value. */
  const t = (english: string) => compareLabel(english, zh);
  // `cli-compare.json` is a build-root data file, not a route: the locale
  // prefix `useBaseUrl` would add on a zh-Hans page points at a copy that only
  // exists because `static/` is mirrored per locale, so it is resolved against
  // the locale-independent asset root instead.
  const compareUrl = `${useAssetBaseUrl()}cli-compare.json`;
  const [data, setData] = useState<CompareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromVersion, setFromVersion] = useState('');
  const [toVersion, setToVersion] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(compareUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<CompareData>;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        if (payload.versions.length >= 2) {
          setFromVersion(payload.versions[0]);
          setToVersion(payload.versions[payload.versions.length - 1]);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [compareUrl]);

  const pair = useMemo<ComparePair | null>(() => {
    if (!data || !fromVersion || !toVersion || fromVersion === toVersion) {
      return null;
    }
    const direct = data.pairs[`${fromVersion}->${toVersion}`];
    if (direct) return direct;
    const inverse = data.pairs[`${toVersion}->${fromVersion}`];
    if (!inverse) return null;
    return {
      changedCommands: inverse.changedCommands.map((change) => ({
        path: change.path,
        added: change.removed,
        removed: change.added,
      })),
      addedCommands: inverse.removedCommands,
      removedCommands: inverse.addedCommands,
    };
  }, [data, fromVersion, toVersion]);

  const filtered = useMemo(() => {
    if (!pair) return [];
    const query = filter.trim().toLowerCase();
    return query
      ? pair.changedCommands.filter((change) =>
          change.path.toLowerCase().includes(query),
        )
      : pair.changedCommands;
  }, [pair, filter]);

  if (error) {
    return (
      <div className="error_OVSF">
        {t('Could not load')} <code>cli-compare.json</code>
        {zh ? '：' : ': '}
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="notice_FmSW">
        {zh ? '正在加载 CLI 参考版本…' : 'Loading CLI reference versions…'}
      </div>
    );
  }
  if (data.versions.length < 2) {
    return (
      <div className="notice_FmSW">
        {zh
          ? '可对比的 CLI 参考版本不足。'
          : 'Not enough CLI reference versions to compare.'}
      </div>
    );
  }

  const currentVersion = data.versions[data.versions.length - 1];
  const commandHref = (version: string, command: string) => {
    const base =
      version === currentVersion
        ? '/docs/cli-reference'
        : `/docs/${version}/cli-reference`;
    return `${base}/${command}`;
  };
  const resolveLink = (
    version: string,
    command: string,
  ): ResolvedLink | undefined => {
    if (command === 'Headings') return undefined;
    return {url: commandHref(version, command), exact: true};
  };
  const linkFor = (version: string, command: string) => {
    const link = resolveLink(version, command);
    return link
      ? link.exact
        ? link.url
        : `${link.url}#${slug(command)}`
      : undefined;
  };

  const addedParameters = pair
    ? pair.changedCommands.reduce(
        (total, change) =>
          total + change.added.params.length + change.added.flags.length,
        0,
      )
    : 0;
  const removedParameters = pair
    ? pair.changedCommands.reduce(
        (total, change) =>
          total + change.removed.params.length + change.removed.flags.length,
        0,
      )
    : 0;

  return (
    <div className="root_EuB2">
      <div className="toolbar_PFPH">
        <VersionSelect
          id="cli-compare-from"
          label={t('From')}
          value={fromVersion}
          versions={data.versions}
          commands={data.commands}
          zh={zh}
          onChange={setFromVersion}
        />
        <button
          type="button"
          className="swapBtn_P3vE"
          title={t('Swap versions')}
          aria-label={t('Swap From and To versions')}
          onClick={() => {
            setFromVersion(toVersion);
            setToVersion(fromVersion);
          }}>
          <SwapIcon />
        </button>
        <VersionSelect
          id="cli-compare-to"
          label={t('To')}
          value={toVersion}
          versions={data.versions}
          commands={data.commands}
          zh={zh}
          onChange={setToVersion}
        />
        <label
          className="field_G8QJ searchField_zQ_9"
          htmlFor="cli-compare-filter">
          <span className="fieldLabel_Iokb">{t('Filter')}</span>
          <span className="searchWrap_fent">
            <SearchIcon />
            <input
              id="cli-compare-filter"
              className="searchInput_ZexK"
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t('path, e.g. ip/firewall')}
            />
          </span>
        </label>
      </div>

      {pair ? (
        <>
          <div className="stats_c16J">
            <Stat
              value={addedParameters}
              label={t('parameters added')}
              tone="add"
            />
            <Stat
              value={removedParameters}
              label={t('parameters removed')}
              tone="remove"
            />
            <Stat
              value={pair.changedCommands.length}
              label={t('commands changed')}
              tone="neutral"
            />
            <Stat
              value={pair.addedCommands.length}
              label={t('new commands')}
              tone="add"
            />
            <Stat
              value={pair.removedCommands.length}
              label={t('commands removed')}
              tone="remove"
            />
          </div>

          {pair.addedCommands.length > 0 ||
          pair.removedCommands.length > 0 ? (
            <div className="chipsRow_rke_">
              <CommandChips
                paths={pair.addedCommands}
                title={t('New commands')}
                tone="add"
                urlFor={(command) => linkFor(toVersion, command)}
              />
              <CommandChips
                paths={pair.removedCommands}
                title={t('Removed commands')}
                tone="remove"
                urlFor={(command) => linkFor(fromVersion, command)}
              />
            </div>
          ) : null}

          <div className="listHeader_Hahl">
            <h3 className="listTitle_jQDQ">{t('Parameter changes')}</h3>
            <span className="listCount__lmH">
              {filtered.length}
              {filter && filtered.length !== pair.changedCommands.length
                ? zh
                  ? ` / ${pair.changedCommands.length}`
                  : ` of ${pair.changedCommands.length}`
                : ''}{' '}
              {zh
                ? `条${t('commands')}`
                : filtered.length === 1
                  ? 'command'
                  : 'commands'}
            </span>
          </div>

          {filtered.length > 0 ? (
            <ul className="commandList_JIu9">
              {filtered.map((change) => (
                <CommandRow
                  key={change.path}
                  change={change}
                  fromLink={resolveLink(fromVersion, change.path)}
                  toLink={resolveLink(toVersion, change.path)}
                  zh={zh}
                />
              ))}
            </ul>
          ) : (
            <div className="notice_FmSW">
              {zh
                ? `没有参数差异${filter ? '（匹配过滤条件）' : ''}。`
                : `No parameter differences${filter ? ' matching the filter' : ''}.`}
            </div>
          )}
        </>
      ) : (
        <div className="notice_FmSW">
          {t('Select two different versions to compare.')}
        </div>
      )}
    </div>
  );
}
