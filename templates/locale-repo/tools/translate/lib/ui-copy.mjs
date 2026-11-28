/**
 * "Does this label still need translating?"
 *
 * One predicate, two callers:
 *
 *   - `tools/translate/ui-strings.mjs` (`npm run translate:ui`) asks it about the
 *     Docusaurus UI catalogues: navbar entries, sidebar categories, theme
 *     strings;
 *   - `tools/translate/lib/labels.mjs` asks it about a page's front-matter
 *     `sidebar_label`, so a label the sidebar renders is queued and counted the
 *     same way a UI string is.
 *
 * Keeping the rule here is what makes the two agree. A label copied from the
 * English source is shown by the sidebar verbatim (`frontMatter.sidebar_label`
 * beats the translated catalogue), so the decision "translated" / "kept English
 * on purpose" / "still English" must not be made twice with two different
 * regexes.
 *
 * A label is *not* English prose when any of these holds:
 *
 *   - it already carries target-script characters;
 *   - it has no letters outside its `{placeholders}` (numbers, punctuation);
 *   - it is an identifier: no lowercase at all (`CMR`, `802.11`, `5G`);
 *   - it is a command/menu token: no capital and no space (`scrub-cancel`);
 *   - it is a technical spec: every remaining word carries a digit or is an
 *     all-capitals token or a unit (`60 GHz (W60G)`, `Wi-Fi 6 / 7 (802.11ax/be)`);
 *   - it is a whitelisted proper noun, or a glossary term whose English form is
 *     the agreed wording.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {REPO} from './paths.mjs';

/**
 * Han/Kana. A value that has any of it is already localized.
 *
 * The fullwidth-ASCII block (U+FF00-U+FFEF) is deliberately *not* here: it holds
 * `（）`, `：` and the fullwidth letters, which also appear in labels that are
 * still English (`Container - Matrix（Synapse）`). Treating that punctuation as
 * "translated" made such a label invisible to the planner and to the landing
 * pass, so it could stay English forever without a warning.
 */
export const LOCALIZED_SCRIPT =
  /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/**
 * Names that stay English in every locale: brands, product lines, protocol and
 * file-system identifiers. They are not only allowed to stay English — writing
 * a translation would make the UI unsearchable.
 *
 * Matching is case-insensitive and whitespace-normalized, so `LoRa`/`Lora` and
 * `IPsec`/`IPSEC` are the same entry here. Extend this list instead of adding a
 * one-off exception in a repo.
 */
export const PROPER_NOUNS = [
  'MikroTik',
  'MikroTik.com',
  'MikroTik Cloud',
  'RouterOS',
  'RouterBOARD',
  'WinBox',
  'WebFig',
  'SwOS',
  'CAPsMAN',
  'Netinstall',
  'Netwatch',
  'CHR',
  'CMR',
  'CRS',
  'CSS',
  'GPEN',
  'KNOT',
  'hAP',
  'wAP',
  'SXT',
  'LHG',
  'mANT',
  'DISC',
  'Chateau',
  'Audience',
  'RB',
  'API',
  'CLI',
  'GUI',
  'SSH',
  'FTP',
  'TFTP',
  'SFTP',
  'HTTP',
  'HTTPS',
  'SNMP',
  'NTP',
  'DNS',
  'DHCP',
  'DHCPv6',
  'IPv4',
  'IPv6',
  'VLAN',
  'VPN',
  'IPsec',
  'IKEv2',
  'L2TP',
  'PPPoE',
  'PPTP',
  'SSTP',
  'OVPN',
  'OpenVPN',
  'WireGuard',
  'ZeroTier',
  'BGP',
  'OSPF',
  'MPLS',
  'VPLS',
  'LDP',
  'RSVP',
  'IGMP',
  'MLD',
  'PIM',
  'BFD',
  'VRRP',
  'QoS',
  'HTB',
  'PCQ',
  'NAT',
  'MAC',
  'STP',
  'RSTP',
  'MSTP',
  'HWMP',
  'MESH',
  'MQTT',
  'Syslog',
  'CEF',
  'NetFlow',
  'DDoS',
  'LLDP',
  'CDP',
  'MNDP',
  'SMS',
  'GPS',
  'GNSS',
  'LTE',
  '5G',
  'Wi-Fi',
  'WiFi',
  'W60G',
  '802.11',
  '802.11 a/b/g/n',
  'LoRa',
  'LoRaWAN',
  'Bluetooth',
  'BLE',
  'GPIO',
  'USB',
  'PoE',
  'PoE-Out',
  'SFP',
  'SFP+',
  'S+RJ10',
  'RAID',
  'Btrfs',
  'SED',
  'DLNA',
  'Tmpfs',
  'Ramdisk',
  'Docker',
  'Discord',
  'AWS',
  'Azure',
  'Elasticsearch',
  'ThingsBoard',
  'Home Assistant',
  'HomeAssistant',
  'Proxmox',
  'VMware',
  'ESXi',
  'Hyper-V',
  'VirtualBox',
  'Vultr',
  'Hetzner',
  'Cisco',
  'NordVPN',
  'IFTTT',
  'Ethernet',
  // RouterOS feature, menu and tool names. They are product vocabulary, not
  // prose: a translated menu name cannot be found in the console and does not
  // match the English manual.
  'RouterBOOT',
  'Supout.rif',
  'FlashFig',
  'RoMON',
  'Dude',
  'Ping',
  'Torch',
  'Nv2',
  'MACsec',
  'Openflow',
  'OpenFlow',
  'Socksify',
  'Layer7',
  'Mangle',
  'UPnP',
  'EoIP',
  'Dot1X',
  'ChirpStack',
  'The Things Stack',
  'Modbus',
  'iSCSI',
  'NVMe over TCP',
  'Rsync',
  'WiFi CAPsMAN',
  'Wi-Fi 5 (802.11ac)',
  'Btrfs RAID',
];

