/**
 * RouterOS syntax highlighting, matching manual.mikrotik.com.
 *
 * The grammar below is the one the official manual ships (recovered from its
 * published client bundle). It is registered for the three aliases the pages
 * use: `ros`, `routeros` and `mikrotik`.
 *
 * Token classes and the colours they get from the `oneLight` / `oneDark`
 * Prism themes (also the official choice):
 *   keyword         `:local`, `set`, `add`, `print` …
 *   property        a parameter name before `=`
 *   variable        `$var`
 *   command         `/interface/bridge/port` (alias builtin)
 *   command-root    `/interface` (alias builtin)
 *   menu-name       bare menu words such as `firewall` (alias builtin)
 *   boolean / number / ip-address / mac-address / time-value
 *   operator, punctuation, string, comment
 */
export const rosGrammar = {
  comment: {pattern: /#.*/, greedy: true},
  string: {pattern: /"(?:\\.|[^\\"\r\n])*"/, greedy: true},
  property: {pattern: /[\w][\w-]*(?==)/, greedy: true},
  variable: [{pattern: /\$[a-zA-Z_][\w]*/, greedy: true}],
  command: {pattern: /\/[\w-]+(?:\/[\w-]+)+/, greedy: true, alias: 'builtin'},
  'command-root': {pattern: /\/[\w-]+\b/, greedy: true, alias: 'builtin'},
  'menu-name': {
    pattern:
      /\b(?:address|firewall|filter|nat|mangle|bridge|port|ipv6|ip|interface|route|dhcp-server|dhcp-client|dns|settings|vlan|bonding|ethernet|wireless|queue|neighbor|arp|tracking|rule|peer|network|service-port|user|group|resource|script|scheduler|logging|action|package|certificate|hotspot|accounting|connection|secret|profile|instance|area|access|policy|identity|export|monitor|list|type|health|backup|upgrade|clock|graphing|ip-binding|walled-garden)\b(?!\s*=)/,
    greedy: true,
    alias: 'builtin',
  },
  keyword:
    /\b(?:add|append|as-value|beep|clear|delay|disable|do|edit|else|enable|environment|error|execute|export|find|foreach|for|from|get|global|if|import|in|len|local|log|move|nothing|parse|pick|print|put|remove|resolve|return|set|time|tobool|toip|toip6|tonum|tostr|totime|typeof|while)\b/,
  boolean: /\b(?:yes|no|true|false)\b/,
  'ip-address': {pattern: /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/, greedy: true},
  'ipv6-address': {
    pattern: /\b(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(?:\/\d{1,3})?\b/,
    greedy: true,
    alias: 'ip-address',
  },
  'mac-address': {pattern: /\b(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}\b/, greedy: true},
  number: /\b(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[kKmMgGtT])?)\b/,
  'time-value': {pattern: /\b\d+[wdhms]\b/, greedy: true, alias: 'number'},
  operator: /[=!<>]=?|&&|\|\||[-+*/%~]|->|\.\./,
  punctuation: /[{}[\]();,|]/,
};

/** Register the grammar under every alias the documents use. */
export function registerRosGrammar(Prism) {
  if (!Prism?.languages) return;
  for (const name of ['routeros', 'ros', 'mikrotik']) {
    if (!Prism.languages[name]) Prism.languages[name] = rosGrammar;
  }
}
