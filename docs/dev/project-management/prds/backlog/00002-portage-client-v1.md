---
catchup: force
rework_cap: 5
design: run
---

# PRD: Portage client and compatibility fixture gate

## Problem Statement

Agent Plugins 1.0 gives the planned monorepo a portable package layout, but stock Claude Code does not load that layout. Building the eight-plugin migration before proving the compatibility shape would risk committing to a tree that either Claude Code or `npx plugins` cannot consume. The first unit of work must therefore prove a hand-written fixture, then provide a stdlib-only provisional Claude client that validates spec packages and deterministically emits the small committed Claude shim.

## Target Users

- The solo maintainer, who needs one offline command to explain package violations and prevent stale shims.
- PRD 00003, which needs a proven package layout and validator before migrating live plugins.
- CI, which needs deterministic validation without network access or a runtime schema dependency.

## Success Metrics

- `dev/bin/fixture-gate` installs the fixture from a local marketplace into an isolated stock Claude Code profile, proves its hook fires, and proves `npx plugins discover` lists it exactly once before production Portage code is implemented.
- `python3 plugins/portage/scripts/portage.py validate <fixture>` accepts every valid fixture and exits non-zero with a named violation for every invalid fixture.
- `emit` reproduces the committed Claude shim byte-for-byte and `check` fails on any drift.
- The complete pytest suite passes on Python 3.10+ with no Portage runtime dependency outside the standard library.

## Capability Tree

### Capability: Compatibility proof

Establish that one spec-first package can be consumed by both stock Claude Code and the cross-client installer.

#### Feature: Claude local-marketplace fixture gate
- **Description**: Install a hand-written spec-layout fixture with a committed Claude shim into an isolated local marketplace and prove a fixture hook executes.
- **Inputs**: Fixture package, local marketplace manifest, stock `claude` executable, isolated Claude configuration directory.
- **Outputs**: Zero exit status and captured evidence that installation succeeded and the known fixture hook fired.
- **Behavior**: Run before Portage implementation; stop the PRD if Claude rejects unknown root files, custom component paths, or the shim shape.

#### Feature: Cross-client discovery uniqueness gate
- **Description**: Prove the same fixture is discovered once, not once per portable or namespaced component tree.
- **Inputs**: Fixture repository and `npx plugins discover`.
- **Outputs**: A normalized discovery list containing exactly one fixture identity.
- **Behavior**: Fail on zero matches, duplicate matches, or fallback discovery of `com.anthropic.claude-code/` as a second plugin.

### Capability: Offline package validation

Validate Agent Plugins 1.0 packages without importing a schema library or accessing the network.

#### Feature: Manifest and schema selection validation
- **Description**: Select the vendored 1.0.0 rules from `$schema` and enforce the closed `plugin.json` manifest.
- **Inputs**: Named plugin directory, root `plugin.json`, vendored 1.0.0 schema files.
- **Outputs**: Success or ordered diagnostics and non-zero status.
- **Behavior**: Validate required fields and nested author fields; report then ignore unknown top-level fields for continued analysis; reject unsupported or unresolvable schema versions without fetching them.

#### Feature: Fixed-location component discovery
- **Description**: Discover portable skills and Claude namespaced content only from their defined package locations.
- **Inputs**: Validated package root, `skills/`, and `extensions` metadata.
- **Outputs**: Isolated component results without traversal outside the package.
- **Behavior**: Treat missing locations as valid absence, ignore non-object `extensions` and unknown namespaces, isolate invalid skills, and reject lexical or symlink escapes.

#### Feature: Agent Skills conformance
- **Description**: Validate each discovered skill against the Agent Skills name, description, and directory-match rules.
- **Inputs**: `skills/<name>/SKILL.md` files and their YAML frontmatter.
- **Outputs**: Per-skill diagnostics while continuing across sibling skills.
- **Behavior**: A malformed skill fails package validation but does not prevent diagnostics for other skills.

