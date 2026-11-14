import {visit} from 'unist-util-visit';

/**
 * Wrap tables the way the official site does.
 *
 * The official pages render every wide table as
 *   <div class="wideTableInline">
 *     <div class="wideTableToolbar"><button>Open table full width</button></div>
 *     <table>…</table>
 *   </div>
 * The wrapper is added by their build, not present in the Markdown, so the
 * mirror adds it here for both locales and every version.
 */
export default function wideTable() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || parent.type !== 'element' || node.tagName !== 'table') return;
      if (parent.properties?.className?.includes?.('wideTableInline')) return;
      const button = {
        type: 'element',
        tagName: 'button',
        properties: {type: 'button', 'aria-label': 'Open table full width'},
        children: [{type: 'text', value: 'Open table full width'}],
      };
      const toolbar = {
        type: 'element',
        tagName: 'div',
        properties: {className: ['wideTableToolbar']},
        children: [button],
      };
      const wrapper = {
        type: 'element',
        tagName: 'div',
        properties: {className: ['wideTableInline']},
        children: [toolbar, node],
      };
      parent.children[index] = wrapper;
    });
  };
}
