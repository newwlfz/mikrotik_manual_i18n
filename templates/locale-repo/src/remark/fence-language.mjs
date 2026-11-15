/**
 * Apply `config/code-fence-languages.yml` while MDX compiles.
 *
 * This is the render-side twin of `tools/build/normalize-fences.mjs`: a bare
 * fence in `mobile-networking/` that starts with `:global`, `/interface`,
 * `{`, `[admin@` or `[novlan]` becomes a RouterOS block for **every version
 * and every locale**, even though the markdown itself is not rewritten.
 *
 * Aliases (`routeros` → `ros`, `text` → `plaintext`, …) are resolved by the
 * same helper, so the old `ros-language` pass is subsumed.
 */

import {
  canonicalDocPath,
  firstContentLine,
  loadFenceConfig,
  resolveFenceLanguage,
} from '../lib/fence-rules.mjs';

function walk(node, visit) {
  visit(node);
  if (node.children) for (const child of node.children) walk(child, visit);
}

export default function fenceLanguage() {
  const config = loadFenceConfig();
  return (tree, file) => {
    const docPath = canonicalDocPath(file?.path || '');
    walk(tree, (node) => {
      if (node.type !== 'code') return;
      const resolved = resolveFenceLanguage({
        config,
        info: node.lang || '',
        firstLine: firstContentLine(node.value),
        // A captured heading may be the first line of a real script; the rules
        // get the whole block so they can look past it.
        content: node.value,
        docPath,
      });
      if (!resolved.changed) return;
      // `node.lang` carries only the first token; `meta` keeps the rest.
      node.lang = resolved.info.split(/\s+/)[0];
    });
  };
}
