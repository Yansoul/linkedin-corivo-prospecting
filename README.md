# LinkedIn Corivo Prospecting

Local operator-assisted LinkedIn prospecting automation for finding potential Corivo early users.

This tool is built for visible local runs with human supervision, not unattended mass outreach. With operator permission, the default `pnpm dev` run can click `Send without a note` for candidates that pass classification.

## Safety Defaults

- `allowSendWithoutNote` defaults to `true`.
- `scan` mode performs no LinkedIn actions.
- `prepare` mode clicks `Connect` only for qualified candidates and stops at the final confirmation dialog.
- `debug_send` clicks `Send without a note` when a qualified candidate reaches the final confirmation dialog.
- Captcha, checkpoint, unusual activity, restriction, rate-limit, and account safety text stop the run.
- Every candidate, decision, warning, and action is persisted to SQLite and JSONL audit logs.

## Setup

```bash
pnpm install
```

The default browser strategy attaches to Chrome over the Chrome DevTools Protocol. Modern Chrome refuses remote debugging on the default profile directory, so the helper starts a dedicated visible Chrome profile for this tool. Log in to LinkedIn once in that window; the session is reused on later runs.

```bash
pnpm dev
```

By default the helper uses:

```text
Chrome user data dir: ~/.local/share/corivo-linkedin-chrome
Chrome profile: Default
Debug port: 9223
```

To use a different automation profile directory:

```bash
LINKEDIN_CORIVO_CHROME_USER_DATA_DIR="$HOME/.local/share/my-linkedin-profile" pnpm chrome
```

If port `9223` is already occupied:

```bash
LINKEDIN_CORIVO_CHROME_DEBUG_PORT=9224 pnpm chrome
```

Then set `"cdpPort": 9224` in `config/linkedin-corivo-prospecting.example.json`.

## Commands

```bash
pnpm dev
pnpm scan
pnpm report
pnpm chrome
pnpm dev --mode prepare
pnpm exec tsx src/cli.ts inspect-candidate https://www.linkedin.com/in/example/
```

Use `classifier.provider="openai"` with a valid OpenAI API key to enable LLM classification. Use `classifier.provider="none"` for local dry runs that rely on conservative heuristics.

## OpenAI Configuration

The CLI automatically reads `.env` from the project root before loading config.

Create `.env`:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4-mini
OPENAI_FAST_MODE=false
```

Priority order is:

1. CLI flags
2. `.env` / shell environment
3. JSON config
4. built-in defaults

Equivalent CLI flags:

```bash
pnpm dev \
  --openai-api-key "$OPENAI_API_KEY" \
  --openai-base-url "https://api.openai.com/v1" \
  --openai-model "gpt-5.4-mini"
```

Fast mode:

```bash
pnpm dev --fast
pnpm dev --no-fast
```

`--fast` sends `reasoning.effort="minimal"` to the OpenAI Responses API. `--no-fast` leaves reasoning unset and uses the selected model's default behavior.

## Data

- SQLite: `data/linkedin-corivo-prospecting.sqlite`
- Audit JSONL: `data/linkedin-corivo-prospecting.audit.jsonl`
- Reports: `reports/linkedin-corivo-prospecting-<run-id>.md`

`data/` and `reports/` are ignored by git because they can contain personal LinkedIn browsing artifacts.

## Development

```bash
pnpm test
pnpm typecheck
pnpm build
```
