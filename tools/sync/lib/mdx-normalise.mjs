/**
 * Content-level MDX normalisation applied to every generated page.
 *
 * The official MDX carries its own components. `<Anchor id="x" />` is one of
 * them: an empty fragment target used by in-page links such as
 * `[SHUTDOWN](#shutdown)`. Our Docusaurus build has no `Anchor` export, and the
 * docs plugin injects a *module-scope* `Anchor` of its own, so a page that uses
 * the tag renders through that injected component and fails at build time with
 * `useBrokenLinks is not defined`.
 *
 * Rewriting the tag to the HTML it stands for keeps the target and removes the
 * name collision. `materialize` and `derive` both run this, so the English page
 * and its overlay always agree.
 */
const ANCHOR = /<Anchor\s+id=(?:"([^"]+)"|'([^']+)')\s*\/>/g;

export function normaliseMdxAnchors(body) {
  let count = 0;
  const next = String(body).replace(ANCHOR, (whole, double, single) => {
    count++;
    return `<span id="${double ?? single}"></span>`;
  });
  return {body: next, count};
}
