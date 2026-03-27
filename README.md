# pi-mimir

`pi-mimir` is a deep-research extension for Pi.

It adds three research-oriented specialists to Pi:

- `consult` — the default entrypoint for a full investigation
- `librarian` — evidence gathering, citations, and research passes
- `oracle` — read-only analysis, judgment, and recommendations

## Why the name?

Mímir is a figure in Norse mythology associated with wisdom and knowledge. That maps well to what this package does:

- **Librarian** gathers knowledge
- **Oracle** turns that knowledge into advice
- **Consult** decides how to use them together and gives you one coherent answer

The name is meant to communicate: **this is the Pi package to use when you want careful investigation, evidence, and judgment rather than code changes.**

## What this extension is

`pi-mimir` is a **single Pi extension package** that registers:

- **three LLM-callable tools**: `consult`, `librarian`, `oracle`
- **three user-facing slash commands**: `/consult`, `/librarian`, `/oracle`

It is designed for research and advisory work inside Pi:

- investigating codebases
- tracing behavior through local files
- checking upstream libraries, public repos, and docs
- collecting evidence before making a recommendation
- producing structured answers that separate findings from advice

It is **not** a coding or mutation package. The extension is intentionally read-only and non-mutating from the user’s point of view.

## What each tool does

### `consult`

Use `consult` when you want the **default entrypoint**.

It is the default orchestrator. It can:

- route to `oracle`
- route to `librarian`
- run `librarian` first and then `oracle`
- return a single final answer with routing transparency and compact evidence

Use it for prompts like:

- “Investigate this feature and tell me what you think.”
- “Compare this implementation with upstream docs and recommend a direction.”
- “Review this plan and ground the recommendation in evidence.”

### `librarian`

Use `librarian` when you want **evidence-backed research**.

It is the specialist for:

- reading relevant local files
- looking at public code and public web sources
- preserving citations
- returning findings plus explicit evidence and limitations

Use it for prompts like:

- “Trace how this works and cite the code paths.”
- “Research how this library does X.”
- “Compare these implementations and show evidence.”

### `oracle`

Use `oracle` when you want **read-only advisory reasoning**.

It is the specialist for:

- design review
- debugging guidance
- architecture tradeoffs
- recommendations grounded in local context

Use it for prompts like:

- “Review this design and tell me the risks.”
- “Should we keep this architecture?”
- “Give me a second opinion on this implementation plan.”

## Key behavior

- **Non-mutating**: these tools are for investigation, not editing
- **Pi-native**: they run inside Pi as extension tools and commands
- **Model-aware**: they inherit the active Pi model and thinking level
- **Structured output**:
  - `oracle` returns conclusion, reasoning, risks, recommendation, limitations
  - `librarian` returns findings, evidence, citations, limitations
  - `consult` returns one unified answer plus routing and evidence snapshot
- **Partial / degraded handling**: if one stage fails or evidence is weak, the result should say so rather than pretending certainty

## Installation

For now, install `pi-mimir` from git rather than npm.

### Install from GitHub

Install globally for all projects:

```bash
pi install git:github.com/jjuel/pi-mimir@v0.1.0
```

Install only for the current project:

```bash
pi install -l git:github.com/jjuel/pi-mimir@v0.1.0
```

If you use SSH for GitHub access:

```bash
pi install git:git@github.com:jjuel/pi-mimir@v0.1.0
```

See installed packages:

```bash
pi list
```

### Install from a local checkout

```bash
pi install /absolute/path/to/pi-mimir
```

Current project only:

```bash
pi install -l .
```

### Load without installing permanently

From the repo root:

```bash
pi -e .
```

## Usage

You can use `pi-mimir` either as slash commands or as tools that Pi can call during an agent turn.

### Slash commands

Select a model first, if needed:

```text
/model
```

Then use:

```text
/consult <task>
/librarian <task>
/oracle <task>
```

Examples:

```text
/consult Compare this extension with the Pi docs and recommend the best default entrypoint.
/librarian Trace how consult is registered and cite the current code paths.
/oracle Review whether consult routing should stay in one runtime file.
```

### Direct tool usage

Use **`consult`** as the default entrypoint when you want one final answer and are not sure whether the task needs research, advice, or both.

Use **`librarian`** when you want evidence-backed research, citations, and code or documentation tracing.

Use **`oracle`** when you want read-only analysis, judgment, risks, tradeoffs, or recommendations.

Tool inputs support a required `task` field, plus optional focus fields depending on the tool:

- `oracle`: `task`, optional `files`, optional `constraints`
- `librarian`: `task`, optional `files`, optional `repos`, optional `constraints`
- `consult`: `task`, optional `files`, optional `repos`, optional `constraints`, optional `mode`

Notes:

- `files` are focus hints, not strict boundaries
- `repos` are soft hints, not a hard allowlist
- `consult` supports `automatic`, `oracle`, `librarian`, and `both` modes
- the package is for research and advisory work, not code mutation

## Local development

Typecheck and run tests:

```bash
npm run check
```

Run only tests:

```bash
npm test
```

