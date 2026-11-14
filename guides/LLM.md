# LLM configuration (translation)

`tools/translate` sends the blocks that are still English to an
OpenAI-compatible chat-completions endpoint. The endpoint, model and key are
connection settings, not repository content: they are never committed and
`config/translation.yml` no longer stores them.

## Variables

| Name | Required | Default | Meaning |
| --- | --- | --- | --- |
| `LLM_BASE_URL` | yes | — | OpenAI-compatible API base URL, for example `https://api.deepseek.com/v1` or `https://opencode.ai/zen/v1`. A URL ending in `/v1` gets `/chat/completions` appended; a full `/chat/completions` URL is used as-is. A trailing slash is ignored; query strings and fragments are rejected. |
| `LLM_MODEL` | yes | — | Exact model id, for example `deepseek-v4.1-flash`. |
| `LLM_API_KEY` | yes | — | The provider key. This is the only accepted key variable. |
| `LLM_TIMEOUT_MS` | no | `120000` | Per-request timeout in milliseconds. |
| `LLM_MAX_RETRIES` | no | `3` | Retries after a retryable failure (`408`, `429`, `5xx`, timeout, network error). Set `0` to disable. |
| `LLM_EXTRA_HEADERS` | no | — | JSON object of additional request headers, for example `{"X-Org":"team"}`. It must not set `Authorization`. |

`LLM_API_KEY` is shown only as its first and last four characters
(`oc_s…DKIc`) in every tool output and log line.

`OPENCODE_API_KEY` is **deprecated (已弃用，请改名)**: rename it to
`LLM_API_KEY`. The tools warn when the old name is still present.

## Where the values come from

Resolution order, first non-empty value wins:

1. `process.env` (this is how CI supplies the values);
2. `<repository>/.env.local`;
3. `<workspace>/.env.local`, the repository's parent directory.

A value already present in `process.env` is never overwritten by a file. The
parser supports `KEY=VALUE`, `export KEY=VALUE`, `#` comment lines, single- and
double-quoted values, and trailing whitespace.

## GitHub Actions

Configure the values in the repository that runs the translation
(`mikrotik_manual_zh_hans`):

1. **Settings → Secrets and variables → Actions**;
2. **Variables** tab (not secret, visible in logs):
   - `LLM_BASE_URL`
   - `LLM_MODEL`
   - optional: `LLM_TIMEOUT_MS`, `LLM_MAX_RETRIES`, `LLM_EXTRA_HEADERS`
3. **Secrets** tab (masked):
   - `LLM_API_KEY`

The translation workflow must map them into the job environment, for example:

```yaml
env:
  LLM_BASE_URL: ${{ vars.LLM_BASE_URL }}
  LLM_MODEL: ${{ vars.LLM_MODEL }}
  LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
  LLM_TIMEOUT_MS: ${{ vars.LLM_TIMEOUT_MS }}
  LLM_MAX_RETRIES: ${{ vars.LLM_MAX_RETRIES }}
```

If a variable is empty, the tool does not fall back to a default endpoint or
model: `verify:llm --dry-run` and the translation run fail with the missing
name.

## Local use

```bash
cp .env.local.example .env.local
# fill in LLM_BASE_URL, LLM_MODEL and LLM_API_KEY
node tools/translate/verify-llm.mjs --dry-run
node tools/translate/verify-llm.mjs
```

`.env.local` is ignored by git in both repositories. Placing it at the
repository root and at the workspace root both work; the repository root wins
and `process.env` wins over both.

## Checking the connection

`npm run verify:llm -- --dry-run` validates the variables, the URL shape and the
numeric limits, prints the configuration with the key masked, and exits `0`
(or `1` with the missing names and the files it searched).

`npm run verify:llm` sends one minimal request (`把 hello 翻译成中文`,
`max_tokens: 32`), prints the masked base URL, the model, the HTTP status, the
elapsed time and the returned text.

| Result | Meaning and fix |
| --- | --- |
| `401` | `LLM_API_KEY` is invalid or revoked. Update the key. |
| `402` | The key is valid but the account has no balance. Top up with the provider. |
| `404` | Wrong endpoint or model: check `LLM_BASE_URL` (usually ending in `/v1`) and the exact `LLM_MODEL` id. |
| `429` | Rate limited: wait, use smaller batches, or raise `LLM_MAX_RETRIES`. |
| timeout | Raise `LLM_TIMEOUT_MS` or check network access to the provider. |
| missing variable | Set the name listed by the error in the environment, `<repo>/.env.local` or `<workspace>/.env.local`. |

## Repositories that need no LLM configuration

Only the repository that runs `tools/translate` needs `LLM_*`. The hub/content
repository and the English site build do not call the LLM, so they need no
variables or secrets; keep the key in the translation repository only.
