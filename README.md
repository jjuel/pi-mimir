# pi-mimir

Deep research tools for Pi.

Current slices:
- `oracle`: read-only advisory subagent with isolated in-process runtime
- `librarian`: local-context research subagent with evidence-backed findings

Planned tools:
- `consult`

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
