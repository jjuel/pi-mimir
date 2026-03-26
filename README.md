# pi-mimir

Deep research tools for Pi.

Current slice:
- `oracle`: read-only advisory subagent with isolated in-process runtime

Planned tools:
- `librarian`
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