#### Feature: Explicit MCP deferral
- **Description**: Make unsupported MCP handling visible rather than silently accepting an unvalidated server definition.
- **Inputs**: Optional root `mcp.json`.
- **Outputs**: Named unsupported-component diagnostic.
- **Behavior**: A present `mcp.json` is reported as unsupported and causes validation failure; no MCP schema, placeholder, or server validation is claimed in v1.

### Capability: Claude shim generation

Produce the only generated compatibility artifact and detect drift in CI.

#### Feature: Deterministic shim emission
- **Description**: Write `.claude-plugin/plugin.json` using portable manifest metadata and existing Claude-only component directories.
- **Inputs**: Valid plugin manifest and optional `com.anthropic.claude-code/{hooks,commands,agents}/` directories.
- **Outputs**: Formatted shim containing name, version, description, author, and only the component path fields whose directories exist.
- **Behavior**: Never copy a component tree, never point outside the package, and produce identical bytes for identical input.

#### Feature: Committed-shim drift check
- **Description**: Compare the committed shim with the bytes `emit` would produce without modifying the package.
- **Inputs**: Plugin directory and committed `.claude-plugin/plugin.json`.
- **Outputs**: Zero status when current; non-zero status plus a readable diff when stale or absent.
- **Behavior**: Reuse validation and emission logic so `check` cannot diverge from `emit`.

### Capability: Maintainer interface and verification

Expose the client consistently to humans, Claude sessions, and CI.

#### Feature: Portage command-line interface
- **Description**: Provide `validate`, `emit`, and `check` from the required Python entry point.
- **Inputs**: One subcommand and one named plugin directory.
- **Outputs**: Concise human-readable diagnostics on stderr/stdout and conventional exit status.
- **Behavior**: Resolve paths relative to the caller, avoid network access, and keep command failures deterministic.

#### Feature: Portage skill
- **Description**: Teach a Claude session to run `validate` or `check` on a named plugin and explain each violation.
- **Inputs**: User intent and plugin directory.
- **Outputs**: Executed Portage command plus a concise explanation grounded in its diagnostics.
- **Behavior**: The skill does not hand-wave validation or claim MCP support.

#### Feature: Conformance and golden suite
- **Description**: Encode every in-scope client checklist item as valid and invalid pytest fixtures, including golden shim shape.
- **Inputs**: Fixture packages, expected diagnostics, expected shim files.
- **Outputs**: Deterministic pytest and CI results.
- **Behavior**: Add a regression fixture for every validator or emitter bug and keep network-dependent compatibility gates separate from unit tests.

## Repository Structure

```text
agent-plugins/
├── .github/workflows/ci.yml
├── dev/bin/fixture-gate
├── plugins/portage/
│   ├── plugin.json
│   ├── .claude-plugin/plugin.json
│   ├── CHANGELOG.md
│   ├── README.md
│   ├── schemas/1.0.0/
│   ├── skills/portage/SKILL.md
│   ├── scripts/portage.py
│   └── lib/portage/
│       ├── __init__.py
│       ├── cli.py
│       ├── diagnostics.py
│       ├── manifest.py
│       ├── discovery.py
│       ├── skills.py
│       └── shim.py
├── tests/
│   ├── fixtures/
│   │   ├── compatibility-marketplace/
│   │   ├── compatibility-plugin/
│   │   ├── valid/
│   │   └── invalid/
│   ├── golden/
│   ├── test_manifest.py
│   ├── test_discovery.py
│   ├── test_skills.py
│   ├── test_shim.py
│   └── test_cli.py
└── pyproject.toml
```

## Module Definitions

### Module: Compatibility Fixture Gate
- **Maps to capability**: Compatibility proof
- **Responsibility**: Prove the selected dual-layout package before Portage production code exists.
- **File structure**:
  ```text
  dev/bin/fixture-gate
  tests/fixtures/compatibility-marketplace/
  tests/fixtures/compatibility-plugin/
  ```
- **Exports**:
  - `dev/bin/fixture-gate` - runs both isolated compatibility assertions and returns a gate status.

