/**
 * Markdown table / rendered-table helpers shared by the one-off structure
 * restorer and the materialisation cache.
 *
 * The important part is that both paths use the same cell cleaning rules:
 * drop presentational spans and inline styles, self-close void tags, resolve
 * relative hrefs, and encode pipes/braces so the result survives MDX.
 */

export function splitRow(line) {
  const cells = [];
  let current = '';
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '`') inCode = !inCode;
    if (char === '|' && !inCode && line[i - 1] !== '\\') {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  // leading/trailing empty cells come from the outer pipes
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map((cell) => cell.trim());
}

export function mdTables(lines) {
  const tables = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\s*\|.*\|\s*$/.test(lines[i]) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const start = i;
      let end = i + 2;
      while (end < lines.length && /^\s*\|.*\|\s*$/.test(lines[end])) end++;
      tables.push({start, header: lines[i], sep: lines[i + 1], rows: lines.slice(i + 2, end), end});
      i = end;
    }
  }
  return tables;
}

/**
 * Table slots the official Markdown export left as `<colgroup>` + bare cells.
 *
 * Some pages lose the table skeleton in the `.md` export: the widths survive as
 * a `<colgroup>`, then every cell becomes its own paragraph and no `<table>`,
 * `<tr>` or `<td>` exists at all. The rendered page still has the real table, so
 * the slot only marks *where* it belongs; the cells come from the HTML.
 *
 * A slot runs from `<colgroup>` to the last non-empty line before the next
 * heading, slot or fence — the export always ends such a block at a heading.
 */
export function htmlSlotTables(lines) {
  const out = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (!/^\s*<colgroup>\s*$/.test(line)) continue;
    let j = i + 1;
    let nested = false;
    for (; j < lines.length; j++) {
      const next = lines[j];
      if (/^\s*(```|~~~)/.test(next)) break;
      if (/^\s*<colgroup>\s*$/.test(next)) {
        nested = true;
        break;
      }
      if (/^#{1,6}\s/.test(next)) break;
    }
    let end = j - 1;
    while (end > i && lines[end].trim() === '') end--;
    out.push({start: i, end, header: null, sep: null, rows: [], slot: true});
    i = nested ? i : end;
  }
  return out;
}

/** Pipe tables and `<colgroup>` slots in document order. */
export function tableSlots(lines) {
  return [...mdTables(lines), ...htmlSlotTables(lines)].sort((a, b) => a.start - b.start);
}

/** True when the table is preceded by the official <WideTable> marker. */
export function isWideTableAt(lines, start) {
  for (let i = start - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    return line === '<WideTable>';
  }
  return false;
}

function resolveHrefs(html, source) {
  const base = source.endsWith('/') ? source : `${source}/`;
  return html.replace(/href="([^"]+)"/gi, (whole, href) => {
    if (/^(https?:|mailto:|#|\/)/i.test(href)) return whole;
    try {
      return `href="${new URL(href, base).pathname}"`;
    } catch {
      return whole;
    }
  });
}

export function cleanCell(html, source) {
  let out = html;
  out = out.replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '');
  // `<p[^>]*>` also matched `<pre>` and left its closing tag behind, which
  // MDX rejects ("Unexpected closing slash").
  out = out.replace(/<p(?:\s[^>]*)?>/gi, '').replace(/<\/p(?:\s[^>]*)?>/gi, '');
  out = out.replace(/\sdata-uuid="[^"]*"/gi, '');
  out = out.replace(/\sstyle="[^"]*"/gi, '');
  out = out.replace(/(<a\b[^>]*href="[^"]*?)\.md(["#])/gi, '$1$2');
  out = resolveHrefs(out, source);
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<br\s*\/?>/gi, '<br/>');
  // MDX requires void elements to be self-closed.
  out = out.replace(/<(img|hr|input|meta|link|source)\b([^>]*?)\/?>/gi, (whole, tag, attrs) => {
    return `<${tag}${attrs.replace(/\/\s*$/, '').trimEnd()}/>`;
  });
  // Keep the list styling class the official page relies on, drop the rest.
  out = out.replace(/\sclass="([^"]*)"/gi, (whole, name) =>
    /^(bullets|alternate)$/.test(name.trim()) ? ` class="${name.trim()}"` : '',
  );
  out = out.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
  // A Markdown table cell cannot hold a bare pipe (it ends the cell) and MDX
  // reads braces as JSX expressions. Encode them as entities; MDX leaves
  // character references alone, and the browser renders the original glyph.
  out = out.replace(/(<[^>]*>)|([^<]+)/g, (whole, tag, text) =>
    tag
      ? tag
      : text
          .replace(/\|/g, '&#124;')
          .replace(/\{/g, '&#123;')
          .replace(/\}/g, '&#125;'),
  );
  return out;
}

/** Coarse Markdown-side structure counts used by the audit, not for rendering. */
export function countMarkdownStructure(text) {
  const lines = text.split('\n');
  return {
    listMarkers: (text.match(/^\s*(?:[-*+]|\d+\.)\s+/gm) || []).length,
    br: (text.match(/<br\b/gi) || []).length,
    details: (text.match(/<details\b/gi) || []).length,
    tables: mdTables(lines).length,
    wideTables: (text.match(/<WideTable>/g) || []).length,
    sup: (text.match(/<sup\b/gi) || []).length,
    code: (text.match(/<code\b/gi) || []).length,
  };
}


/** Remove Markdown table blocks so body counts describe content outside tables. */
export function stripMarkdownTables(text) {
  const lines = text.split('\n');
  const tables = mdTables(lines);
  const remove = new Set();
  for (const table of tables) {
    for (let i = table.start; i < table.end; i++) remove.add(i);
  }
  return lines.filter((_, index) => !remove.has(index)).join('\n');
}

/** Remove fenced code blocks; they render with <br> inside the official HTML. */
export function stripMarkdownCodeBlocks(text) {
  const lines = text.split('\n');
  const out = [];
  let fence = null;
  for (const line of lines) {
    const match = /^\s*(?:(?:\d+\.|[-*+])\s+)?(```+|~~~+)/.exec(line);
    if (match) {
      if (!fence) fence = match[1][0];
      else if (match[1][0] === fence) fence = null;
      continue;
    }
    if (!fence) out.push(line);
  }
  return out.join('\n');
}

export function stripMarkdownBody(text) {
  return stripMarkdownTables(stripMarkdownCodeBlocks(text));
}

/** Structure outside tables and code blocks, plus the total table count. */
export function countMarkdownBodyStructure(text) {
  const totalTables = mdTables(text.split('\n')).length;
  const body = countMarkdownStructure(stripMarkdownBody(text));
  return {...body, tables: totalTables};
}
