## Problem Statement

Pi is intentionally barebones, which is a strength in many workflows, but it leaves a gap for users who want a dedicated deep-research capability inside their coding agent. Today, a Pi user can manually ask questions, use web search, fetch pages, and inspect code, but there is no opinionated research workflow that says: **go investigate this thoroughly, collect evidence, and then tell me what you think**.

This gap is especially painful for users who want an Amp-style specialist-subagent experience inside Pi. They want longer-running, more deliberate, research-oriented investigation that can look across local context, public code, and public web sources, then synthesize the findings into a thoughtful answer. They do not primarily want a code-writing feature here. They want a tool that is optimized for research, evidence gathering, and judgment.

The absence of this capability means Pi users must:
- manually orchestrate multi-step investigations,
- repeatedly restate the difference between evidence gathering and reasoning,
- manually inspect and preserve citations,
- choose tools ad hoc without a stable research workflow,
- and accept answers that may be less structured, less evidence-backed, or less thorough than desired.

Pi users need a first-class extension that provides deep research as a product, not just a collection of low-level primitives.

## Solution

Build **pi-mimir**, a Pi extension that adds three first-class research-oriented tools:
- **consult** — the recommended default starting point for broad investigations,
- **librarian** — a specialist research subagent for evidence gathering and citation-backed findings,
- **oracle** — a specialist reasoning subagent for synthesis, judgment, review, and recommendation.

The core experience should feel like this:

> Ask Pi to investigate something thoroughly, let it gather evidence from relevant public and local sources, and then receive a well-structured answer that explains what was found and what the system thinks about it.

The tools should be optimized for information work rather than code mutation. In v1:
- `consult` orchestrates research and reasoning,
- `librarian` focuses on research and evidence,
- `oracle` focuses on synthesis and advisory judgment,
- all tools are non-mutating from the user’s perspective,
- and all tools inherit the currently active Pi model and thinking level by default.

The extension should support both explicit user invocation and autonomous invocation by the model, but with clear descriptions and stable contracts so the behavior stays understandable.

The result should be a Pi-native deep research workflow that is:
- longer-running and more autonomous than normal prompting,
- better at collecting and preserving evidence,
- better at structuring findings and recommendations,
- and still honest about uncertainty, degraded modes, and partial results.

## User Stories

