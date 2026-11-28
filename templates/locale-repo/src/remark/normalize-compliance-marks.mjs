/**
 * Give every compliance mark (FCC / UKCA / EAC / CE) one structure.
 *
 * The upstream hardware pages mix two spellings:
 *
 *   ![](./img/ukca.badge.webp)                         (cube-60g-ac, s-3553lc20d)
 *   <p><Img src="/img/…" width={1600} height={1598} /></p>  (pwr-line-*)
 *
 * The first is a normal markdown image; the second is raw JSX with the
 * intrinsic pixel size of the asset, so the same three marks render at wildly
 * different sizes and are left-aligned. The fix belongs here, on the render
 * side: inside the compliance sections, every standalone image gets
 * `.complianceMark` on its paragraph and `.complianceMarkImage` on the image.
 * `src/css/custom.css` then gives all of them the same centred, fixed width.
 *
 * Markdown images keep their relative `src` (Docusaurus resolves and hashes
 * it); raw `<Img>` nodes keep their absolute `/img/...` source and are
 * rewritten to the same class-based markup.
 *
 * Which headings open such a section is *data*: `config/compliance-headings.yml`
 * lists the English, zh-Hans, zh-Hant and Russian wordings. The heading text
 * used to be three English regexes in this file, so the translated pages
 * (`## UKCA 標誌`, `## 歐亞經濟聯盟符合性標誌`, `## 聯邦通訊委員會干擾聲明`) never
 * matched, `.complianceMark` was never added, and every badge in the Chinese
 * trees rendered at its intrinsic size while the English tree was fixed.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {isHardwareDocPath} from '../lib/fence-rules.mjs';

/** Same rendered width as the badge images on the correct pages. */
const MARK_WIDTH = 160;
const CONFIG_FILE = 'config/compliance-headings.yml';
/** The English wordings, used when the config carries no `headings` list. */
const FALLBACK_HEADINGS = [
  'UKCA\\s*marking',
  'Eurasian Conformity Mark',
  'Federal Communication Commission',
];
const DEFAULT_STRUCTURE = {level: 2, require_matched_heading: true};
const STANDALONE_IMAGE_P = /^<p\b[^>]*>\s*<Img\b([^>]*?)\/?>\s*<\/p>$/is;
const ATTRIBUTE = /\b(src|alt)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/gi;
const IMAGE_JSX_NAMES = new Set(['img', 'Img']);

/** Compiled config, cached per absolute path (the site builds many pages). */
const cache = new Map();

/**
 * Read `config/compliance-headings.yml`.
 *
 * Relative paths resolve against the repository root (`process.cwd()`), the
 * same convention `src/lib/fence-rules.mjs` uses, because Docusaurus runs the
 * remark plugin from the site root. A missing or unreadable file falls back to
 * the English wordings instead of failing the build: the mark styling is a
 * presentation fix, not a build dependency.
 */
export function loadComplianceConfig(configPath = CONFIG_FILE) {
  const file = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  if (cache.has(file)) return cache.get(file);
  let data = {};
  try {
    data = yaml.load(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    data = {};
  }
  const patterns = (Array.isArray(data.headings) && data.headings.length ? data.headings : FALLBACK_HEADINGS)
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => new RegExp(entry, 'i'));
  const structure = {...DEFAULT_STRUCTURE, ...(data.structure || {})};
  const config = {patterns, structure};
  cache.set(file, config);
  return config;
}

/** `<Img …>` arrives either as a JSX flow element or, after Docusaurus'
 *  `transformImage`, as a JSX text element inside a markdown paragraph. */
