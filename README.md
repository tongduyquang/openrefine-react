# ts-test-weaver

AI-powered test generator and fixer for TypeScript/React codebases.

`weave-tests` scans a repo, detects its existing testing conventions (Jest vs
Vitest, `.test` vs `.spec`, colocated vs `__tests__` vs a mirrored `tests/`
tree, React Testing Library / MSW / jest-dom usage), extracts AST context for
each source file (component props, hook signatures, exported functions,
JSDoc) with [ts-morph](https://ts-morph.com/), and asks an AI model to generate
or fix test files — writing the result into a directory structure that mirrors
the source layout. A bounded repair loop runs `tsc --noEmit` and the test
runner after each write, feeding any errors back to the AI until the test
passes or attempts run out.

Two AI backends are supported: **Anthropic** (Claude) and the **GitHub Models
API** (OpenAI-compatible, authenticated with a GitHub token — handy if you
don't have an Anthropic account). See [AI providers](#ai-providers).

## Install

```bash
npm install
npm run build
```

This produces the `weave-tests` CLI at `dist/cli.js` (also exposed as the
`weave-tests` bin via `package.json`).

## Quick start

```bash
# Pick ONE backend:
export ANTHROPIC_API_KEY=sk-ant-...        # Anthropic (default), or:
export GITHUB_MODELS_TOKEN=github_pat_...  # GitHub Models (use --provider github)

# 1. Detect conventions and scaffold .weaverc.json in the target repo
node dist/cli.js init --repo /path/to/your-repo

# 2. See what would be generated, without calling the AI
node dist/cli.js generate --repo /path/to/your-repo --plan-only

# 3. Preview AI output as diffs, without writing anything
node dist/cli.js generate --repo /path/to/your-repo --dry-run \
  --prompt "Use describe/it blocks named after user stories. Avoid snapshot tests."

# 4. Generate (and validate/fix) test files for real
node dist/cli.js generate --repo /path/to/your-repo \
  --prompt-file ./test-style-guide.md

# ...or run it against the free GitHub Models API instead of Anthropic
node dist/cli.js generate --repo /path/to/your-repo \
  --provider github --model openai/gpt-4o
```

## Input / output contract

- **Input 1 — `--repo <path>`**: path to the repo containing source files
  that need tests (defaults to the current directory).
- **Input 2 — `--prompt <text>` / `--prompt-file <path>`**: free-form
  instructions for the AI describing the structure/conventions you want
  generated test files to follow (e.g. naming, fixture helpers, provider
  wrappers, snapshot policy). This text is given to the AI **verbatim and
  with precedence** over the tool's built-in guidance.
- **Output**: new/updated `*.test.ts(x)` (or `*.spec.ts(x)`) files written
  into a directory structure mirroring the source files under test, following
  the target repo's detected (or configured) conventions.

## CLI reference

### `weave-tests generate`

| Option | Description |
| --- | --- |
| `-r, --repo <path>` | Target repo path (default: `.`) |
| `-p, --prompt <text>` | Inline custom AI instructions |
| `-P, --prompt-file <path>` | File with custom AI instructions (overrides `--prompt`) |
| `-i, --include <globs...>` | Include globs (default: `src/**/*.{ts,tsx}`) |
| `-e, --exclude <globs...>` | Additional exclude globs (merged with built-in defaults) |
| `-f, --file <paths...>` | Target specific file(s) only |
| `--git-diff [base]` | Only target files changed vs `<base>` (default `origin/main`) |
| `--fix-existing` | Also re-check/update existing test files for changed sources |
| `--coverage <path>` | Istanbul/v8 coverage JSON for gap prioritization |
| `--coverage-threshold <n>` | Skip files already ≥ this % covered (default 80) |
| `--dry-run` | Compute AI output and show diffs without writing files |
| `--plan-only` | Show the plan (files/order) without calling the AI |
| `--max-files <n>` | Cap the number of files processed |
| `--fix-loop-attempts <n>` | Max AI repair iterations per file (default 3) |
| `--skip-validation` | Skip the `tsc`/test-runner validation loop |
| `--resume` | Resume from `.weaver/manifest.json`, skipping already-passed files |
| `--provider <name>` | AI backend: `anthropic` (default) or `github` (GitHub Models API) |
| `--model <name>` | Model id (provider-specific; e.g. `claude-sonnet-4-6` or `openai/gpt-4o`) |
| `--report-dir <path>` | Directory for run reports (default `.weaver/reports`) |
| `--json` | Emit a machine-readable JSON summary to stdout |
| `-v, --verbose` / `--quiet` | Logging verbosity |

### `weave-tests init`

Detects conventions in `--repo` and writes a `.weaverc.json` (plus adds
`.weaver/` to `.gitignore`). Pass `--yes` to overwrite an existing config.

## Configuration (`.weaverc.json`)

Precedence is **CLI flags > `.weaverc.json` > auto-detected conventions >
built-in defaults**.

```jsonc
{
  "include": ["src/**/*.{ts,tsx}"],
  "exclude": ["src/legacy/**"],
  "provider": "anthropic",        // or "github"
  "model": "claude-sonnet-4-6",   // or e.g. "openai/gpt-4o" for the github provider
  "fixLoopAttempts": 3,
  "coverageThreshold": 80,
  "skipValidation": false,
  "conventions": {
    "framework": "vitest",
    "testFileSuffix": ".test",
    "testLocation": "colocated",
    "testsRootDir": "tests",
    "srcRootDir": "src",
    "usesReactTestingLibrary": true,
    "usesMsw": false,
    "usesJestDom": true
  }
}
```

Any field under `conventions` overrides auto-detection for just that field —
useful when a repo has mixed conventions and you want generated files to
follow one consistently.

## AI providers

Select the backend with `--provider` (or the `provider` field in
`.weaverc.json`, or the `WEAVER_PROVIDER` env var). The default is `anthropic`.

### `anthropic` (default)

- **Credential:** `ANTHROPIC_API_KEY` (env only).
- **Default model:** `claude-sonnet-4-6`. Override with `--model` / `WEAVER_MODEL`.

### `github` — GitHub Models API

Uses the OpenAI-compatible [GitHub Models](https://docs.github.com/en/github-models)
inference endpoint (`https://models.github.ai/inference`). Useful if you don't
have an Anthropic account — GitHub offers a free tier (with rate limits).

- **Credential:** a GitHub token with the **`models: read`** permission, read
  from `GITHUB_MODELS_TOKEN` (preferred) or `GITHUB_TOKEN` (env only). Create a
  fine-grained personal access token at
  *Settings → Developer settings → Personal access tokens* and grant it the
  *Models* permission.
- **Default model:** `openai/gpt-4o`. Models use a `publisher/model` name;
  override with `--model`, e.g. `openai/gpt-4o-mini`,
  `meta/Llama-3.3-70B-Instruct`, or `deepseek/DeepSeek-V3`.
- **Endpoint override:** set `GITHUB_MODELS_BASE_URL` to use a compatible
  endpoint (e.g. the Azure AI inference URL).

```bash
export GITHUB_MODELS_TOKEN=github_pat_...
node dist/cli.js generate --repo /path/to/your-repo \
  --provider github --model openai/gpt-4o \
  --prompt "Prefer getByRole queries; one describe block per exported symbol."
```

> The GitHub Models free tier has lower rate/output limits than a paid
> Anthropic key. For large repos, use `--max-files` and/or `--fix-loop-attempts 1`
> to stay within limits.

## How a run works

1. **Scan** — discover candidate source files via include/exclude globs,
   `--file`, or `--git-diff`.
2. **Detect conventions** — Jest/Vitest, `.test`/`.spec`, file location, RTL
   /MSW/jest-dom usage (skipped per-field if pinned in `.weaverc.json`).
3. **Analyze** — ts-morph extracts exported components/hooks/functions, props,
   JSDoc, and imports for each file.
4. **Coverage prioritization** *(optional)* — annotate files with coverage %,
   drop files already above `--coverage-threshold` (unless `--fix-existing`),
   and order the rest with the least-covered files first.
5. **Plan** — build an ordered list of `generate` (new test file) and `fix`
   (update existing test file, with `--fix-existing`) tasks. With `--resume`,
   tasks already marked `pass` in `.weaver/manifest.json` are skipped.
6. **Prompt + generate** — for each task, assemble a prompt from the AST
   context, a few-shot example (the most similar existing test file in the
   repo, if any), coverage hints, and your custom prompt; call the selected
   AI provider.
7. **Validate + repair** — write the file, run `tsc --noEmit` and the single
   test file through the project's test runner; on failure, send the error
   output back to the AI and retry (up to `--fix-loop-attempts`).
8. **Report** — write `.weaver/manifest.json` (resumable state) and
   markdown/JSON run reports under `.weaver/reports/`.

## Security notes

- API credentials (`ANTHROPIC_API_KEY`, `GITHUB_MODELS_TOKEN`, `GITHUB_TOKEN`)
  are read **only** from the environment — never accepted via CLI flag or
  `.weaverc.json`, so they can't leak into shell history or a committed config.
- Those credentials are stripped from the environment of every subprocess
  spawned in the target repo (`tsc`, the test runner, `git`). Note: this means
  `GITHUB_TOKEN` is not visible to your test suite during the validation run.
- Full source/prompts/AI responses are never logged by default — only with
  `--verbose`, and they're excluded from run reports regardless.
- Generating tests sends your source code to the selected provider's API
  (Anthropic or GitHub). Use `--plan-only` (no AI call) or `--dry-run` to
  preview without writing, and review each provider's data-use terms.

## Example project

`examples/sample-app/` is a minimal React 19 + Vite + Vitest + React Testing
Library project with a `@/*` → `src/*` path alias, used by this tool's own
test suite. It has one component with a colocated test (`Greeting`, the
few-shot style reference) and three untested targets (`Counter` component,
`useToggle` hook, `formatCurrency` util):

```bash
cd examples/sample-app
npm install
npm test
```

## Development

```bash
npm run dev -- generate --repo examples/sample-app --plan-only   # run from source via tsx
npm run typecheck
npm test          # this tool's own unit + integration test suite (vitest)
npm run build
```
