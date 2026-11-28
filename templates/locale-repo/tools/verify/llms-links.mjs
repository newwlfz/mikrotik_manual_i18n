#!/usr/bin/env node
/**
 * Assert that every site-absolute link in every `llms.txt` resolves to a file
 * in the build output.
 *
 * `llms.txt` is consumed by tools, not by a browser: a 404 there is invisible
 * to `onBrokenLinks` (the URLs are absolute strings, not routes) and to the
 * browser checks. This assertion is the only thing that notices when the
 * corpus link points at a location the plugin never writes — the bug that made
 * `/docs/llms-full.txt` 404 while `/llms-full.txt` existed.
 *
 * Coverage: every `llms.txt` under the build (default locale root,
 * `<locale>/llms.txt`, and the versioned `docs/<version>/llms.txt` trees), and
 * every markdown link in them. Only this deployment's URLs are checked;
 * external links (e.g. llmstxt.org) are ignored. `llms-full.txt` files are
 * checked like any other target, so a corpus deleted by `build:slim` fails
 * here.
 *
 *   node tools/verify/llms-links.mjs
 *   node tools/verify/llms-links.mjs --build=build
 *   node tools/verify/llms-links.mjs --allow-missing  # report, exit 0
 *   node tools/verify/llms-links.mjs --json
 *
 * Run it after `build:slim`: the deploy shape is what readers download. On a
 * build produced before the link fix it fails by design (the reported URLs are
 * exactly the wrong ones).
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {normalizeBaseUrl, normalizeSiteUrl, resolveBaseUrl, resolveSiteUrl} from '../lib/site-config.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MARKDOWN_LINK_RE = /\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

function parseArgs(argv) {
  let build = path.join(REPO, 'build');
  let allowMissing = false;
  let asJson = false;
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(
        'usage: node tools/verify/llms-links.mjs [--build=<dir>] [--allow-missing] [--json]',
      );
      process.exit(0);
    }
    if (arg.startsWith('--build=')) build = path.resolve(process.cwd(), arg.slice('--build='.length));
    else if (arg === '--allow-missing') allowMissing = true;
    else if (arg === '--json') asJson = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return {build, allowMissing, asJson};
}

function findLlmsIndexes(root) {
  const found = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name === 'llms.txt') found.push(full);
    }
  }
  return found.sort();
}

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Map one markdown-link target to a build-relative file. Returns
 * `{skip: true}` for external links, `{rel}` for a checked link, or `{error}`
 * for a link that is clearly ours but not under the deployment baseUrl.
 */
