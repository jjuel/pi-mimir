# pi-mimir

Deep research tools for Pi.

Current slices:
- `oracle`: read-only advisory subagent with isolated in-process runtime and a matching `/oracle` slash command
- `librarian`: evidence-backed research subagent that combines local context with bounded public code and public web retrieval, plus `/librarian`
- `consult`: unified non-mutating entrypoint with deterministic routing, librarian-first synthesis, preserved evidence snapshots, partial-result handling, and `/consult`

## Installation

For now, install `pi-mimir` from git rather than npm.

### Install from GitHub

Install globally for all projects:

```bash
pi install git:github.com/<owner>/pi-mimir@v0.1.0
```

Install only for the current project:

```bash
pi install -l git:github.com/<owner>/pi-mimir@v0.1.0
```

If you use SSH for GitHub access:

```bash
pi install git:git@github.com:<owner>/pi-mimir@v0.1.0
```

You can inspect installed packages with:

```bash
pi list
```

### Local path install

To install directly from a local checkout:

```bash
pi install /absolute/path/to/pi-mimir
```

Or for the current project only:

```bash
pi install -l .
```

## Local development

Typecheck and run tests:

```bash
npm run check
```

Run only tests:

```bash
npm test
```

Load the package in Pi from the repo root without installing it permanently:

```bash
pi -e .
```

Pi loads the extension directly from TypeScript via the package manifest.

## Usage

These capabilities are available in two forms:

- as LLM-callable tools: `oracle`, `librarian`, `consult`
- as user-invoked slash commands: `/oracle`, `/librarian`, `/consult`

Examples:

```text
/oracle Review whether consult routing should stay in one runtime file.
/librarian Trace how consult is registered and cite the current code paths.
/consult Compare this extension with the Pi docs and recommend the best default entrypoint.
```

The slash commands are convenience wrappers over the same shared subagent runtimes used by the tools.