### Module: Diagnostics
- **Maps to capability**: Offline package validation
- **Responsibility**: Collect, order, render, and assign exit semantics to violations without aborting sibling checks.
- **File structure**:
  ```text
  plugins/portage/lib/portage/diagnostics.py
  ```
- **Exports**:
  - `Diagnostic` - internal violation record.
  - `render_diagnostics()` - deterministic human-readable output.

### Module: Manifest Validator
- **Maps to capability**: Offline package validation
- **Responsibility**: Load vendored version rules and validate the closed portable manifest.
- **File structure**:
  ```text
  plugins/portage/schemas/1.0.0/
  plugins/portage/lib/portage/manifest.py
  ```
- **Exports**:
  - `validate_manifest()` - returns validated manifest data and diagnostics.

### Module: Component Discovery
- **Maps to capability**: Offline package validation
- **Responsibility**: Enforce fixed locations, package containment, extension ignoring, and per-skill isolation.
- **File structure**:
  ```text
  plugins/portage/lib/portage/discovery.py
  plugins/portage/lib/portage/skills.py
  ```
- **Exports**:
  - `discover_components()` - returns contained component candidates.
  - `validate_skill()` - validates one Agent Skills directory.

### Module: Shim Emitter
- **Maps to capability**: Claude shim generation
- **Responsibility**: Build deterministic Claude manifest bytes and compare them with the committed artifact.
- **File structure**:
  ```text
  plugins/portage/lib/portage/shim.py
  ```
- **Exports**:
  - `render_shim()` - returns expected shim bytes.
  - `emit_shim()` - writes the expected shim.
  - `check_shim()` - reports committed-shim drift without writing.

### Module: Portage Interface
- **Maps to capability**: Maintainer interface and verification
- **Responsibility**: Route CLI subcommands and expose the workflow as an Agent Skill.
- **File structure**:
  ```text
  plugins/portage/scripts/portage.py
  plugins/portage/lib/portage/cli.py
  plugins/portage/skills/portage/SKILL.md
  ```
- **Exports**:
  - `main()` - command-line entry point.
  - `portage` skill - user-facing validation/check procedure.

### Module: Conformance Suite
- **Maps to capability**: Maintainer interface and verification
- **Responsibility**: Prove checklist coverage, shim shape, CLI status, and supported Python versions.
- **File structure**:
  ```text
  tests/fixtures/{valid,invalid}/
  tests/golden/
  tests/test_*.py
  .github/workflows/ci.yml
  pyproject.toml
  ```
- **Exports**:
  - `pytest` suite - executable conformance contract.
  - `ci.yml` - Python matrix and compatibility gates.

## Dependency Chain

### Foundation Layer (Phase 0)
No dependencies - these are built first.

- **Compatibility Fixture Gate**: Proves the package and shim premise independently of Portage.
- **Diagnostics**: Provides deterministic violation collection and rendering.
- **Vendored Schemas**: Provides offline Agent Plugins 1.0.0 rules.

### Core Layer (Phase 1)
- **Manifest Validator**: Depends on [Diagnostics, Vendored Schemas].
- **Component Discovery**: Depends on [Diagnostics, Manifest Validator].
- **Agent Skills Validator**: Depends on [Diagnostics, Component Discovery].

### Integration Layer (Phase 2)
- **Shim Emitter**: Depends on [Manifest Validator, Component Discovery].
- **Portage Interface**: Depends on [Manifest Validator, Agent Skills Validator, Shim Emitter].
- **Conformance Suite**: Depends on [Compatibility Fixture Gate, Portage Interface].

## Development Phases

### Phase 0: Prove the compatibility shape
**Goal**: Resolve the two highest-risk external assumptions before production implementation.

**Entry Criteria**: Stock `claude`, `node`/`npx`, and an isolated temporary configuration location are available.