function sitePathOf(raw, {basePath, siteOrigin, sourceFile, root}) {
  const value = String(raw || '').trim().replace(/^<|>$/g, '');
  if (!value) return {skip: true};
  // Anchor-only and non-HTTP links (mailto:, data:, …) are not artifacts.
  if (value.startsWith('#')) return {skip: true};
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value) && !/^pathname:/i.test(value)) {
    return {skip: true};
  }

  let pathname;
  let origin = null;
  if (/^https?:\/\//i.test(value)) {
    let url;
    try {
      url = new URL(value);
    } catch {
      return {skip: true};
    }
    origin = url.origin;
    pathname = url.pathname;
  } else if (value.startsWith('pathname://')) {
    // Docusaurus' "use this path as-is" scheme; llms.mjs never emits it, but a
    // hand-written or future index might. Still resolve against the build.
    pathname = `/${value.slice('pathname://'.length).replace(/^\/+/, '')}`;
  } else if (value.startsWith('/')) {
    pathname = value.split(/[?#]/, 1)[0];
  } else {
    // Relative link: resolve against the directory holding this llms.txt.
    const target = path.resolve(path.dirname(sourceFile), value.split(/[?#]/, 1)[0]);
    if (!inside(root, target)) return {error: 'path-escapes-build'};
    return {rel: path.relative(root, target).split(path.sep).join('/')};
  }

  if (origin && origin !== siteOrigin) {
    // Another origin (e.g. llmstxt.org) is external, unless its path is this
    // deployment's own path: SITE_URL may differ between the build that emitted
    // the links and the run that checks them, and the path is what identifies
    // the artifact.
    if (basePath !== '/' && pathname.startsWith(basePath)) {
      return {rel: decodeSuffix(pathname.slice(basePath.length))};
    }
    return {skip: true};
  }
  if (!pathname.startsWith(basePath)) return {error: 'outside-base-url'};
  const suffix = pathname.slice(basePath.length);
  if (!suffix) return {error: 'missing-path'};
  return {rel: decodeSuffix(suffix)};
}

function decodeSuffix(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolve a build-relative link to an existing output file, or null. */
function outputFileFor(root, rel) {
  const clean = rel.replace(/^\/+/, '');
  if (!clean) return path.join(root, 'index.html');
  const target = path.resolve(root, clean);
  if (!inside(root, target)) return null;
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  const asHtml = `${target}.html`;
  if (fs.existsSync(asHtml) && fs.statSync(asHtml).isFile()) return asHtml;
  const asIndex = path.join(target, 'index.html');
  if (fs.existsSync(asIndex) && fs.statSync(asIndex).isFile()) return asIndex;
  return null;
}

function main() {
  const {build, allowMissing, asJson} = parseArgs(process.argv.slice(2));
  const root = path.resolve(build);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`llms-links: build directory not found: ${root}`);
    process.exit(1);
  }
  const basePath = normalizeBaseUrl(resolveBaseUrl().value);
  const siteOrigin = new URL(normalizeSiteUrl(resolveSiteUrl().value)).origin;

  const indexes = findLlmsIndexes(root);
  if (indexes.length === 0) {
    console.error(`llms-links: no llms.txt under ${root}`);
    process.exit(1);
  }

  const missing = [];
  const outsideBase = [];
  let links = 0;
  let internal = 0;
  let external = 0;
  const perFile = [];
  for (const indexFile of indexes) {
    const source = path.relative(root, indexFile).split(path.sep).join('/');
    const text = fs.readFileSync(indexFile, 'utf8');
    const counts = {source, links: 0, internal: 0, external: 0, missing: 0, outsideBase: 0};
    for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
      const raw = match[1];
      links += 1;
      counts.links += 1;
      const mapped = sitePathOf(raw, {basePath, siteOrigin, sourceFile: indexFile, root});
      if (mapped.skip) {
        external += 1;
        counts.external += 1;
        continue;
      }
      if (mapped.error) {
        outsideBase.push({source, link: raw, reason: mapped.error});
        counts.outsideBase += 1;
        continue;
      }
      internal += 1;
      counts.internal += 1;
      const file = outputFileFor(root, mapped.rel);
      if (!file) {
        missing.push({source, link: raw, expected: mapped.rel});
        counts.missing += 1;
      }
    }
    perFile.push(counts);
  }

  const failed = missing.length > 0 || outsideBase.length > 0 || internal === 0;
  const result = {
    build: path.relative(REPO, root) || '.',
    baseUrl: basePath,
    files: indexes.length,
    links,
    internal,
    external,
    missing,
    outsideBase,
    perFile,
    allowed: allowMissing && failed,
    ok: !failed,
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const item of outsideBase) {
      console.error(`FAIL ${item.source}: ${item.link} (${item.reason})`);
    }
    for (const item of missing) {
      console.error(`FAIL ${item.source}: ${item.link} -> build/${item.expected} (missing)`);
    }
    if (internal === 0) {
      console.error(`FAIL llms-links: ${indexes.length} llms.txt file(s) contain no site-absolute links`);
    }
    const verdict = failed ? (allowMissing ? 'FAIL (allowed)' : 'FAIL') : 'PASS';
    console.log(
      `${verdict} llms-links: ${indexes.length} llms.txt file(s), ${internal} site link(s), ` +
        `${missing.length} missing, ${outsideBase.length} outside baseUrl`,
    );
  }

  if (failed && !allowMissing) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`llms-links: ${error.message}`);
  process.exit(1);
}
