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
npm install
npm run build
```

For the default CDP browser strategy, start a visible Chrome instance:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.local/share/corivo-linkedin-chrome"
```

Log in to LinkedIn manually in that Chrome window before running the workflow.

## Commands

```bash
npm run dev -- run --mode scan --classifier-provider none
npm run dev -- run --mode prepare --max-prepared 5
npm run dev -- run --mode debug_send --allow-send-without-note
npm run dev -- report --latest
npm run dev -- inspect-candidate https://www.linkedin.com/in/example/
```

Use `classifier.provider="openai"` with a valid `OPENAI_API_KEY` to enable LLM classification. Use `classifier.provider="none"` for local dry runs that rely on conservative heuristics.

## Data

- SQLite: `data/linkedin-corivo-prospecting.sqlite`
- Audit JSONL: `data/linkedin-corivo-prospecting.audit.jsonl`
- Reports: `reports/linkedin-corivo-prospecting-<run-id>.md`

`data/` and `reports/` are ignored by git because they can contain personal LinkedIn browsing artifacts.

## Development

```bash
npm test
npm run typecheck
npm run build
```