1. As a Pi user, I want to ask one tool to investigate a topic thoroughly, so that I do not have to manually orchestrate search, retrieval, and reasoning myself.
2. As a Pi user, I want a default research entry point, so that I know how to start a deep investigation without deciding between several lower-level tools first.
3. As a Pi user, I want specialist tools for research and reasoning, so that I can invoke them directly when I know exactly what kind of help I want.
4. As a Pi user, I want the system to gather evidence before forming a recommendation, so that the final answer is grounded rather than purely speculative.
5. As a Pi user, I want the system to read relevant local files when needed, so that research can be grounded in my current project context.
6. As a Pi user, I want the system to investigate public code and public web sources, so that I can learn from upstream libraries, public repos, docs, and other relevant sources.
7. As a Pi user, I want the research tool to perform multiple retrieval passes when necessary, so that it can go beyond shallow one-shot searching.
8. As a Pi user, I want research passes to be bounded internally, so that investigations remain controlled and do not spiral indefinitely.
9. As a Pi user, I want the reasoning tool to stay read-only, so that I can trust it as an advisory agent rather than a hidden editor.
10. As a Pi user, I want the research tool to stay non-mutating, so that asking for information never accidentally changes my workspace.
11. As a Pi user, I want the orchestration tool to remain non-mutating, so that “investigate this” never silently becomes “implement this.”
12. As a Pi user, I want the tools to inherit my current model and thinking level, so that they work with whatever provider and authentication setup I already have.
13. As a Pi user, I want the final answer to include evidence and citations, so that I can inspect sources and verify claims.
14. As a Pi user, I want the evidence section to remain present even after synthesis, so that source traceability is not lost in a polished answer.
15. As a Pi user, I want the system to state clearly when evidence is weak or incomplete, so that I can calibrate my trust appropriately.
16. As a Pi user, I want the system to distinguish evidence-backed findings from reasoning-based recommendations, so that I know what is observed versus inferred.
17. As a Pi user, I want partial success to still produce useful output, so that a failed reasoning or retrieval stage does not waste the work that already succeeded.
18. As a Pi user, I want degraded behavior to be clearly labeled, so that I know when the system fell back to weaker investigation modes.
19. As a Pi user, I want the system to prefer local-context-only investigation when that is enough, so that it stays fast and focused when external research is unnecessary.
20. As a Pi user, I want to provide focus hints such as relevant files, so that the tools can concentrate on the most important local context quickly.
21. As a Pi user, I want to provide likely repositories to investigate, so that remote research can start from the most relevant sources first.
22. As a Pi user, I want those repository hints to be helpful but not rigid, so that the tool can still widen the search when needed.
23. As a Pi user, I want to provide constraints such as “do not suggest schema changes” or “analysis only,” so that the output respects my working boundaries.
24. As a Pi user, I want `consult` to support a simple routing override, so that I can force oracle-only, librarian-only, both, or automatic behavior when debugging or steering the workflow.
25. As a Pi user, I want the tools to stream progress while they work, so that I can see that the investigation is active and understand what phase it is in.
26. As a Pi user, I want to see rich progress rather than just a spinner, so that I can observe phase transitions, evidence discovery, and research depth.
27. As a Pi user, I want `oracle` output to be structured into conclusion, reasoning, risks, and recommendation, so that its advisory output is easy to consume.
28. As a Pi user, I want `librarian` output to be structured into findings and evidence, so that research output is useful even without an additional reasoning pass.
29. As a Pi user, I want `consult` output to be a single coherent final answer, so that I get a polished result rather than a raw transcript of multiple subagents.
30. As a Pi user, I want `consult` to remain transparent about which specialist tools were used, so that the answer remains inspectable and debuggable.
31. As a Pi user, I want the extension to work for broad Pi use cases, not just one person’s local workflow, so that it can become a generally useful package for other Pi users.
32. As a Pi user, I want the extension to feel inspired by Amp-style subagents without being a shallow clone, so that capability matters more than imitation.
33. As a Pi user, I want all three tools to feel independently useful in v1, so that none of them feels like a placeholder or internal-only API.
34. As a Pi user, I want the deep research experience to be better than manually invoking basic search and fetch tools, so that the extension provides real workflow value rather than repackaging primitives.
35. As a Pi user, I want the research workflow to stay primarily informational, so that I can use it for exploration, learning, diagnosis, and planning rather than implementation.
36. As a Pi user, I want the extension to behave predictably when one stage fails, so that I can trust it in real work instead of fearing brittle all-or-nothing behavior.
37. As a Pi user, I want the extension to preserve useful details in structured metadata, so that future UI improvements and debugging views can be built without changing the user-facing contract.
38. As a Pi user, I want the extension to be greenfield-friendly, so that it can be developed cleanly without legacy compromises in the initial implementation.

## Implementation Decisions

- The product will be delivered as a **single extension package** named `pi-mimir`.
- The extension will expose **three first-class tools**: `consult`, `librarian`, and `oracle`.
- The tools are intended for both **explicit user invocation** and **autonomous model invocation**.
- The system is primarily a **deep research product**, not a code-generation or code-mutation product.
- `consult` is the recommended default starting point, but all three tools must be independently useful in v1.
- `oracle` and `librarian` will be implemented as **true subagents with isolated context** rather than simple inline helper functions.
- Subagents will run via **in-process Pi SDK sessions** rather than spawned CLI subprocesses.
- Subagents will **inherit the parent session’s currently active model and thinking level by default**.
- `oracle` is **read-only** in v1.
- `librarian` is **non-mutating** and can read both local context and public remote sources.
- `consult` is **non-mutating** and acts as an orchestration and synthesis layer.
- `librarian` in v1 will support investigation across **local context, public web sources, and public code sources**, with private-repo support explicitly deferred.
- `librarian` must support **multiple retrieval passes** in v1.
- Iterative research must be bounded by **internal hard caps** on things such as passes, sources, and/or total effort. These caps are implementation details and are not user-configurable in v1.
- `librarian` should be optimized for **thoroughness within bounded limits**, not merely fast shallow retrieval.
- `oracle` should be optimized for **careful structured analysis**, not short casual advice.
- `consult` will use **heuristic routing** in v1 rather than model-routed planning to decide between oracle-only, librarian-only, or librarian-then-oracle behavior.
- When both specialist tools are used, the order is **always librarian first, oracle second** in v1.
- `oracle` must not invoke `librarian` internally in v1.
- `librarian` must not invoke `oracle` internally in v1.
- `consult` should avoid invoking `librarian` when local context appears sufficient.
- `consult` must support a simple routing override via a `mode` field with automatic and forced modes.
- All three tools will take a required top-level `task` field.
- `oracle` and `librarian` will both accept optional `files` hints.
- The `files` field is a **focus hint**, not a strict scope boundary.
- `librarian` will accept an optional `repos` field for remote research narrowing.
- The `repos` field is a **soft preference**, not a hard allowlist.
- `consult` will also accept optional `files` and `repos` so callers do not need to drop down to lower-level tools merely to provide focus hints.
- All three tools will support an optional `constraints` field.
- v1 will not include an explicit structured answer-style field; output style will instead be determined by the tool role, system guidance, and caller instructions.
- The tools will stream **rich progress updates**, including visible phase changes and meaningful status, not just final output.
- `oracle` output must be structured around ideas such as conclusion, reasoning, risks, and recommendation.
- `librarian` output must be structured around findings plus explicit evidence/citations.
- `consult` output must be a **single unified polished answer** that still preserves compact evidence and process transparency.
- All tools will return natural-language content plus **structured metadata** for rendering, observability, and future UI improvements.
- Degraded mode is a first-class part of the design:
  - if remote research is unavailable, `librarian` degrades to local-read-only investigation,
  - if `consult` cannot complete one stage, it may still return partial results,
  - if evidence is weak, that weakness must be stated explicitly,
  - and any degraded or partial mode must be clearly labeled.
