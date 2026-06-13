# ts-test-weaver

AI-powered test generator and fixer for TypeScript/React codebases.

`weave-tests` scans a repo, detects its existing testing conventions (Jest vs
Vitest, `.test` vs `.spec`, colocated vs `__tests__` vs a mirrored `tests/`
tree, React Testing Library / MSW / jest-dom usage), extracts AST context for
each source file (component props, hook signatures, exported functions,
JSDoc) with [ts-morph](https://ts-morph.com/), and asks Claude to generate or
fix test files — writing the result into a directory structure that mirrors
the source layout. A bounded repair loop runs `tsc --noEmit` and the test
runner after each write, feeding any errors back to the AI until the test
passes or attempts run out.

## Install

```bash
npm install
npm run build
```

This produces the `weave-tests` CLI at `dist/cli.js` (also exposed as the
`weave-tests` bin via `package.json`).

## Quick start

```bash
export ANTHROPIC_API_KEY=sk-ant-...

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
| `--model <name>` | Anthropic model id |
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
  "model": "claude-sonnet-4-6",
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
   repo, if any), coverage hints, and your custom prompt; call Claude.
7. **Validate + repair** — write the file, run `tsc --noEmit` and the single
   test file through the project's test runner; on failure, send the error
   output back to the AI and retry (up to `--fix-loop-attempts`).
8. **Report** — write `.weaver/manifest.json` (resumable state) and
   markdown/JSON run reports under `.weaver/reports/`.

## Security notes

- `ANTHROPIC_API_KEY` is read **only** from the environment — never accepted
  via CLI flag or `.weaverc.json`, so it can't leak into shell history or a
  committed config file.
- The key is stripped from the environment of every subprocess spawned in the
  target repo (`tsc`, the test runner, `git`).
- Full source/prompts/AI responses are never logged by default — only with
  `--verbose`, and they're excluded from run reports regardless.

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
