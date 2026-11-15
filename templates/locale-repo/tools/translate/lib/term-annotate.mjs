/**
 * Glossary terms that are annotated once per page instead of every time.
 *
 * `Back To Home` is a product name: the reader needs the Chinese explanation
 * ("远程回家") the first time it appears, and nothing after that. The glossary
 * used to map the term to `Back To Home（远程回家）`, so *every* occurrence grew
 * the parenthesis and a page that mentions the feature five times read like a
 * glossary footnote repeated five times.
 *
 * The glossary now keeps the bare term, and this pass adds the explanation to
 * the first occurrence of the page only. It is idempotent: an existing
 * annotation is removed before the first occurrence is annotated again, so a
 * rebuild from memory - whose old entries still carry the parenthesis - cannot
 * accumulate copies.
 *
 * "First occurrence" is document order: `title`, then `description`/other front
 * matter, then body. A page whose title is the term therefore gets the
 * parenthesis in the title and keeps its body plain, which is also what the
 * sidebar label policy expects (`config/glossary/zh-Hans.yml`).
 */

export const ANNOTATED_TERMS = [
  {source: 'Back To Home', note: '（远程回家）'},
];

const SEPARATOR = '\u0000';

function annotateFirst(text, source, note) {
  const annotated = `${source}${note}`;
  const spaced = `${source} ${note}`;
  // Drop every previous annotation first; the pass must not depend on the input.
  let out = String(text).split(annotated).join(source).split(spaced).join(source);
  const index = out.indexOf(source);
  if (index === -1) return out;
  return out.slice(0, index) + annotated + out.slice(index + source.length);
}

/**
 * Annotate the first occurrence of every configured term across a document.
 *
 * `frontMatter` is prepended to `body` before the scan, so the front-matter
 * title wins the annotation over a body paragraph. Both halves are returned
 * separately and byte-identical otherwise.
 */
export function annotateDocumentTerms(frontMatter, body) {
  const joined = `${frontMatter}${SEPARATOR}${body}`;
  let out = joined;
  for (const {source, note} of ANNOTATED_TERMS) out = annotateFirst(out, source, note);
  if (out === joined) return {frontMatter, body};
  const split = out.indexOf(SEPARATOR);
  return {frontMatter: out.slice(0, split), body: out.slice(split + SEPARATOR.length)};
}

/** Convenience for the memory/TM text, where only the bare term is wanted. */
export function bareTerm(text, source = 'Back To Home', note = '（远程回家）') {
  return String(text).split(`${source}${note}`).join(source).split(`${source} ${note}`).join(source);
}
