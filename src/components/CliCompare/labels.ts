/**
 * Chinese labels for the CLI version-compare widget.
 *
 * Source of truth: the `compare_versions` table in `config/cli-labels.yml`,
 * which `tools/translate/normalize-cli-headers.mjs` uses for the Markdown
 * legend on the same page. That table is YAML read by Node tooling; this
 * component runs in the browser, so the values are copied here instead of
 * imported. Keep the two in sync — `From`, `To`, `Filter` and the diff legend
 * are the widget half of that table.
 *
 * The English locale keeps the key itself (see `compareLabel`), so the English
 * UI is byte-for-byte what it was before this table existed.
 */
export const COMPARE_LABELS_ZH: Record<string, string> = {
  From: '从',
  To: '到',
  Filter: '过滤',
  'Swap versions': '交换版本',
  'Swap From and To versions': '交换“从”和“到”版本',
  'path, e.g. ip/firewall': '路径，例如 ip/firewall',
  commands: '命令',
  command: '命令',
  parameters: '参数',
  flags: '标志',
  'parameters added': '新增参数',
  'parameters removed': '删除参数',
  'commands changed': '变更命令',
  'new commands': '新增命令',
  'commands removed': '删除命令',
  'New commands': '新增命令',
  'Removed commands': '删除命令',
  'Parameter changes': '参数变化',
  'Could not load': '无法加载',
  'No parameter differences': '没有参数差异',
  'Select two different versions to compare.': '请选择两个不同的版本进行对比。',
};

/** English is the identity mapping: the key is the label the UI already used. */
export function compareLabel(english: string, zh: boolean): string {
  return zh ? COMPARE_LABELS_ZH[english] ?? english : english;
}