function isJsxImage(node) {
  return (
    Boolean(node) &&
    (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
    IMAGE_JSX_NAMES.has(node.name)
  );
}

/** The only meaningful child of a paragraph, when that child is one image.
 *  `image` is the markdown form, `mdxJsxTextElement`/`mdxJsxFlowElement` the
 *  form Docusaurus' built-in `transformImage` produces from it. */
function soleImage(children) {
  const meaningful = (children || []).filter(
    (child) => child.type !== 'text' || child.value.trim(),
  );
  if (meaningful.length !== 1) return null;
  const [child] = meaningful;
  if (child.type === 'image' || isJsxImage(child)) return child;
  return null;
}

/** True when this block is nothing but one picture (any of the three forms). */
function isStandaloneImageBlock(node) {
  if (!node) return false;
  if (node.type === 'paragraph') return Boolean(soleImage(node.children));
  if (node.type === 'mdxJsxFlowElement' && node.name === 'p') return Boolean(soleImage(node.children));
  if (node.type === 'html') return STANDALONE_IMAGE_P.test(node.value.trim());
  return false;
}

function headingText(node) {
  let out = '';
  const walk = (current) => {
    if (current.type === 'text' || current.type === 'inlineCode') out += current.value;
    if (current.children) for (const child of current.children) walk(child);
  };
  walk(node);
  return out;
}

function attribute(source, name) {
  ATTRIBUTE.lastIndex = 0;
  let match;
  while ((match = ATTRIBUTE.exec(source))) {
    if (match[1].toLowerCase() !== name) continue;
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    return value.replace(/^['"]|['"]$/g, '');
  }
  return '';
}

function setAttribute(node, name, value) {
  node.attributes = node.attributes || [];
  const existing = node.attributes.find((item) => item.name === name);
  if (existing) existing.value = value;
  else node.attributes.push({type: 'mdxJsxAttribute', name, value});
}

function mergeAttribute(node, name, className) {
  node.attributes = node.attributes || [];
  const existing = node.attributes.find((item) => item.name === name);
  const current =
    existing && typeof existing.value === 'string'
      ? existing.value.split(/\s+/).filter(Boolean)
      : [];
  if (!current.includes(className)) current.push(className);
  setAttribute(node, name, current.join(' '));
}

function removeAttribute(node, name) {
  if (!node.attributes) return;
  node.attributes = node.attributes.filter((item) => item.name !== name);
}

function addClass(node, className) {
  node.data = node.data || {};
  const properties = (node.data.hProperties = node.data.hProperties || {});
  const current = Array.isArray(properties.className)
    ? properties.className
    : properties.className
      ? String(properties.className).split(/\s+/)
      : [];
  if (!current.includes(className)) current.push(className);
  properties.className = current;
}

export default function normalizeComplianceMarks() {
  return (tree, file) => {
    if (!isHardwareDocPath(file?.path || '')) return;
    const {patterns, structure} = loadComplianceConfig();
    const fallbackLevel = Number(structure.level ?? 2);
    const requireMatched = structure.require_matched_heading !== false;
    let inComplianceSection = false;
    // The certificate block is the tail of a hardware page: once one heading
    // has opened it, a further `## heading` + picture is another mark even when
    // its wording is not in the config (a wording nobody listed yet).
    let inComplianceTail = false;

    const children = tree.children || [];
    for (const [index, node] of children.entries()) {
      if (node.type === 'heading') {
        const text = headingText(node);
        const matched = patterns.some((regex) => regex.test(text));
        // Structural fallback: a level-N heading whose next block is a
        // standalone picture. Guarded by `require_matched_heading` so the
        // shape alone ("## Mounting" + a product photo) does not resize a
        // content section.
        const structural =
          !matched &&
          node.depth === fallbackLevel &&
          (!requireMatched || inComplianceTail) &&
          isStandaloneImageBlock(children[index + 1]);
        inComplianceSection = matched || structural;
        if (matched) inComplianceTail = true;
        continue;
      }
      if (!inComplianceSection) continue;

      if (node.type === 'paragraph') {
        // Only a picture on its own line; do not touch diagrams in a text flow.
        const image = soleImage(node.children);
        if (!image) continue;
        addClass(node, 'complianceMark');
        if (image.type === 'image') {
          image.data = image.data || {};
          image.data.hProperties = image.data.hProperties || {};
          image.data.hProperties.width = MARK_WIDTH;
          delete image.data.hProperties.height;
          addClass(image, 'complianceMarkImage');
        } else {
          // `transformImage` has already replaced the markdown image with
          // `<img src={require(…)} width="1600" height="1598" />`; keep its
          // `src`/`alt` and only take over sizing and the shared classes.
          mergeAttribute(image, 'className', 'complianceMarkImage');
          setAttribute(image, 'width', String(MARK_WIDTH));
          removeAttribute(image, 'height');
        }
        continue;
      }

      // `.md` files are compiled as MDX, so `<p><Img … /></p>` arrives as JSX
      // flow elements rather than an `html` string.
      if (node.type === 'mdxJsxFlowElement' && node.name === 'p') {
        const image = soleImage(node.children);
        if (!isJsxImage(image)) continue;
        mergeAttribute(node, 'className', 'complianceMark');
        mergeAttribute(image, 'className', 'complianceMarkImage');
        // The source carries the asset's intrinsic size (up to 1600×1598);
        // replace it with the shared width so all four pages render alike.
        setAttribute(image, 'width', String(MARK_WIDTH));
        removeAttribute(image, 'height');
        continue;
      }

      if (node.type === 'html') {
        const match = STANDALONE_IMAGE_P.exec(node.value.trim());
        if (!match) continue;
        const src = attribute(match[1], 'src');
        if (!src) continue;
        const alt = attribute(match[1], 'alt');
        node.value =
          `<p className="complianceMark">` +
          `<Img src=${JSON.stringify(src)} alt=${JSON.stringify(alt)} className="complianceMarkImage" />` +
          `</p>`;
      }
    }
  };
}
