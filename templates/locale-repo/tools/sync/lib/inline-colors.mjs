/**
 * Coloured inline codes inside property tables.
 *
 * The official site marks enumeration values with a coloured span, e.g.
 *
 *     <span style="color:var(--ds-icon-success,#22a06b)"><code>root-port</code></span>
 *
 * The `.md` export drops that wrapper, so the colour has to be recovered from
 * the rendered page (`tools/sync/capture-inline-colors.mjs`) and re-applied.
 * Colours are language independent, so the translated overlays get the same
 * treatment.
 */
import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../../translate/lib/paths.mjs';

const cache = new Map();

export function loadInlineColors(version) {
  if (!cache.has(version)) {
    const file = path.join(REPO, `data/manifests/docs-${version}-inline-colors.json`);
    cache.set(version, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).pages || {} : {});
  }
  return cache.get(version);
}

/**
 * Remove every `ros-*` wrapper, leaving the bare `<code>` behind.
 *
 * The wrapper has to be idempotent: `apply` and `derive` run on overlays that
 * already carry spans from the previous run, so wrapping again nested the span
 * once per run (three levels deep after three passes). Stripping to a fixed
 * point before painting makes a re-run produce exactly one level.
 */
const WRAPPED = /<span className="ros-[^"]*">(<code>[^<]*<\/code>)<\/span>/g;

function unwrapColored(line) {
  let out = line;
  for (;;) {
    const next = out.replace(WRAPPED, '$1');
    if (next === out) return out;
    out = next;
  }
}

/**
 * Wrap matching `<code>` elements in table rows. `count` caps how many times a
 * token is painted, so a common word (`yes`, `disabled`) is not coloured in
 * every cell of the table.
 */
export function applyInlineColors(body, colors) {
  // Even a page without a colour manifest must be normalised: the unwrap below
  // is what removes the nesting left by earlier runs.
  const names = colors ? Object.keys(colors).sort((a, b) => b.length - a.length) : [];
  let colored = 0;
  const lines = body.split('\n').map((line) => {
    if (!/^\s*\|/.test(line)) return line;
    let out = unwrapColored(line);
    for (const name of names) {
      const code = `<code>${name}</code>`;
      if (!out.includes(code)) continue;
      const wrapped = `<span className="ros-${colors[name].key}">${code}</span>`;
      const limit = colors[name].count ?? Number.POSITIVE_INFINITY;
      const parts = out.split(code);
      let rebuilt = parts[0];
      let used = 0;
      for (let part = 1; part < parts.length; part++) {
        const wrap = used < limit;
        rebuilt += `${wrap ? wrapped : code}${parts[part]}`;
        if (wrap) used++;
      }
      out = rebuilt;
      colored += used;
    }
    return out;
  });
  return {body: lines.join('\n'), colored};
}