- Partial results are considered a valid success mode when clearly identified.
- The proposed major modules are:
  - a tool-surface module for the three public tool contracts,
  - a subagent runtime module,
  - a consult routing module,
  - a research module,
  - an evidence/citation module,
  - a prompt/role-definition module,
  - and a rendering/result-presentation module.
- The deepest and most reusable modules should be the **subagent runtime**, **research**, and **evidence/citation** modules.
- The implementation is greenfield, so the architecture should be optimized for clarity and testability rather than compatibility with prior package structure.

## Testing Decisions

- A good test should validate **external behavior and stable contracts**, not internal implementation details.
- Tests should focus on observable outcomes such as routing choices, degraded behavior, evidence preservation, structured outputs, and subagent behavior under defined conditions.
- Tests should avoid coupling to exact wording except where wording is itself part of the contract, such as the presence of required sections or degraded-mode labeling.
- Tests should not depend on live external services for correctness. Mocked or fixture-based inputs should be preferred for determinism.
- The following modules will receive explicit tests in v1:
  - **Routing Module** — to verify deterministic consult routing behavior, fallback decisions, and handling of mode overrides.
  - **Evidence/Citation Module** — to verify citation normalization, evidence preservation, compact evidence rendering, and uncertainty labeling.
  - **Subagent Runtime Module** — to verify inheritance of model/thinking context, role isolation, progress streaming behavior, and degraded/partial execution handling.
  - **Research Module** — to verify iterative retrieval behavior, budget boundaries, local-plus-remote investigation behavior, and degraded fallback paths using mocks/fixtures.
- Prior art for tests should favor the kinds of tests already common in Pi-style systems:
  - behavior-level tests for routing and orchestration,
  - schema/contract tests for tool outputs,
  - deterministic fixture tests for research normalization,
  - and isolated unit tests for reusable deep modules.
- Rendering-specific tests are lower priority than behavior and contract tests in v1.
- Network-heavy integration tests, if added later, should be supplemental and not the main proof of correctness.

## Out of Scope

- Private repository support in v1.
- Arbitrary authenticated remote systems in v1.
- Code mutation by `oracle`, `librarian`, or `consult` in v1.
- Turning `pi-mimir` into a general implementation agent or coding workflow package.
- Replicating Amp feature-for-feature.
- User-configurable research budgets in v1.
- Strict repository allowlists or strict file allowlists in v1.
- Dynamic model selection policies that override the user’s current active model by default.
- Hidden recursive invocation between `oracle` and `librarian` in v1.
- Overly broad formatting controls or style knobs in the public contract.
- Deep enterprise/private-source integration in the initial release.

## Further Notes

- The guiding product sentence for the extension is:
  - **“Go investigate this thoroughly, collect evidence, and then tell me what you think.”**
- The extension should be useful to Pi users generally, not only to one individual workflow.
- The design is inspired by the feel of Amp-style specialist subagents, but the goal is to deliver capability, not imitation.
- Although `consult` is the recommended default starting point, the product should treat `consult`, `librarian`, and `oracle` as three first-class tools that all matter in v1.
- The repository is currently greenfield, which makes this a good opportunity to establish deep, testable modules and clean public contracts from the start.