/**
 * Units and qualifiers that read as part of a model/spec name rather than as
 * prose. A label made only of these next to numbers (`60 GHz`, `Wi-Fi 6`) is a
 * technical designation and stays English in every locale.
 */
const UNITS = new Set([
  'ghz',
  'mhz',
  'khz',
  'hz',
  'gbps',
  'mbps',
  'kbps',
  'bps',
  'w',
  'mw',
  'kw',
  'mm',
  'cm',
  'km',
  'm',
  'db',
  'dbi',
  'dbm',
  'v',
  'mv',
  'a',
  'ma',
  'ms',
  's',
  'min',
  'h',
  '°c',
  'wi-fi',
  'wifi',
  '802.11',
  'ac',
  'ax',
  'be',
  'ad',
  'n',
  'g',
  'b',
  'a/b/g/n',
  'lte',
  '5g',
  '4g',
  '3g',
  '2.4',
  '5',
  '6',
  '60',
]);

/** Normalized form used for whitelist lookups. */
export function normalizeTerm(text) {
  return String(text).trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Terms whose glossary source is kept verbatim in the target language.
 *
 * The glossary is the reviewed authority on which words are product names. A
 * term mapped to itself (`Back To Home` -> `Back To Home`) is one of them; a
 * term with a real translation (`NAT` -> `NAT（网络地址转换）`) is translated by
 * the glossary, so the English form is still the label to keep.
 */
export function glossaryIdentityTerms(locale) {
  const file = path.join(REPO, 'config/glossary', `${locale}.yml`);
  if (!fs.existsSync(file)) return [];
  let data = {};
  try {
    data = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return [];
  }
  return (data.terms || [])
    .map((term) => ({
      source: String(term?.source ?? '').trim(),
      target: String(term?.target ?? '').trim() || String(term?.source ?? '').trim(),
    }))
    .filter((term) => term.source && normalizeTerm(term.target) === normalizeTerm(term.source))
    .map((term) => term.source);
}

/** English sources of the glossary's bilingual terms (`Back To Home`, `NAT`). */
export function glossarySourceTerms(locale) {
  const file = path.join(REPO, 'config/glossary', `${locale}.yml`);
  if (!fs.existsSync(file)) return [];
  let data = {};
  try {
    data = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return [];
  }
  return (data.terms || [])
    .map((term) => String(term?.source ?? '').trim())
    .filter(Boolean);
}

/** Placeholders a translation must preserve exactly (`{count}`, `{versionLabel}`). */
export function placeholders(text) {
  return [...String(text).matchAll(/\{[A-Za-z0-9_.-]+\}/g)].map((match) => match[0]).sort();
}

/** True when the text carries at least one word outside its placeholders. */
function hasWords(text) {
  return /[A-Za-z]/.test(String(text).replace(/\{[^}]*\}/g, ' '));
}

/**
 * True when every word of the text is a technical designation.
 *
 * Parenthesised groups are removed first: `Wi-Fi 6 / 7 (802.11ax/be)` is the
 * Wi-Fi generation name with its radio standards in brackets, not a sentence.
 * A whitelisted proper noun counts as technical, so a product plus a version
 * (`WinBox v3`) is an identifier, not a label with translatable words.
 */
export function isTechnicalDesignation(text, {whitelist = null} = {}) {
  const stripped = String(text)
    .replace(/[(（][^)）]*[)）]/g, ' ')
    .replace(/[«»"“”'’]/g, ' ');
  const words = stripped.split(/[\s/、，,+]+/).filter(Boolean);
  if (!words.length) return false;
  const terms = whitelist || new Set(PROPER_NOUNS.map(normalizeTerm));
  return words.every((word) => {
    const bare = word.replace(/^[-–—.]+|[-–—.]+$/g, '');
    if (!bare) return true;
    if (/[0-9]/.test(bare)) return true;
    if (/^[A-Z0-9][A-Z0-9.+-]*$/.test(bare)) return true;
    if (UNITS.has(bare.toLowerCase())) return true;
    return terms.has(normalizeTerm(bare));
  });
}

/** The whitelist for one locale: the shared proper nouns plus its glossary. */
export function buildWhitelist(locale) {
  return new Set([...PROPER_NOUNS, ...glossaryIdentityTerms(locale)].map(normalizeTerm));
}

/**
 * True when the label is still English and should be translated.
 *
 * `whitelist` comes from `buildWhitelist(locale)`; a caller that has no locale
 * can pass `null` and the shared proper nouns are used.
 */
export function looksUntranslated(message, {whitelist = null} = {}) {
  const text = String(message ?? '').trim();
  if (!text) return false;
  if (LOCALIZED_SCRIPT.test(text)) return false;
  if (!hasWords(text)) return false;
  // No lowercase letter at all (`CMR`, `API`, `S+RJ10`, `802.11`, `5G`): an
  // identifier, not a label to translate.
  if (!/[a-z]/.test(text)) return false;
  // Neither a capital nor a space: a command or menu token (`scrub-cancel`,
  // `subvolume`, `check`). The CLI Reference pages carry one such label per
  // page, and they must stay English — a translated command name cannot be
  // searched for in the console.
  if (!/[A-Z]/.test(text) && !/\s/.test(text)) return false;
  const terms = whitelist || new Set(PROPER_NOUNS.map(normalizeTerm));
  if (isTechnicalDesignation(text, {whitelist: terms})) return false;
  if (terms.has(normalizeTerm(text))) return false;
  return true;
}
