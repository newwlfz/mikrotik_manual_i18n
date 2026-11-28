/**
 * Put cached rendered-table cells back into an official Markdown body.
 *
 * The cache is addressed by table index and cell coordinates. A row/column
 * mismatch is never guessed: the table is skipped and reported.
 */

import {isWideTableAt, splitRow, tableSlots} from './table-structure.mjs';

/** `img/foo-02-ab12cd34.webp` and `img/foo-02.webp` name the same picture. */
function imageBases(text) {
  const out = [];
  for (const match of String(text).matchAll(/([A-Za-z0-9._-]+)\.(?:webp|png|jpe?g|gif|svg)/gi)) {
    out.push(match[1].replace(/-[0-9a-f]{8,}$/i, ''));
  }
  return out.sort();
}

export function applyTableCache(body, cache) {
  if (!cache?.tables?.length) return {body, applied: 0, skipped: []};
  let lines = body.split('\n');
  const tables = tableSlots(lines);
  const skipped = [];
  let applied = 0;
  const entries = [...cache.tables]
    .filter((table) => table.rebuild_rows?.length || table.cells?.length)
    .sort((a, b) => b.index - a.index);

  for (const entry of entries) {
    if (entry.unaligned && !entry.rebuild_rows?.length) {
      skipped.push({table: entry.index, reason: 'cache-unaligned'});
      continue;
    }
    const table = tables[entry.index];
    if (!table) {
      skipped.push({table: entry.index, reason: 'table-missing'});
      continue;
    }
    if (table.slot) {
      // The export left `<colgroup>` + bare cells here: replace the whole slot
      // with the rendered table.
      if (!entry.rebuild_header?.length || !entry.rebuild_rows?.length) {
        skipped.push({table: entry.index, reason: 'slot-without-rebuild'});
        continue;
      }
      // These tables use a colspan layout: a full-width title row, a full-width
      // description row, then the column header. Markdown cannot express
      // colspan, so the two captions become paragraphs above a normal table.
      const head = entry.rebuild_header;
      const rows = entry.rebuild_rows;
      const caption = head.length === 1 && rows[0]?.length === 1 && rows[1]?.length > 1;
      const title = caption ? head[0] : null;
      const description = caption ? rows[0][0] : null;
      const headerRow = caption ? rows[1] : head;
      const bodyRows = caption ? rows.slice(2) : rows;
      const header = `| ${headerRow.join(' | ')} |`;
      const separator = `| ${headerRow.map(() => ':--').join(' | ')} |`;
      const rendered = bodyRows.map((cells) => `| ${cells.join(' | ')} |`);
      const block = caption
        ? [title, '', description, '', header, separator, ...rendered, '']
        : [header, separator, ...rendered, ''];
      lines.splice(table.start, table.end - table.start + 1, ...block);
      applied += entry.rebuild_rows.length;
      if (entry.official_wide && !isWideTableAt(lines, table.start)) {
        lines.splice(table.start, 0, '<WideTable>', '');
      }
      continue;
    }
    const mdRows = [table.header, ...table.rows];
    if (entry.rebuild_header?.length && entry.rebuild_rows) {
      // A header-only Markdown table is the official source's own quirk: the
      // rendered row sits in the paragraph right below it. Rebuilding without
      // consuming that paragraph duplicated the picture, so absorb it only when
      // it holds exactly the same images.
      let paragraph = [];
      if (mdRows.length === 1) {
        let cursor = table.start + 2;
        while (cursor < lines.length && lines[cursor].trim() !== '' && !/^\s*\|/.test(lines[cursor])) {
          paragraph.push(cursor);
          cursor++;
        }
        const rowImages = imageBases(entry.rebuild_rows[0]?.join(' ') || '');
        const paragraphImages = imageBases(paragraph.map((index) => lines[index]).join(' '));
        if (!rowImages.length || rowImages.join(',') !== paragraphImages.join(',')) {
          skipped.push({table: entry.index, reason: 'degenerate-table'});
          continue;
        }
      }
      // The official Markdown table does not even have the rendered row set
      // (lost rows, unescaped pipes); replace header, separator and body.
      const header = `| ${entry.rebuild_header.join(' | ')} |`;
      const separator = `| ${entry.rebuild_header.map(() => ':--').join(' | ')} |`;
      const body = entry.rebuild_rows.map((cells) => `| ${cells.join(' | ')} |`);
      // Drop the absorbed paragraph first: the indices were collected before
      // the table grew, and removing after the splice deleted the new row.
      for (const index of [...paragraph].reverse()) lines.splice(index, 1);
      lines.splice(table.start, mdRows.length + 1, header, separator, ...body);
      applied += entry.rebuild_rows.length;
      if (entry.official_wide && !isWideTableAt(lines, table.start)) {
        lines.splice(table.start, 0, '<WideTable>', '');
      }
      continue;
    }
    if (mdRows.length !== entry.rows) {
      skipped.push({table: entry.index, reason: 'row-count', markdown: mdRows.length, cache: entry.rows});
      continue;
    }
    const nextRows = mdRows.slice();
    let changed = false;
    if (entry.rebuild_rows?.length) {
      // Rebuild the body from the rendered cells: the official Markdown row
      // itself is wrong, so patching single cells cannot repair it.
      if (entry.rebuild_rows.length !== mdRows.length - 1) {
        skipped.push({table: entry.index, reason: 'rebuild-row-count', markdown: mdRows.length - 1, cache: entry.rebuild_rows.length});
        continue;
      }
      entry.rebuild_rows.forEach((cells, offset) => {
        nextRows[offset + 1] = `| ${cells.join(' | ')} |`;
        changed = true;
        applied++;
      });
    }
    for (const cell of entry.cells) {
      if (!nextRows[cell.row]) continue;
      const cells = splitRow(nextRows[cell.row]);
      if (cell.col >= cells.length) {
        skipped.push({table: entry.index, row: cell.row, col: cell.col, reason: 'cell-missing'});
        continue;
      }
      if (cells[cell.col] === cell.html) continue;
      cells[cell.col] = cell.html;
      nextRows[cell.row] = `| ${cells.join(' | ')} |`;
      changed = true;
      applied++;
    }
    if (!changed) continue;
    lines[table.start] = nextRows[0];
    for (let row = 1; row < nextRows.length; row++) lines[table.start + 1 + row] = nextRows[row];
    if (entry.official_wide && !isWideTableAt(lines, table.start)) {
      lines.splice(table.start, 0, '<WideTable>', '');
    }
  }

  return {body: lines.join('\n'), applied, skipped};
}
