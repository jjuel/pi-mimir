# pi-mimir

Deep research tools for Pi.

Current slices:
- `oracle`: read-only advisory subagent with isolated in-process runtime
- `librarian`: evidence-backed research subagent that combines local context with bounded public code and public web retrieval
- `consult`: unified non-mutating entrypoint with forced routing modes for oracle, librarian, both, or automatic

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
