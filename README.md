# pi-mimir

Deep research tools for Pi.

Current slices:
- `oracle`: read-only advisory subagent with isolated in-process runtime and a matching `/oracle` slash command
- `librarian`: evidence-backed research subagent that combines local context with bounded public code and public web retrieval, plus `/librarian`
- `consult`: unified non-mutating entrypoint with deterministic routing, librarian-first synthesis, preserved evidence snapshots, partial-result handling, and `/consult`

## Local development

Typecheck and run tests:

```bash
npm run check
```

Run only tests:

```bash
npm test
```

Load the package in Pi from the repo root:

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