**Tasks**:
- [ ] Commit the hand-written spec plugin, Claude shim, and local marketplace fixture (depends on: none).
  - Acceptance criteria: Fixture contains root `plugin.json`, portable `skills/`, Claude-only hook under `com.anthropic.claude-code/`, and a shim pointing to that hook.
  - Test strategy: Validate file structure with shell assertions before invoking either client.
- [ ] Implement and run `dev/bin/fixture-gate` (depends on: [hand-written compatibility fixture]).
  - Acceptance criteria: `dev/bin/fixture-gate` exits 0 only when stock Claude installs from the local marketplace, the hook fires, and `npx plugins discover` reports the fixture exactly once; any failure stops this PRD before Phase 1.
  - Test strategy: Run against fresh temporary profiles and preserve redacted command output on failure.

**Exit Criteria**: Both consumers accept the fixture and the committed shim design is empirically proven.

**Delivers**: A reusable executable compatibility gate and evidence that implementation can proceed.

---

### Phase 1: Build offline validation foundations
**Goal**: Load packages safely and report all in-scope manifest/component violations.

**Entry Criteria**: Phase 0 complete.

**Tasks**:
- [ ] Scaffold the Portage spec plugin and vendor the upstream 1.0.0 schemas with provenance (depends on: [fixture gate]).
  - Acceptance criteria: Portage itself has a conformant root manifest, README, changelog, skill directory, and offline schema copy whose source/version is documented.
  - Test strategy: Hash or byte-compare vendored schema files against the pinned upstream copy used during implementation.
- [ ] Implement deterministic diagnostics and closed manifest validation (depends on: [Portage scaffold, vendored schemas]).
  - Acceptance criteria: Supported manifests pass; every required field, invalid type, unknown top-level field, malformed author field, and unsupported `$schema` produces a stable named violation and non-zero status.
  - Test strategy: Parametrized pytest cases mutate one contract element per fixture.
- [ ] Implement fixed-location discovery, containment, and Agent Skills validation (depends on: [manifest validation]).
  - Acceptance criteria: Missing directories pass; unknown/non-object extensions are ignored; lexical and symlink escapes fail; invalid skills are isolated; name, description, and directory-match rules are enforced.
  - Test strategy: Temporary directories plus committed fixtures cover valid, invalid, and sibling-isolation cases.
- [ ] Report `mcp.json` as unsupported (depends on: [manifest validation]).
  - Acceptance criteria: Any present `mcp.json` emits the named unsupported diagnostic and exits non-zero without pretending to validate server contents.
  - Test strategy: Fixtures cover absent MCP, MCP beside skills, and MCP-only packages.

**Exit Criteria**: `validate` can evaluate every non-MCP conformance checklist item offline and returns complete deterministic diagnostics.

**Delivers**: A usable Agent Plugins 1.0 validator for the migration PRD.

---

### Phase 2: Emit and check Claude shims
**Goal**: Generate the minimal Claude compatibility artifact and prevent drift.

**Entry Criteria**: Phase 1 complete.

**Tasks**:
- [ ] Implement deterministic shim rendering and emission (depends on: [manifest validation, component discovery]).
  - Acceptance criteria: Metadata is copied from `plugin.json`; hooks, commands, and agents keys appear only for existing namespaced directories; two runs produce byte-identical output; all paths remain inside the package.
  - Test strategy: Golden files cover every component combination and metadata escaping.
- [ ] Implement read-only `check` with a useful diff (depends on: [shim emission]).
  - Acceptance criteria: `check` returns 0 for the golden shim and non-zero for missing, malformed, or one-byte-stale shims without modifying them.
  - Test strategy: Compare mtimes and bytes before/after check while exercising drift cases.
- [ ] Wire the required CLI and Portage skill (depends on: [validator, emitter, check]).
  - Acceptance criteria: `python3 plugins/portage/scripts/portage.py {validate,emit,check} <plugin-dir>` implements all three contracts, and the skill runs `validate` or `check` then explains every emitted violation.
  - Test strategy: Subprocess tests invoke the public entry point from outside the repository root.

**Exit Criteria**: Portage validates and maintains its own committed shim through the public interface.

