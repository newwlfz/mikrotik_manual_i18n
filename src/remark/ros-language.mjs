/**
 * Highlight RouterOS CLI blocks.
 *
 * The manual writes most examples as ```ros, a language Prism does not know, so
 * they render as plain black text. RouterOS CLI is shell-like; mapping the fence
 * to bash gives commands, strings, numbers and comments their token colours.
 */
const ALIASES = /^(routeros|mikrotik)$/i;

function walk(node, visit) {
  visit(node);
  if (node.children) for (const child of node.children) walk(child, visit);
}

export default function rosLanguage() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type === 'code' && typeof node.lang === 'string' && ALIASES.test(node.lang)) {
        node.lang = 'ros';
      }
    });
  };
}
