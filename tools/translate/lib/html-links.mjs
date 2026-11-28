/**
 * Inline HTML anchors.
 *
 * MDX renders `<a href="/docs/...">` verbatim. The docs plugin's
 * `resolveMarkdownLinks` remark plugin only visits `link`/`definition` nodes
 * (`@docusaurus/mdx-loader/lib/remark/resolveMarkdownLinks`), so a raw href
 * never passes through the locale/route map: the browser sends the reader to
 * the release and locale the href literally spells - usually the English page
 * of the current release.
 *
 * The overlay therefore prefers a Markdown link. This module owns the anchor
 * parsing; `normalize-links.mjs` owns the policy of when a conversion is safe
 * and `lib/links.mjs` re-points the anchors that have to stay HTML.
 */

/** `<a ...>label</a>`; the label may not contain another anchor. */
const ANCHOR_SOURCE = '<a\\b([^>]*)>([\\s\\S]*?)<\\/a>';

/** A fresh global pattern: a shared `lastIndex` would leak between callers. */
export function anchorPattern() {
  return new RegExp(ANCHOR_SOURCE, 'gi');
}

const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/**
 * Attributes that Markdown cannot express but that only *hint* at behaviour:
 * `rel` tells a crawler or the opener how to treat the link, it never changes
 * where the reader lands. A navigation-changing attribute (`target`,
 * `download`) is not in this set and keeps the anchor in HTML form.
 */
const DROPPABLE = new Set(['rel']);

/** Split the raw attribute text of an opening tag into ordered attributes. */
export function parseAnchorAttributes(raw) {
  const attributes = [];
  for (const match of String(raw ?? '').matchAll(ATTRIBUTE)) {
    const [source, name, doubleQuoted, singleQuoted, bare] = match;
    if (!name) continue;
    const hasValue = doubleQuoted !== undefined || singleQuoted !== undefined || bare !== undefined;
    attributes.push({
      name: name.toLowerCase(),
      value: doubleQuoted ?? singleQuoted ?? bare ?? null,
      hasValue,
      source: source.trim(),
    });
  }
  return attributes;
}

/** The `href` of an attribute list, or `null`. */
export function anchorHref(attributes) {
  const found = attributes.find((attribute) => attribute.name === 'href');
  return found?.value ?? null;
}

/**
 * Can this anchor become a Markdown link?
 *
 * Only when every attribute other than `href` is droppable: `[label](url)` has
 * nowhere to put `target`, `class`, `id`, `style`, `data-*` or `aria-*`, and
 * silently deleting one of those would change rendering or behaviour.
 */
export function isConvertible(attributes) {
  return attributes.every((attribute) => attribute.name === 'href' || DROPPABLE.has(attribute.name));
}

/** `true` when the label carries markup a Markdown link cannot round-trip. */
export function hasMarkup(inner) {
  return /<[^>]+>/.test(String(inner ?? ''));
}

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};

/**
 * The visible text of an anchor label.
 *
 * Surrounding spaces are preserved: the label is usually glued to Chinese
 * prose (`...端口或 <a>bond</a>接口`), where trimming would weld the words
 * together.
 */
export function anchorLabel(inner) {
  return String(inner ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name) => {
      if (name[0] === '#') {
        const hex = name[1] === 'x' || name[1] === 'X';
        const code = hex ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    });
}
