/**
 * Give every compliance mark (FCC / UKCA / EAC / CE) one structure.
 *
 * The upstream hardware pages mix two spellings:
 *
 *   ![](./img/ukca.badge.webp)                         (cube-60g-ac, s-3553lc20d)
 *   <p><Img src="/img/…" width={1600} height={1598} /></p>  (pwr-line-*)
 *
 * The first is a normal markdown image; the second is raw JSX with the
 * intrinsic pixel size of the asset, so the same marks render at wildly
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
 * lists the wordings (the original English three plus CE). A missing, malformed
 * or unreadable config falls back to the built-in English + CE wordings, so the
 * build never breaks over a presentation fix.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {isHardwareDocPath} from '../lib/fence-rules.mjs';

/** Same rendered width as the badge images on the correct pages. */
const MARK_WIDTH = 160;
const CONFIG_FILE = 'config/compliance-headings.yml';
/** Built-in wordings used when the config file is missing or unreadable.
 *  Kept in sync with `config/compliance-headings.yml`, including CE. */
const FALLBACK_HEADINGS = [
  'UKCA\\s*marking',
  'Eurasian Conformity Mark',
  'Federal Communication Commission',
  'CE\\s+(?:EC\\s+)?[Dd]eclaration\\s+of\\s+[Cc]onformity',
  'CE\\s*[Dd]eclaration',
  'CE\\s*符合性(?:聲明|声明)',
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
 * Uses the `yaml` package already declared in package.json, so no new
 * dependency or lockfile change is needed. Relative paths resolve against the
 * repository root (`process.cwd()`), the same convention the rest of the site
 * uses, because Docusaurus runs remark plugins from the site root. A missing,
 * malformed or unreadable file falls back to the built-in wordings instead of
 * failing the build: the mark styling is a presentation fix, not a build
 * dependency.
 */
export function loadComplianceConfig(configPath = CONFIG_FILE) {
  const file = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  if (cache.has(file)) return cache.get(file);
  let data = {};
  try {
    data = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    data = {};
  }

  const compile = (entries) => {
    const out = [];
    for (const entry of entries) {
      if (typeof entry !== 'string' || !entry.trim()) continue;
      try {
        out.push(new RegExp(entry, 'i'));
      } catch {
        // Skip a single bad regex; one typo must not break the whole build.
      }
    }
    return out;
  };

  let patterns = compile(
    Array.isArray(data.headings) && data.headings.length ? data.headings : FALLBACK_HEADINGS,
  );
  // Never end up with zero patterns (e.g. a config full of bad regexes).
  if (patterns.length === 0) patterns = compile(FALLBACK_HEADINGS);
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
    const {patterns} = loadComplianceConfig();
    let inComplianceSection = false;

    for (const node of tree.children) {
      if (node.type === 'heading') {
        inComplianceSection = patterns.some((regex) => regex.test(headingText(node)));
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