**Delivers**: The provisional Claude client needed by every migrated plugin.

---

### Phase 3: Lock conformance into CI
**Goal**: Make every checklist and shim rule regression-resistant.

**Entry Criteria**: Phase 2 complete.

**Tasks**:
- [ ] Complete valid/invalid fixtures and golden tests for every in-scope checklist item (depends on: [Portage interface]).
  - Acceptance criteria: A traceability table maps each non-MCP checklist item to at least one passing and one failing test where applicable; each invalid fixture asserts its named violation.
  - Test strategy: Run pytest with coverage and fail if a fixture is collected without an assertion.
- [ ] Add the supported-Python CI matrix and compatibility gates (depends on: [conformance suite, fixture gate]).
  - Acceptance criteria: CI runs pytest on Python 3.10 and the current supported Python, runs Portage `validate` and `check` on itself, and runs the external fixture gate where the required CLIs are available.
  - Test strategy: Execute the exact CI commands locally; external-tool absence must be an explicit CI job condition, never a silent pass inside the gate.

**Exit Criteria**: All local and CI checks are green and PRD 00003 can depend on stable validator/emitter behavior.

**Delivers**: A tested, documented, stdlib-only Portage v1 plugin.

## Test Pyramid

```text
        /\
       /E2E\       <- 10% compatibility fixture and public CLI
      /------\
     /Integration\ <- 30% package discovery, isolation, shim drift
    /------------\
   /  Unit Tests  \ <- 60% manifest fields, paths, skills, rendering
  /----------------\
```

## Coverage Requirements
- Line coverage: 90% minimum for `plugins/portage/lib/portage/`.
- Branch coverage: 85% minimum, including every error exit.
- Function coverage: 100% for public CLI/validator/emitter functions.
- Statement coverage: 90% minimum.

## Critical Test Scenarios

### Compatibility Fixture Gate
**Happy path**:
- Stock Claude installs the local fixture and the fixture hook emits its unique marker.
- Expected: The gate captures the marker and exits 0.

**Edge cases**:
- `npx plugins` encounters both root `skills/` and the Claude namespace directory.
- Expected: Exactly one plugin identity is reported.

**Error cases**:
- Claude rejects a custom component path or unknown root file.
- Expected: The gate stops before production Portage work with the failing command and redacted output.

**Integration points**:
- Local marketplace, stock Claude loader, and `npx plugins` discovery operate on the same fixture tree.
- Expected: No generated copy or install-time bootstrap is needed.

### Validator and Shim
**Happy path**:
- A skill-bearing 1.0.0 package validates and emits its expected shim.
- Expected: `validate`, `emit`, then `check` all exit 0.

**Edge cases**:
- Optional component directories are absent; unknown extensions exist; symlinks resolve at the boundary.
- Expected: Valid absence/unknown extensions are ignored and any escape is rejected.

**Error cases**:
- Manifest fields, skill frontmatter, schema version, committed shim, or MCP support violate the contract.
- Expected: Stable named diagnostics and non-zero status without traceback or network access.

**Integration points**:
- CLI delegates to the same validator and renderer tested directly.
- Expected: Library and subprocess results agree byte-for-byte.

## Test Generation Guidelines

Prefer one-mutant fixtures that identify the rule under test, parametrized path-boundary cases, and golden files only for the shim/output shapes that are contracts. Never mock filesystem containment; build real temporary symlink trees. Patch network APIs to fail so any accidental fetch makes tests fail. Run subprocess coverage from a cwd outside the repository.

## System Components

- A hand-written dual-layout compatibility fixture and executable external-client gate.
- A vendored Agent Plugins 1.0.0 schema snapshot.
- A small stdlib-only Python validation/discovery library.
- A deterministic Claude shim renderer and read-only drift checker.
- A thin public script plus the `portage` Agent Skill.
- Pytest fixtures, golden outputs, and CI orchestration.

## Data Models

