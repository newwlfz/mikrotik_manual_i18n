/**
 * Line-leading `#` comments inside shell/RouterOS code fences.
 *
 * The `code-verbatim` rule copies a fence byte for byte. That is still true for
 * every code line, but a comment is prose that happens to live in a fence: the
 * reader of a Chinese page wants `# 启用 VLAN 过滤`, not an English sentence
 * wrapped in a RouterOS script. So a narrower rule replaces it:
 *
 *   code-verbatim-except-comments
 *     Every code byte comes from the English source. A line-leading `#` comment
 *     in an allowed language may carry Chinese text.
 *
 * The hard part is not the substitution, it is deciding what *is* a comment.
 * RouterOS `print` output puts table headers in the same fence, and those look
 * like `#   NAME   TYPE   ...`; a comment-translation pass that touched them
 * would corrupt the table. This module therefore classifies every line-leading
 * `#` line before anything is translated, and the translator only ever sees the
 * lines classified as `comment`.
 *
 * Only line-leading comments are considered. A `#` inside a string or a trailing
 * comment after code stays byte-identical: rewriting those needs a parser, and a
 * wrong guess would change behaviour, not just wording.
 */

const FENCE_OPEN = /^([ \t]*(?:(?:[-*+]|\d+[.)])\s+)?)(`{3,}|~{3,})(.*)$/;
const COMMENT = /^([ \t]*)(#+)([ \t]?)(.*)$/;
const HAN = /[\u3400-\u9fff]/;
const CAPS = /^(?=.*[A-Z])[A-Z0-9][A-Z0-9._/:%+-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?/;
const KEY_VALUE = /^[a-z][a-z0-9 _.:-]*\s*=\s*\S+$/;
const PROMPT = /^(?:\[[^\]]*\]\s*>\s*|\s*>\s{2,})/;
/** Key, certificate or TLS helper block: its `#` lines are file content. */
const OPAQUE = /^\s*(?:-----BEGIN |<tls-)/;
/** A `cat`/`less`/`head` of an absolute path turns the rest into a file dump. */
const DUMP_START = /\b(?:cat|less|more|head|tail)\s+(?:\S*\/|["']\/)/;

/** Languages whose comments the user asked to translate. */
export const COMMENT_LANGUAGES = new Set(['ros', 'routeros', 'bash', 'sh', 'shell']);

/**
 * Fence info string → language. `routeros` is the long spelling of `ros`;
 * Docusaurus also emits `{.ros}` and `language-ros`.
 */
export function normalizeLanguage(info) {
  const token = String(info || '').trim().split(/\s+/)[0] || '';
  const bare = token
    .replace(/^\{\.?/, '')
    .replace(/\}$/, '')
    .replace(/^language-/, '');
  const lang = bare.toLowerCase();
  return lang === 'routeros' ? 'ros' : lang;
}

export function isCommentLanguage(lang) {
  if (!lang) return false;
  const value = String(lang).toLowerCase();
  return COMMENT_LANGUAGES.has(value);
}

/**
 * One line-leading comment split into its parts.
 *
 * Upstream pages use both `# text` and `## text`; the hash run and the optional
 * space are part of the line's shape and must survive a rewrite byte for byte.
 */
export function parseCommentLine(line) {
  const match = COMMENT.exec(line);
  if (!match) return null;
  return {indent: match[1], hashes: match[2], space: match[3], text: match[4]};
}

function isCloser(line, marker) {
  const text = line.trim();
  if (text.length < marker.length) return false;
  if (!text.startsWith(marker[0].repeat(marker.length))) return false;
  return /^[`~]+$/.test(text);
}

/**
 * Fenced blocks with their opener line, info string and content lines.
 *
 * `lineNumbers` are zero-based indices into `body.split('\n')`, so a caller can
 * map a block line back to the document without re-scanning.
 */
export function scanFences(body) {
  const lines = String(body ?? '').split('\n');
  const blocks = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!current) {
      const match = FENCE_OPEN.exec(line);
      if (!match) continue;
      current = {
        marker: match[2],
        info: (match[3] || '').trim(),
        language: normalizeLanguage(match[3]),
        open: i,
        close: null,
        lines: [],
        lineNumbers: [],
      };
      continue;
    }
    if (isCloser(line, current.marker)) {
      current.close = i;
      blocks.push(current);
      current = null;
      continue;
    }
    current.lines.push(line);
    current.lineNumbers.push(i);
  }
  if (current) blocks.push(current);
  return blocks;
}

/**
 * Every line-leading `#` line in a comment-language fence.
 *
 * Returns the raw line plus its parts so a rewrite can preserve the exact
 * indentation and the presence or absence of the space after `#`.
 */
export function commentLines(body) {
  const out = [];
  const blocks = scanFences(body);
  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    if (!isCommentLanguage(block.language)) continue;
    const opaque = block.lines.some((line) => OPAQUE.test(line));
    let dump = false;
    for (let i = 0; i < block.lines.length; i++) {
      const line = block.lines[i];
      const parsed = parseCommentLine(line);
      if (!parsed) {
        if (DUMP_START.test(line)) dump = true;
        continue;
      }
      out.push({
        block: b,
        index: i,
        language: block.language,
        info: block.info,
        indent: parsed.indent,
        hashes: parsed.hashes,
        space: parsed.space,
        text: parsed.text,
        raw: line,
        next: block.lines[i + 1],
        lineNumber: block.lineNumbers[i] + 1,
        // A block-level reason why no line of this fence may be translated.
        blockSkip: opaque ? 'opaque' : dump ? 'file-dump' : null,
      });
    }
  }
  return out;
}

function isDashedRule(text) {
  return /^-{2,}(?:\s+-{2,})*\s*$/.test(String(text || '').trim());
}

/**
 * A RouterOS `print` header, not a comment.
 *
 * `#   NAME   TYPE   SIZE` is all-caps column labels; a wrapped header can lose
 * its trailing letters, so the next line being a dashed rule is accepted as
 * proof that this line is a header even when a column name is mixed case.
 */
export function isLikelyTableHeader(text, next) {
  const value = String(text ?? '').trim();
  if (value === '') return true;
  const tokens = value.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  if (tokens.length >= 2 && tokens.every((token) => CAPS.test(token))) return true;
  if (isDashedRule(next) && tokens.length >= 1 && tokens.every((token) => CAPS.test(token) || /^-+$/.test(token))) {
    return true;
  }
  if (isDashedRule(value)) return true;
  // An upstream conversion sometimes joins a header and its first data row on
  // one line: "ADDRESS FROM-POOL INTERFACE ADVERTISE 0 G 2001:db8::1/64 ...".
  const capsPrefix = tokens.findIndex((token) => !CAPS.test(token));
  const lead = capsPrefix === -1 ? tokens.length : capsPrefix;
  if (lead >= 2 && /(?:\d+\.\d+\.\d+\.\d+|::|\d+\/\d+)/.test(value)) return true;
  return false;
}

/**
 * Words that make a line read as a sentence rather than as an identifier.
 *
 * A lowercase run of two or more letters: `For` and `Rendezvous` count,
 * `2x50G` (only `x`) and `ARM64` do not, which is what keeps hardware labels
 * such as `2x50G - DAC` out of the translator.
 */
function sentenceWords(text) {
  return text.split(/\s+/).filter((token) => /[a-z]{2,}/.test(token));
}

/** Leading words that introduce a short directive ("For ARM64", "Note: ..."). */
const LEADING = new Set([
  'for', 'with', 'without', 'if', 'when', 'unless', 'note', 'see', 'use', 'set',
  'add', 'remove', 'enable', 'disable', 'to', 'from', 'by', 'on', 'in', 'at',
  'after', 'before', 'then', 'otherwise', 'example', 'file', 'only',
]);

const COMMANDS = new Set([
  'wget', 'curl', 'dd', 'unzip', 'zip', 'tar', 'gzip', 'sudo', 'su', 'apt',
  'apt-get', 'yum', 'dnf', 'apk', 'docker', 'systemctl', 'service', 'ssh',
  'scp', 'rsync', 'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'cd', 'ls', 'cat',
  'echo', 'chmod', 'chown', 'mount', 'umount', 'qemu-img', 'virt-install',
  'virsh', 'openvpn', 'ip', 'ifconfig', 'tcpdump', 'nmap', 'ping', 'git',
  'npm', 'npx', 'node', 'python', 'python3', 'pip', 'pip3', 'terraform',
  'ansible', 'kubectl', 'helm', 'snmpwalk', 'snmpget', 'openssl', 'base64',
  'sed', 'awk', 'grep', 'find', 'xargs', 'export', 'source', 'bash', 'sh',
  'nano', 'vi', 'vim', 'tee', 'date', 'sleep', 'kill', 'killall', 'netstat',
  'ss', 'route', 'iptables', 'nft', 'sysctl', 'modprobe', 'lsblk', 'fdisk',
  'show', 'display', 'ping6', 'traceroute', 'dig', 'nslookup', 'host', 'whois',
  'parted', 'mkfs', 'fsck', 'mount', 'crontab', 'make', 'cmake', 'gcc',
]);

function looksLikeCommand(text) {
  if (text.startsWith('/')) return true;
  if (text.includes('://')) return true;
  if (text.startsWith(':')) return true; // RouterOS script command (`:put ...`)
  const first = text.split(/\s+/)[0];
  // Commands are written in lower case; "Export certificates ..." is a
  // sentence that happens to start with a verb.
  if (first !== first.toLowerCase()) return false;
  const rest = text.slice(first.length).trim();
  if (COMMANDS.has(first)) {
    if (rest === '') return true;
    // `cmd arg=value`, `cmd -flag`, `cmd /path` or a short invocation.
    if (/[=<>|]/.test(rest)) return true;
    if (/^[-/]/.test(rest)) return true;
    if (rest.split(/\s+/).length <= 3) return true;
    return false;
  }
  // `cmd arg=value` is an invocation, not a sentence.
  if (/^[A-Za-z][\w./-]*\s+\S+=\S+/.test(text)) return true;
  return false;
}

/**
 * Classify one line-leading `#` line.
 *
 * Kinds:
 *   comment         natural-language text; the only kind the translator may send
 *   table-header    RouterOS print output header (`# NAME TYPE ...`)
 *   output          router output, export dump or timestamp
 *   command         a commented-out command line
 *   decoration      banner or punctuation rule (`### Section ###`, `-----`)
 *   label           hardware/diagram label without sentence structure
 *   code            a single token: identifier, filename, key
 *   empty           the bare `#`
 *   already-chinese a line that already carries Han characters
 *   ambiguous       nothing above matched; reported, never translated
 */
export function classifyComment(text, next, hashes = 1) {
  const value = String(text ?? '').trim();
  // `##### Section #####` is a banner; `## text` is an ordinary comment in the
  // pages that use a double hash.
  if (Number(hashes) >= 3) return {kind: 'decoration'};
  if (value === '') return {kind: 'empty'};
  if (HAN.test(value)) return {kind: 'already-chinese'};
  if (/^#/.test(value)) return {kind: 'decoration'};
  if (!/[\p{L}\p{N}]/u.test(value)) return {kind: 'decoration'};
  if (isLikelyTableHeader(value, next)) return {kind: 'table-header'};
  if (/^Flags:/.test(value)) return {kind: 'output'};
  if (DATE.test(value)) return {kind: 'output'};
  if (KEY_VALUE.test(value)) return {kind: 'output'};
  if (PROMPT.test(value)) return {kind: 'output'};
  if (looksLikeCommand(value)) return {kind: 'command'};
  if (!/\s/.test(value)) return {kind: 'code'};

  const words = sentenceWords(value);
  if (words.length >= 2) return {kind: 'comment'};
  if (words.length === 1) {
    const head = value.split(/\s+/)[0].toLowerCase();
    if (LEADING.has(head)) return {kind: 'comment'};
    return {kind: 'label'};
  }
  return {kind: 'ambiguous'};
}

/** Stable translation-memory key for a comment: language plus normalised text. */
export function commentKey(language, text) {
  const lang = normalizeLanguage(language) || String(language || '');
  return `${lang}\u0000${String(text ?? '').trim().replace(/\s+/g, ' ')}`;
}

/**
 * Rewrite one comment line with translated text, preserving indentation and the
 * `#` plus its optional single space. A trailing `\` continuation survives.
 */
export function rewriteCommentLine(line, translation) {
  const parsed = parseCommentLine(line);
  if (!parsed) return line;
  let body = String(translation ?? parsed.text).trim();
  if (body === '') return line;
  const continuation = /(\\\s*)$/.exec(parsed.text);
  if (continuation && !/\\\s*$/.test(body)) body = `${body} ${continuation[1].trim()}`;
  return `${parsed.indent}${parsed.hashes}${parsed.space}${body}`;
}

/**
 * Apply a comment translation to every eligible line of a body.
 *
 * `lookup(key, entry)` returns the Chinese comment text or null. Only
 * `comment`-classified lines are ever replaced; everything else, including all
 * non-comment code, is copied unchanged.
 */
export function translateCodeComments(body, lookup) {
  const lines = String(body ?? '').split('\n');
  let hits = 0;
  let skipped = 0;
  const misses = [];
  for (const entry of commentLines(body)) {
    const verdict = classifyComment(entry.text, entry.next, entry.hashes.length);
    if (entry.blockSkip) {
      if (verdict.kind === 'comment') skipped++;
      continue;
    }
    if (verdict.kind !== 'comment') continue;
    const translated = lookup(commentKey(entry.language, entry.text), entry);
    if (translated === null || translated === undefined || translated === '') {
      misses.push({language: entry.language, text: entry.text.trim()});
      continue;
    }
    lines[entry.lineNumber - 1] = rewriteCommentLine(entry.raw, translated);
    hits++;
  }
  return {body: lines.join('\n'), hits, misses, skipped};
}

/**
 * Per-line role inside one fence block.
 *
 *   comment  the line is prose and may carry Chinese
 *   code     byte-identical to the English source
 *   locked   a comment line that must stay English (print output, banner,
 *            commented-out command, opaque key block, file dump)
 *
 * Verification uses the *source* roles to decide which target lines are allowed
 * to differ, so a translated comment is never counted as a changed code line.
 */
export function fenceRoles(lines) {
  const opaque = lines.some((line) => OPAQUE.test(line));
  let dump = false;
  const roles = [];
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseCommentLine(lines[i]);
    if (!parsed) {
      if (DUMP_START.test(lines[i])) dump = true;
      roles.push({role: 'code'});
      continue;
    }
    if (opaque) {
      roles.push({role: 'locked', parsed});
      continue;
    }
    if (dump) {
      roles.push({role: 'locked', parsed});
      continue;
    }
    const verdict = classifyComment(parsed.text, lines[i + 1], parsed.hashes.length);
    roles.push({role: verdict.kind === 'comment' ? 'comment' : 'locked', parsed, kind: verdict.kind});
  }
  return roles;
}
