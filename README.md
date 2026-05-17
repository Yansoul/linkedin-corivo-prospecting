# LinkedIn Corivo Prospecting

Local operator-assisted LinkedIn prospecting automation for finding potential Corivo early users.

This tool is intentionally conservative. It is built for visible local runs with human supervision, not unattended mass outreach. By default it can prepare a connection dialog, but it does not click `Send without a note`.

## Safety Defaults

- `allowSendWithoutNote` defaults to `false`.
- `scan` mode performs no LinkedIn actions.
- `prepare` mode clicks `Connect` only for qualified candidates and stops at the final confirmation dialog.
- `debug_send` can click `Send without a note` only when `--allow-send-without-note` or equivalent config is explicitly set.
- Captcha, checkpoint, unusual activity, restriction, rate-limit, and account safety text stop the run.
- Every candidate, decision, warning, and action is persisted to SQLite and JSONL audit logs.

## Setup

```bash
pnpm install
```

The default browser strategy opens a visible persistent Chrome profile at `$HOME/.local/share/corivo-linkedin-chrome`. Log in to LinkedIn manually in that browser the first time it opens.

## Commands

```bash
pnpm dev
pnpm scan
pnpm report
pnpm dev --mode debug_send --allow-send-without-note
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
2. JSON config
3. `.env` / shell environment
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