- Portable manifest: the closed Agent Plugins 1.0.0 object named in the discovery document.
- Discovered component: package-relative type/path pair whose resolved path remains under the plugin root.
- Diagnostic: stable severity, rule code, relative path, and message rendered as `<severity> <code> <path>: <message>` `(guess)`; ordering is deterministic and the representation remains internal.
- Claude shim: JSON metadata plus optional `hooks`, `commands`, and `agents` path fields targeting only `./com.anthropic.claude-code/...`.

## Technology Stack

- Python 3.10+ standard library for production code.
- pytest as a development/test dependency.
- POSIX shell for the fixture gate and CI entry points.
- Stock Claude Code and `npx plugins` only in explicit integration jobs.

**Decision: Hand-written validation over `jsonschema`**
- **Rationale**: Portage must be self-contained, offline, and runnable anywhere Python 3.10 exists.
- **Trade-offs**: More validation code and tests are maintained locally.
- **Alternatives considered**: `jsonschema`, PyPI/`uvx` distribution, the Vercel `.plugin/` converter, and a generated full Claude tree.

**Decision: Committed minimal shim**
- **Rationale**: It preserves Claude bulk install, auto-update, older supported Claude versions, and relative `git-subdir` sources without duplicating plugin content.
- **Trade-offs**: Every manifest/component-path change must regenerate one small file.
- **Alternatives considered**: Marketplace command sources and full `dist/claude/<name>/` mirrors.

## Technical Risks

**Risk**: Claude rejects unknown root files or custom paths in the shim.
- **Impact**: High - the selected layout cannot serve Claude.
- **Likelihood**: Medium until the fixture runs.
- **Mitigation**: Make the stock-Claude fixture the first hard gate.
- **Fallback**: Stop this PRD with captured evidence and return the layout to discovery; do not build Portage against a failed premise.

**Risk**: `npx plugins` double-discovers the namespaced component tree.
- **Impact**: High - users see duplicate or malformed plugins.
- **Likelihood**: Medium.
- **Mitigation**: Assert exactly one fixture identity before implementation and retain the assertion in CI.
- **Fallback**: Stop and revise the namespace/tree design before Portage work.

**Risk**: Hand-written validation drifts from the closed schema.
- **Impact**: Medium.
- **Likelihood**: Medium.
- **Mitigation**: Vendor the authoritative schema, maintain field-level traceability, and use mutation fixtures.
- **Fallback**: Expand the validator and regression suite; adding a runtime schema dependency remains out of scope for v1.

## Dependency Risks

- The fixture gate requires working stock Claude and Node tooling; CI must expose absence rather than treating it as a pass.
- PRD 00003 must not begin until this PRD's fixture gate, validator, emitter, and test suite are green.
- Agent Plugins 1.1.0 is a working draft and must not silently alter the pinned 1.0.0 behavior.

## Scope Risks

- MCP validation/emission, migration from legacy layout, other-client emitters, and client-neutral skill rewrites are excluded.
- The Portage skill is an interface to `validate`/`check`, not a second implementation of their rules.
- Do not expand the shim into a copied Claude distribution tree.

## References

- `dev/local/discovery/00001-agent-plugins-monorepo.md`
- Agent Plugins 1.0.0 schemas under `agentplugins/agent-plugins-spec/schemas/1.0.0/`
- Agent Skills specification referenced by Agent Plugins 1.0.0
- Claude Code plugin and marketplace behavior recorded in the discovery document on 2026-08-25

## Glossary

- **Agent Plugins**: The cross-client package specification for manifests, skills, and MCP servers.
- **Claude shim**: The committed `.claude-plugin/plugin.json` that points Claude at client-specific component directories.
- **Portage**: The provisional Agent Plugins client that validates packages and emits/checks Claude shims.
- **Package boundary**: The resolved plugin root beyond which discovered paths and symlinks may not escape.
- **Golden file**: A committed expected output whose exact bytes are the tested contract.

## Open Questions

None. MCP support and any layout change caused by a failed fixture gate require a separate attended discovery decision; an unattended implementation must stop rather than improvise.
