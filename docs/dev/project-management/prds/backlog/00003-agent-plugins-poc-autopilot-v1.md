---
catchup: force
rework_cap: 5
design: run
---

# PRD: Agent Plugins proof of concept - autopilot migration and cutover

## Problem Statement

PRDs 00002 (Portage), 00004 (bulk migration) and 00005 (cutover) commit eight plugins to a package layout, a committed Claude shim, a two-marketplace release model and a `url` to `git-subdir` cutover that only a hand-written fixture will have exercised. The claims that can sink the whole plan are not fixture-sized: a shim whose `hooks` and `agents` paths carry real components, a `hooks.json` whose targets split between the Claude namespace and root-level skill scripts, agent paths named inside skill bodies and asserted by tests, a stale root manifest that already uses a different namespace, an existing installation that must follow a source-type switch through auto-update, `npx plugins` reading a real tree, and one release command spanning two repositories. Autopilot is the hardest live case on every axis and, published on 2026-08-25, the plugin with the fewest external installations. Migrating it end to end proves or amends the concept before seven more plugins move, and it builds the shared tooling (monorepo marketplace, scoped release command, Claude behavior harness, CI base) that PRD 00004 reuses instead of inventing.

## Target Users

- The solo maintainer, who runs autopilot daily and needs the migrated package to behave identically before the compatibility marketplace switches sources.
- PRD 00004, which needs a proven package recipe, release command, behavior harness and CI base, and a verdict saying which concept claims held.
- Existing `buvis-plugins` marketplace installations of autopilot, which must receive the first monorepo release without re-adding anything.
- CI in both repositories, which needs deterministic gates that survive the first `git-subdir` entry.

## Success Metrics

- `python3 plugins/portage/scripts/portage.py validate plugins/autopilot` and `check plugins/autopilot` exit 0; `claude plugin validate .` passes for the two-entry `buvis-agent-plugins` marketplace.
- Test parity: the monorepo copy's pytest and shell results equal the legacy baseline pass set recorded by the inventory (observed 2026-08-26: 1953 passed, 3 failed, 15 errors, all 18 non-passing in `skills/review-work-completion/scripts/test_review_fanout_contract.py`, which expects a `workflows/` tree the pack does not ship); no test is lost and none newly fails; `plugins/autopilot/dev/bin/release-checks` passes from the package root.
- Zero remaining `${CLAUDE_PLUGIN_ROOT}/agents/` or `${CLAUDE_PLUGIN_ROOT}/hooks/` references outside `CHANGELOG.md`; every rewritten path resolves to a file inside the package; every root-target reference is byte-identical to the legacy source.
- An isolated Claude profile installed from the monorepo marketplace exposes the same skills, agents and hook registrations as the legacy installation and produces identical hook outcomes on the fixture payloads.
- `dev/bin/release autopilot patch` produces exactly one monorepo commit and tag `autopilot/vX.Y.Z`, one compatibility commit, touches only autopilot's package files and its two marketplace entries, and switches the compatibility entry to `{"source": "git-subdir", "url": "https://github.com/buvis/agent-plugins.git", "path": "plugins/autopilot"}`.
- An isolated profile that installed autopilot from the legacy `url` entry updates to the monorepo release through `claude plugin update` and passes the behavior harness; the verdict records whether the switch happened in place.
- `npx plugins discover` lists `portage` and `autopilot` exactly once each, on the local tree and on the pushed repository.
- `docs/migration.md` carries a proof-of-concept table in which every concept claim is PASS with an evidence path, and `dev/bin/poc-verdict` exits 0; PRD 00004 does not start otherwise.

## Capability Tree

### Capability: Migration premise and inventory

Freeze what is being migrated and re-check it at every step that copies or releases.

#### Feature: Execution-time legacy inventory
- **Description**: Produce a machine-readable inventory of the legacy autopilot repository that later steps and PRD 00004 consume.
- **Inputs**: `~/git/src/github.com/buvis/claude-autopilot` worktree and its `origin`.
- **Outputs**: `dev/local/migration-inventory/autopilot.json` with HEAD, origin HEAD, dirty flag, shim name and version, root-manifest state, per-type component counts and paths, hook events with every command target classified as moved (`hooks/`, `agents/`) or root (`skills/...`), every `${CLAUDE_PLUGIN_ROOT}` reference classified the same way, test files, and the commands from `dev/bin/release-checks`.
- **Behavior**: Premise: `buvis/claude-autopilot` at `origin/master` is the authoritative installable source and the local worktree is clean and level with it. A dirty tree, an unpushed commit, or a local HEAD behind origin stops the PRD with the inventory's report; nothing is copied. Counts are derived, never hard-coded: the numbers observed on 2026-08-26 (10 skills, 14 agents, one hook script plus `_common.py`, five `hooks.json` entries of which two target `hooks/`, 13 lines in 7 files naming `${CLAUDE_PLUGIN_ROOT}/agents/`) are hints for review, not acceptance values, because autopilot keeps changing until this PRD runs.

#### Feature: Legacy test baseline
- **Description**: Record the legacy pass set so migration is judged on parity rather than on an absolute green.
- **Inputs**: Legacy worktree, `uv`, `pytest`, `rich`, `textual`, bash.
- **Outputs**: `dev/local/migration-inventory/autopilot-baseline.json` listing every pytest node id and shell test with its outcome.
- **Behavior**: Run the full suite (`pytest skills` with `rich` and `textual` available, plus every `test_*.sh`) and `dev/bin/release-checks`; a red `release-checks` stops the PRD because the legacy release gate itself is broken; red tests elsewhere are recorded, not fixed, and named in the verdict as follow-ups for the autopilot repository.

#### Feature: Stale root manifest retirement
- **Description**: Replace the abandoned draft manifest with the conformant one instead of merging them.
- **Inputs**: Legacy root `plugin.json` (version 0.1.0, `extensions."org.anthropic.claude"` on 2026-08-26) and the legacy shim (version 0.1.2).
- **Outputs**: One conformant root `plugin.json` whose version equals the shim's.
- **Behavior**: Premise: the root manifest has no consumer; `rg org\.anthropic\.claude` over `~/git/src/github.com/buvis` and `~/.claude` finds only the file itself. Re-run that search at execution; a hit outside the file stops the task and reports it. Never carry the `org.anthropic.claude` key forward.

### Capability: Conformant autopilot package

Build `plugins/autopilot/` as an Agent Plugins 1.0 package whose observable Claude behavior is unchanged.

#### Feature: Portable core
- **Description**: Lay down the root manifest, unchanged skills, docs and per-plugin check hook.
- **Inputs**: Inventory, legacy tree, Agent Plugins 1.0.0 schema, Portage.
- **Outputs**: `plugins/autopilot/{plugin.json,CHANGELOG.md,README.md,LICENSE,skills/,dev/bin/release-checks}`.
- **Behavior**: `skills/` is copied byte-for-byte including `scripts/`, `cli/`, `references/`, `prompts/`, golden files and fixtures. `plugin.json` copies name, version, description and author from the legacy shim and adds `$schema`, `license`, `repository`. `CHANGELOG.md` keeps its `[Unreleased]` entries and gains a `### Changed` line for the monorepo move. `README.md` install and update sections point at `buvis/agent-plugins` and the compatibility marketplace, and list the skills that stay Claude-only (all ten: they use `${CLAUDE_PLUGIN_ROOT}` and dispatch Claude agents). The legacy `dev/bin/release` shim is dropped; `dev/bin/release-checks` is kept as the per-plugin check hook the monorepo release command runs.

#### Feature: Claude namespace relocation
- **Description**: Move Claude-only components under `com.anthropic.claude-code/` and rewrite only the hook targets that moved.
- **Inputs**: Legacy `hooks/` (`hooks.json`, `enforce_prd_location.py`, `_common.py`) and `agents/*.md`.
- **Outputs**: `plugins/autopilot/com.anthropic.claude-code/{hooks,agents}/`.
- **Behavior**: The `hooks.json` entries targeting `hooks/` become `${CLAUDE_PLUGIN_ROOT}/com.anthropic.claude-code/hooks/<script>`; entries targeting `skills/run-autopilot/scripts/` stay byte-identical. `enforce_prd_location.py` keeps its sibling `_common.py` (it inserts its own directory on `sys.path`). Agent files keep their frontmatter (`name`, `description`, `tools`, `model`, `color`) unchanged so `autopilot:<name>` keeps resolving.

#### Feature: Reference and test rewrite
- **Description**: Repoint every reference whose target moved, in skill bodies, references, and test resolvers, without touching the rest.
- **Inputs**: Inventory reference classification; on 2026-08-26 the moved-target lines are in `skills/work/SKILL.md`, `skills/review-work-completion/SKILL.md`, `skills/work/references/code-quality-principles.md`, `skills/review-work-completion/references/{agent-registry,agent-invocation}.md`, `skills/work/scripts/test_dispatch_prose.py`, `skills/review-work-completion/scripts/test_agent_registry.py`, plus the path resolvers `_PACK_ROOT / "agents"`, `_SKILLS.parent / "agents"`, and `_PACK_ROOT / "hooks" / "hooks.json"` in `test_agent_registry.py`, `test_review_prompt_contracts.py`, and `test_review_coverage_hook_registration.py`.
- **Outputs**: Rewritten files and a diff allowlist naming each changed line.
- **Behavior**: `${CLAUDE_PLUGIN_ROOT}/agents/<x>` becomes `${CLAUDE_PLUGIN_ROOT}/com.anthropic.claude-code/agents/<x>`; test needles and the SKILL.md lines they assert change in lockstep; resolvers gain the namespace segment. Historical `CHANGELOG.md` text is not rewritten. After the rewrite, `rg 'CLAUDE_PLUGIN_ROOT\}?/(agents|hooks)/'` over the package finds no line outside `CHANGELOG.md`, every rewritten path exists, and every file outside the allowlist is byte-identical to the legacy tree.

#### Feature: Shim, validation and parity
- **Description**: Generate the committed shim and prove the package validates and tests at parity.
- **Inputs**: Portage `emit`, `validate`, `check`; baseline; `dev/bin/verify-migration`.
- **Outputs**: `plugins/autopilot/.claude-plugin/plugin.json` with `hooks` and `agents` paths only; parity report.
- **Behavior**: The shim carries no `skills` or `commands` key: Claude adds a custom `skills` path to the default and autopilot ships no commands. `verify-migration` runs the same suites from `plugins/autopilot/` and fails on any node whose outcome differs from the baseline, and on any baseline node that no longer exists.

### Capability: Monorepo marketplace and Claude behavior proof

Install the package into stock Claude Code from the monorepo and compare it with the legacy installation.

#### Feature: Native monorepo marketplace
- **Description**: Publish `.claude-plugin/marketplace.json` named `buvis-agent-plugins` with relative sources.
- **Inputs**: `plugins/portage` and `plugins/autopilot` manifests and shims.
- **Outputs**: Two entries with `"source": "./plugins/<name>"`, versions equal to the manifests.
- **Behavior**: `claude plugin validate .` passes; adding a package without an entry fails CI.

#### Feature: Isolated Claude behavior harness
- **Description**: Install one plugin from a given marketplace source into an isolated Claude profile and check inventory and hook outcomes against the legacy installation.
- **Inputs**: Marketplace source (local path, GitHub repository, or a `git-subdir` entry), plugin name, inventory, fixture payloads.
- **Outputs**: `dev/bin/verify-claude-install` exit status plus a normalized report of skills, agents, hook events, hook commands, hook outcomes, and live-session evidence.
- **Behavior**: Reuses the profile isolation established by the PRD 00002 fixture gate; never touches the maintainer's `~/.claude`. Inventory check: skill directories, agent files, and hook registrations parsed from the installed shim and `hooks.json` equal the inventory. Outcome check: each registered hook command runs with `CLAUDE_PLUGIN_ROOT` set to the install path on fixture payloads (a PRD write outside `dev/local/prds/`, a `state.json` write, a Bash tool result, a Stop event) and its exit code and normalized output equal the legacy installation's. Live check: one headless session in the isolated profile shows a namespace-side hook (`enforce_prd_location.py`) and a root-side hook (`review_coverage_hook.py`) executing through the shim registration, using the evidence channel the fixture gate established; `claude plugin list --json` reports the plugin with the expected version and install path (the output format is undocumented; the harness asserts only those three fields) `(guess)`.

#### Feature: Monorepo CI extension
- **Description**: Extend the PRD 00002 workflow so every package and the autopilot release gate run on each change.
- **Inputs**: `.github/workflows/ci.yml`, `plugins/*/plugin.json`, `plugins/*/dev/bin/release-checks`.
- **Outputs**: One required status covering Portage gates for every discovered package, Portage tests, `plugins/autopilot/dev/bin/release-checks`, release-tooling tests, and `claude plugin validate .`.
- **Behavior**: Package discovery is by glob, so a new package cannot be silently omitted; a missing toolchain (`uv`, `node`, `claude`) fails the job rather than skipping it.

### Capability: Scoped release and compatibility cutover

Release one package from the monorepo and move its compatibility entry without touching siblings.

#### Feature: Scoped release command
- **Description**: Implement `dev/bin/release <name> [patch|minor|major]` for the monorepo.
- **Inputs**: Plugin name, bump (default `patch`), `plugins/<name>/`, both marketplaces, the local `~/git/src/github.com/buvis/claude-plugins` checkout.
- **Outputs**: One monorepo commit `chore: release <name> v<ver>` with tag `<name>/v<ver>`, one compatibility commit `chore: bump <name> to v<ver>`, both pushed.
- **Behavior**: In order: both trees clean; package exists; `[Unreleased]` has entries; `plugins/<name>/dev/bin/release-checks` then `release-build` when executable; bump `plugin.json`; `portage emit`; stamp the changelog; update the monorepo entry; refuse if the diff touches anything outside `plugins/<name>/` and that plugin's marketplace entry; commit, tag, push. Then install the pushed version into an isolated profile through a temporary `git-subdir` marketplace and run the behavior harness; refuse the compatibility repoint on failure, leaving the monorepo tag in place and naming it. Then set the compatibility entry to the `git-subdir` source (first release) or keep it (later releases), bump its version, verify with the same sibling-entry comparison `scripts/release-plugin` uses today, commit, push. Unknown names, a second plugin's diff, an existing tag, or a failed push abort before the next irreversible step.

#### Feature: Release regression harness
- **Description**: Test the release command against temporary repositories and fake remotes.
- **Inputs**: `dev/tests/test_release.py`, fixture monorepo and compatibility repositories, a stub behavior harness.
- **Outputs**: Deterministic coverage of every bump mode and refusal path.
- **Behavior**: Includes the first-release source switch, later-release stability, the sibling-entry clobber class from the 2026 warden incident, harness failure before repoint, and push failure after tag.

#### Feature: Compatibility drift check for `git-subdir`
- **Description**: Keep the compatibility repository's CI green once an entry points into the monorepo.
- **Inputs**: `claude-plugins/scripts/validate-versions.mjs`, `.github/workflows/validate-versions.yml`.
- **Outputs**: A drift check that resolves `git-subdir` entries to `<url>/<ref or master>/<path>/.claude-plugin/plugin.json` and `url` entries as today.
- **Behavior**: Premise: the script reads only `plugin.source.url` and fetches `.claude-plugin/plugin.json` at the repository root (true on 2026-08-26). Re-read it before editing; if it already handles `git-subdir`, skip and report. A unit test with a stubbed `fetch` covers both entry shapes.

#### Feature: First monorepo release and auto-update observation
- **Description**: Release autopilot for real and watch an old-source installation follow the switch.
- **Inputs**: Green CI, an isolated profile that installed `autopilot@buvis-plugins` from the legacy `url` entry at the inventory version, the release command.
- **Outputs**: Tag `autopilot/v<next>`, both marketplace commits, and an observation record: version before and after `claude plugin update`, install path contents (shim with `hooks` and `agents`, `com.anthropic.claude-code/`), harness result.
- **Behavior**: Premise re-check immediately before releasing: legacy source still level with the inventory (no new commits) and the compatibility entry still `url`; on mismatch skip the release and report. If the update does not switch sources in place, run the documented fallback (uninstall, install) in the isolated profile, record the fallback as the required user action, and mark the claim FAIL in the verdict; never report the switch as transparent when it was not.

### Capability: Portability probe and verdict

Show the tree is readable outside Claude and write down what the concept proved.

#### Feature: Discovery uniqueness probe
- **Description**: Run `npx plugins discover` against the local monorepo and the pushed repository.
- **Inputs**: Monorepo path, `buvis/agent-plugins` after the release push.
- **Outputs**: `dev/bin/probe-discovery` exit status and the normalized identity list.
- **Behavior**: Exactly `portage` and `autopilot`, once each; a `com.anthropic.claude-code` pseudo-plugin, a per-skill entry, or a missing package fails the probe.

#### Feature: Proof-of-concept verdict
- **Description**: Record each concept claim's outcome with evidence so PRD 00004 starts from facts.
- **Inputs**: Results of every gate above and the legacy-red test list.
- **Outputs**: A `## Proof of concept: autopilot` table in `docs/migration.md` with fixed rows C1 to C9 (shim carries real hooks and agents; mixed hook targets resolve; agent-path rewrite complete; stale manifest retired; test parity; marketplace validates; scoped release touches nothing else; old-source profile follows the switch in place; discovery lists each package once), each PASS or FAIL with an evidence path, plus a follow-ups list; `dev/bin/poc-verdict` exits 0 only when every row is PASS.
- **Behavior**: A FAIL row is not fixed inside this PRD; the PRD completes with the table written and `poc-verdict` failing, and PRD 00004's entry criteria keep it from starting until the maintainer amends the plan.

## Repository Structure

```text
agent-plugins/
├── .claude-plugin/marketplace.json        # buvis-agent-plugins: ./plugins/portage, ./plugins/autopilot
├── .github/workflows/ci.yml               # PRD 00002 workflow, extended
├── dev/
│   ├── bin/inventory-plugin
│   ├── bin/verify-migration
│   ├── bin/verify-claude-install
│   ├── bin/release
│   ├── bin/probe-discovery
│   ├── bin/poc-verdict
│   ├── local/migration-inventory/         # gitignored: autopilot.json, autopilot-baseline.json
│   └── tests/
│       ├── test_inventory.py
│       ├── test_verify_migration.py
│       ├── test_verify_claude_install.py
│       ├── test_release.py
│       ├── test_probe_discovery.py
│       └── test_poc_verdict.py
├── docs/migration.md
├── plugins/portage/                       # PRD 00002
└── plugins/autopilot/
    ├── plugin.json
    ├── .claude-plugin/plugin.json         # portage emit: hooks, agents
    ├── CHANGELOG.md
    ├── README.md
    ├── LICENSE
    ├── dev/bin/release-checks
    ├── skills/                            # ten skills, byte-identical except allowlisted lines
    └── com.anthropic.claude-code/
        ├── hooks/{hooks.json,enforce_prd_location.py,_common.py}
        └── agents/*.md

claude-plugins/
├── .claude-plugin/marketplace.json        # autopilot entry: git-subdir after the first release
├── .github/workflows/validate-versions.yml
└── scripts/validate-versions.mjs          # resolves git-subdir entries
```

## Module Definitions

### Module: Migration Inventory
- **Maps to capability**: Migration premise and inventory
- **Responsibility**: Establish and re-check the legacy source, its baseline, and every reference classification the migration relies on.
- **File structure**:
  ```text
  dev/bin/inventory-plugin
  dev/tests/test_inventory.py
  dev/local/migration-inventory/
  ```
- **Exports**:
  - `dev/bin/inventory-plugin <legacy-repo> <out-dir>` - inventory and baseline JSON, non-zero on a failed premise.

### Module: Autopilot Package
- **Maps to capability**: Conformant autopilot package
- **Responsibility**: Hold the portable manifest, unchanged skills, docs, and the per-plugin check hook.
- **File structure**:
  ```text
  plugins/autopilot/{plugin.json,CHANGELOG.md,README.md,LICENSE}
  plugins/autopilot/skills/
  plugins/autopilot/dev/bin/release-checks
  ```
- **Exports**:
  - Root `plugin.json` - the portable identity and version contract.
  - `dev/bin/release-checks` - the release gate the monorepo release command runs.

### Module: Claude Extension Package
- **Maps to capability**: Conformant autopilot package
- **Responsibility**: Isolate Claude-only hooks and agents and expose them through the Portage-generated shim.
- **File structure**:
  ```text
  plugins/autopilot/com.anthropic.claude-code/{hooks,agents}/
  plugins/autopilot/.claude-plugin/plugin.json
  ```
- **Exports**:
  - Namespaced `hooks.json` and agent files.
  - Committed shim consumable by stock Claude Code.

### Module: Migration Verifier
- **Maps to capability**: Conformant autopilot package
- **Responsibility**: Prove reference completeness, diff allowlisting, and test parity against the baseline.
- **File structure**:
  ```text
  dev/bin/verify-migration
  dev/tests/test_verify_migration.py
  ```
- **Exports**:
  - `dev/bin/verify-migration <legacy-repo> <package-dir> <inventory-dir>` - parity and allowlist report.

### Module: Marketplace Integration
- **Maps to capability**: Monorepo marketplace and Claude behavior proof
- **Responsibility**: Keep the native marketplace and the compatibility entry consistent with released packages.
- **File structure**:
  ```text
  agent-plugins/.claude-plugin/marketplace.json
  claude-plugins/.claude-plugin/marketplace.json
  ```
- **Exports**:
  - `buvis-agent-plugins` marketplace with relative sources.
  - `buvis-plugins` autopilot entry on a `git-subdir` source after the first release.

### Module: Claude Behavior Harness
- **Maps to capability**: Monorepo marketplace and Claude behavior proof
- **Responsibility**: Install into an isolated profile and compare inventory, hook outcomes, and live hook execution with the legacy installation.
- **File structure**:
  ```text
  dev/bin/verify-claude-install
  dev/tests/test_verify_claude_install.py
  dev/tests/fixtures/claude-behavior/
  ```
- **Exports**:
  - `dev/bin/verify-claude-install <marketplace-source> <plugin> <inventory>` - repeatable behavior proof.

### Module: Release Tooling
- **Maps to capability**: Scoped release and compatibility cutover
- **Responsibility**: Bump, check, emit, commit, tag, push, verify, and repoint exactly one plugin.
- **File structure**:
  ```text
  dev/bin/release
  dev/tests/test_release.py
  ```
- **Exports**:
  - `dev/bin/release <name> [patch|minor|major]` - the public release command.

### Module: Compatibility Drift Check
- **Maps to capability**: Scoped release and compatibility cutover
- **Responsibility**: Validate compatibility marketplace versions against `url` and `git-subdir` upstreams.
- **File structure**:
  ```text
  claude-plugins/scripts/validate-versions.mjs
  claude-plugins/scripts/validate-versions.test.mjs
  ```
- **Exports**:
  - `node scripts/validate-versions.mjs` - drift check for both entry shapes.

### Module: Portability Probe
- **Maps to capability**: Portability probe and verdict
- **Responsibility**: Assert unique discovery of every package by `npx plugins`.
- **File structure**:
  ```text
  dev/bin/probe-discovery
  dev/tests/test_probe_discovery.py
  ```
- **Exports**:
  - `dev/bin/probe-discovery <path-or-repo> <expected-names...>` - normalized identity check.

### Module: Verdict
- **Maps to capability**: Portability probe and verdict
- **Responsibility**: Record claim outcomes and gate PRD 00004.
- **File structure**:
  ```text
  docs/migration.md
  dev/bin/poc-verdict
  dev/tests/test_poc_verdict.py
  ```
- **Exports**:
  - `dev/bin/poc-verdict` - exit 0 only when every claim row is PASS.

### Module: Monorepo CI
- **Maps to capability**: Monorepo marketplace and Claude behavior proof
- **Responsibility**: Run Portage gates, release-tooling tests, the autopilot release gate, and stock Claude validation on every change.
- **File structure**:
  ```text
  .github/workflows/ci.yml
  ```
- **Exports**:
  - Required CI status for the two-package monorepo.

## Dependency Chain

### Foundation Layer (Phase 0)
No dependencies inside this PRD; external prerequisite PRD 00002 (Portage, fixture gate, CI skeleton) must be complete.

- **Migration Inventory**: Provides the source premise, component and reference classification, and the test baseline.
- **Portage**: Provides `validate`, `emit`, `check`, and the isolated-profile mechanism of the fixture gate.

### Core Layer (Phase 1)
- **Autopilot Package**: Depends on [Migration Inventory, Portage].
- **Claude Extension Package**: Depends on [Migration Inventory, Autopilot Package, Portage].
- **Migration Verifier**: Depends on [Migration Inventory, Autopilot Package, Claude Extension Package].

### Integration Layer (Phase 2)
- **Marketplace Integration**: Depends on [Autopilot Package, Claude Extension Package].
- **Claude Behavior Harness**: Depends on [Marketplace Integration, Migration Inventory, Portage].
- **Monorepo CI**: Depends on [Autopilot Package, Marketplace Integration, Portage].

### Release Layer (Phase 3)
- **Release Tooling**: Depends on [Marketplace Integration, Claude Behavior Harness, Monorepo CI, Portage].
- **Compatibility Drift Check**: Depends on [Release Tooling].

### Proof Layer (Phase 4)
- **Portability Probe**: Depends on [Marketplace Integration].
- **Verdict**: Depends on [Migration Verifier, Claude Behavior Harness, Release Tooling, Compatibility Drift Check, Portability Probe].

## Development Phases

### Phase 0: Inventory and baseline
**Goal**: Freeze a reproducible, premise-checked view of the legacy plugin.

**Entry Criteria**: PRD 00002 complete (fixture gate green, Portage `validate`/`emit`/`check` and its tests passing, CI skeleton present); `buvis/claude-autopilot` and `buvis/claude-plugins` readable.

**Tasks**:
- [ ] Implement `dev/bin/inventory-plugin` with tests (depends on: none).
  - Acceptance criteria: Emits the inventory JSON described above from any legacy-layout repository; exits non-zero with a named reason on a dirty tree, an unpushed commit, or a HEAD behind origin; classifies every `${CLAUDE_PLUGIN_ROOT}` reference and every `hooks.json` target as moved or root.
  - Test strategy: Temporary git repositories with a fake origin cover clean, dirty, ahead, behind, and mixed-target hook manifests; a golden inventory for a small fixture plugin.
- [ ] Run the inventory and the test baseline on `claude-autopilot` (depends on: [inventory-plugin]).
  - Acceptance criteria: `dev/local/migration-inventory/autopilot.json` and `autopilot-baseline.json` exist; the stale-manifest premise search finds only `plugin.json`; `dev/bin/release-checks` is green in the legacy tree; every red test is listed in the baseline.
  - Test strategy: Re-run from a fresh shell and byte-compare normalized output.

**Exit Criteria**: Inventory and baseline written, or the PRD has stopped with a named failed premise.

**Delivers**: The migration's source of truth and PRD 00004's inventory tool.

---

### Phase 1: Package autopilot
**Goal**: Produce the conformant package with unchanged behavior and proven parity.

**Entry Criteria**: Phase 0 complete.

**Tasks**:
- [ ] Lay down the portable core (depends on: [inventory]).
  - Acceptance criteria: `plugins/autopilot/plugin.json` validates against the vendored 1.0.0 schema with the inventory's name and version; `skills/` is byte-identical to the legacy tree; `CHANGELOG.md` keeps `[Unreleased]` and gains the move entry; README install and update sections name both marketplaces and list the Claude-only skills; `dev/bin/release-checks` is present and the legacy `dev/bin/release` shim is not; the stale root manifest's key is absent.
  - Test strategy: Portage `validate`; directory diff against the legacy tree; `rg` assertions on README and CHANGELOG.
- [ ] Relocate hooks and agents into the Claude namespace (depends on: [portable core]).
  - Acceptance criteria: `com.anthropic.claude-code/hooks/` holds `hooks.json`, `enforce_prd_location.py`, `_common.py`; `com.anthropic.claude-code/agents/` holds every inventoried agent with unchanged frontmatter; in `hooks.json` only the moved-target commands differ from legacy and each resolves to an existing file.
  - Test strategy: Frontmatter parse and compare; `hooks.json` command resolution with `CLAUDE_PLUGIN_ROOT` set to the package path; the existing `test_review_coverage_hook_registration.py` after its resolver repoint.
- [ ] Rewrite moved-target references and test resolvers (depends on: [namespace relocation]).
  - Acceptance criteria: No `${CLAUDE_PLUGIN_ROOT}/agents/` or `/hooks/` reference remains outside `CHANGELOG.md`; every rewritten path exists; `test_dispatch_prose.py` and `test_agent_registry.py` pass against the rewritten files; the diff allowlist names every changed line and every other file is byte-identical.
  - Test strategy: `rg` sweep, path existence check, the plugin's own tests, allowlist comparison in `verify-migration`.
- [ ] Emit the shim and prove parity (depends on: [reference rewrite]).
  - Acceptance criteria: Portage `emit` then `check` pass; the shim has `hooks` and `agents` keys only; `verify-migration` reports the baseline pass set exactly; `dev/bin/release-checks` passes from `plugins/autopilot/`.
  - Test strategy: Golden shim comparison; full suite run compared node by node with the baseline.

**Exit Criteria**: `plugins/autopilot` validates, checks, and tests at parity with a fully accounted diff.

**Delivers**: The first real Agent Plugins 1.0 package in the monorepo and the migration recipe for PRD 00004.

---

### Phase 2: Marketplace, behavior harness, CI
**Goal**: Install the package into stock Claude from the monorepo and gate every change.

**Entry Criteria**: Phase 1 complete.

**Tasks**:
- [ ] Create the two-entry monorepo marketplace (depends on: [shim]).
  - Acceptance criteria: `buvis-agent-plugins` lists `./plugins/portage` and `./plugins/autopilot` with manifest versions; `claude plugin validate .` passes.
  - Test strategy: JSON structural assertions and stock Claude validation.
- [ ] Implement `dev/bin/verify-claude-install` with tests (depends on: [marketplace]).
  - Acceptance criteria: Against the monorepo marketplace in an isolated profile the harness proves inventory equality, identical hook outcomes on the fixture payloads versus the legacy installation, live execution of one namespace-side and one root-side hook, and a `claude plugin list --json` entry with the expected version and path; it never reads or writes the maintainer's `~/.claude`.
  - Test strategy: Unit tests on the parsers and comparators with recorded fixtures; one integration run against the real isolated profile, its redacted output preserved.
- [ ] Extend CI (depends on: [marketplace, verify-migration]).
  - Acceptance criteria: CI discovers every `plugins/*/plugin.json`, runs Portage `validate` and `check` on each, Portage tests, `dev/tests`, `plugins/autopilot/dev/bin/release-checks`, and `claude plugin validate .`; a missing toolchain fails the job.
  - Test strategy: Run each job command locally; add a throwaway package without a marketplace entry and confirm the failure.

**Exit Criteria**: A clean isolated profile runs autopilot from the monorepo with legacy-equivalent behavior and CI is green.

**Delivers**: The behavior harness and CI base PRD 00004 extends.

---

### Phase 3: Release tooling
**Goal**: Make one safe, scoped, harness-checked release command across both repositories.

**Entry Criteria**: Phase 2 complete.

**Tasks**:
- [ ] Implement `dev/bin/release` with its regression harness (depends on: [CI, marketplace, behavior harness]).
  - Acceptance criteria: The command performs the ordered steps of the scoped release feature, refuses unknown names, dirty trees, empty `[Unreleased]`, out-of-scope diffs, existing tags, harness failure before repoint, and push failure; temporary-repository tests cover every bump mode and refusal path plus the first-release source switch and later-release stability.
  - Test strategy: `dev/tests/test_release.py` against temporary repositories with fake remotes and a stubbed behavior harness; golden diffs of both marketplaces.
- [ ] Teach the compatibility drift check `git-subdir` (depends on: [release command]).
  - Acceptance criteria: With the premise re-checked, `validate-versions.mjs` resolves `git-subdir` entries to `<url>/<ref or master>/<path>/.claude-plugin/plugin.json`, `url` entries as before, and its stubbed-fetch test covers both; the compatibility CI workflow runs it unchanged.
  - Test strategy: Node test with a stubbed global `fetch`; run the script locally against the current marketplace.

**Exit Criteria**: A full release is rehearsed end to end on fixtures without publishing anything.

**Delivers**: The release command PRD 00004 uses for the remaining seven plugins.

---

### Phase 4: Real release, observation, probe, verdict
**Goal**: Cut autopilot over for real and write down what the concept proved.

**Entry Criteria**: Phase 3 complete; CI green; push access to both repositories; `npx` available.

**Tasks**:
- [ ] Prepare the old-source profile and release autopilot (depends on: [release tooling, behavior harness]).
  - Acceptance criteria: An isolated profile holds autopilot at the inventory version from the legacy `url` entry; the premise re-check passes immediately before release; `dev/bin/release autopilot patch` yields tag `autopilot/v<next>`, the harness passes on the pushed `git-subdir` source, and the compatibility entry is repointed with only that entry changed.
  - Test strategy: Preserve before and after marketplace JSON, diff scopes, tag and commit ids, and harness output.
- [ ] Observe auto-update on the old-source profile (depends on: [release]).
  - Acceptance criteria: After `claude plugin update`, the isolated profile reports the new version with the monorepo tree in its install path and the harness passes there; otherwise the uninstall-and-install fallback is executed and recorded and claim C8 is FAIL.
  - Test strategy: Capture `claude plugin list --json` before and after, plus harness output.
- [ ] Probe discovery locally and on the pushed repository (depends on: [release]).
  - Acceptance criteria: `dev/bin/probe-discovery` reports `portage` and `autopilot` once each for the local tree and for `buvis/agent-plugins`.
  - Test strategy: Parser fixtures for ordering and noise; integration run against both sources.
- [ ] Write the verdict (depends on: [release, observation, probe, verify-migration, behavior harness]).
  - Acceptance criteria: `docs/migration.md` has the C1 to C9 table with evidence paths and the follow-ups list (including the legacy-red tests); `dev/bin/poc-verdict` reflects the table; PRD 00004's entry criteria name that command.
  - Test strategy: `test_poc_verdict.py` covers all-PASS, one-FAIL, and malformed tables.

**Exit Criteria**: Autopilot is served from the monorepo through both marketplaces and the verdict is written.

**Delivers**: A proven or explicitly amended concept before seven more plugins move.

## Test Pyramid

```text
        /\
       /E2E\       <- 25% isolated Claude installs, real release, npx discovery
      /------\
     /Integration\ <- 40% inventory, parity, release fixtures, harness parsers
    /------------\
   /  Unit Tests  \ <- 35% classification, diff allowlist, drift check, verdict
  /----------------\
```

## Coverage Requirements
- Line coverage: 90% minimum for `dev/bin` tooling and `dev/tests`; autopilot's own suites keep their baseline.
- Branch coverage: 100% for release refusal branches and every premise re-check.
- Function coverage: 100% for public entry points of the inventory, verifier, harness, release, probe, and verdict commands.
- Statement coverage: 90% minimum for new code.

## Critical Test Scenarios

### Migration and Parity
**Happy path**:
- A clean legacy tree is inventoried, packaged, namespaced, rewritten, emitted, and verified.
- Expected: Portage passes, the diff matches the allowlist, the pass set equals the baseline.

**Edge cases**:
- A `hooks.json` mixing namespace and root targets; a test asserting a literal agent path; a red legacy test.
- Expected: Only moved targets change, the test and its needle change together, the red test stays red and is listed.

**Error cases**:
- Dirty legacy tree, unpushed commit, a consumer of `org.anthropic.claude`, a lost baseline node.
- Expected: The step stops with a named reason; nothing is copied or forced.

**Integration points**:
- Package, shim, marketplace, stock Claude loader, and the legacy installation.
- Expected: Inventory and hook outcomes agree across both installations.

### Release and Cutover
**Happy path**:
- `release autopilot patch` bumps, emits, stamps, commits, tags, pushes, verifies, and repoints.
- Expected: Two commits, one tag, no sibling change, harness green on the pushed source.

**Edge cases**:
- Second release after the switch; harness failure after the monorepo push.
- Expected: Compatibility source retained; repoint refused with the tag named.

**Error cases**:
- Unknown plugin, dirty tree, out-of-scope diff, existing tag, push failure, `git-subdir` entry unreadable by the drift check.
- Expected: Abort before the next irreversible step; drift check names the entry.

**Integration points**:
- Old-source isolated profile, compatibility marketplace, GitHub, `npx plugins`.
- Expected: The profile updates in place, or the fallback is recorded as FAIL.

## Test Generation Guidelines

Bind tests to the rule under test: one mutant per fixture for classification and refusal paths, node-by-node parity rather than pass counts, golden files only for the shim and marketplace shapes. Never mock the filesystem for containment or diff checks; build real temporary trees and repositories. Stub network and `claude` process boundaries in unit tests and keep the real isolated-profile runs in explicit integration jobs whose absence of a toolchain is a failure. Preserve redacted command output for every external run.

## System Components

- Inventory and baseline tooling with premise re-checks.
- The autopilot Agent Plugins 1.0 package with its Claude namespace and committed shim.
- The two-entry monorepo marketplace and the repointed compatibility entry.
- An isolated-profile Claude behavior harness.
- A scoped, harness-checked release command spanning both repositories.
- A `git-subdir`-aware compatibility drift check.
- `npx plugins` discovery probe and the verdict document with its gate command.

## Data Models

- Inventory record: origin and HEAD ids, clean flag, shim name and version, root-manifest state, component paths by type, hook registrations with target class, reference lines with target class, test commands.
- Baseline: map of test id to outcome for pytest nodes and shell tests.
- Diff allowlist: list of package-relative paths and line numbers permitted to differ from the legacy tree.
- Harness report: skills, agents, hook events and commands, per-fixture outcomes, live evidence, plugin list entry.
- Release scope: `plugins/<name>/**` plus that plugin's entry in each marketplace; anything else is a refusal.
- Verdict row: claim id, title, PASS or FAIL, evidence path.

## Technology Stack

- Python 3.10+ standard library for `dev/bin` tooling and tests (pytest as the test runner), matching Portage.
- Node 18+ for the compatibility drift check and `npx plugins`.
- POSIX shell only where a command is a thin wrapper.
- Stock Claude Code CLI (`claude plugin install|update|list --json|validate`), git, GitHub.

**Decision: Parity against a recorded baseline instead of an absolute green**
- **Rationale**: The legacy suite is not fully green today and the migration must not change behavior, so equality with the baseline is the honest criterion.
- **Trade-offs**: Red legacy tests survive the move and are handed to the autopilot repository as follow-ups.
- **Alternatives considered**: Fixing the tests during migration (mixes concerns), deselecting them in CI (hides them).

**Decision: Harness check between monorepo push and compatibility repoint**
- **Rationale**: The compatibility entry feeds the maintainer's daily installation through auto-update; a broken release must be caught before that entry moves.
- **Trade-offs**: The release command takes longer and needs the `claude` CLI on the releasing machine.
- **Alternatives considered**: Repointing first and relying on CI (too late), a manual smoke test (not repeatable).

**Decision: Shared tooling lives in this PRD, not in PRD 00004**
- **Rationale**: The proof is only meaningful if the same commands PRD 00004 will run are the ones exercised here.
- **Trade-offs**: This PRD is larger than a bare migration.
- **Alternatives considered**: A throwaway migration script (proves nothing about the release model).

## Technical Risks

**Risk**: The shim's custom `agents` and `hooks` paths do not behave like the default directories for a real plugin.
- **Impact**: High.
- **Likelihood**: Low after the PRD 00002 fixture gate, medium for `${CLAUDE_PLUGIN_ROOT}` expansion inside a mixed `hooks.json`.
- **Mitigation**: The behavior harness compares registrations and outcomes with the legacy installation and shows live execution of one hook on each side.
- **Fallback**: Mark C1 or C2 FAIL, keep the legacy entry, return the layout to attended discovery.

**Risk**: An existing installation does not follow the `url` to `git-subdir` switch in place.
- **Impact**: High for PRD 00004's cutover promise.
- **Likelihood**: Medium until observed.
- **Mitigation**: Observe on an isolated old-source profile before any other plugin moves.
- **Fallback**: Record the uninstall-and-install fallback as FAIL for C8; PRD 00004 then plans a documented reinstall instead of a transparent update.

**Risk**: A reference whose target moved is missed, so a skill reads a nonexistent agent file at runtime.
- **Impact**: High.
- **Likelihood**: Medium.
- **Mitigation**: Inventory classification, the `rg` sweep, path existence checks, and the plugin's own prose tests.
- **Fallback**: The behavior harness's fixture for `render_prompt.py` fails; the release is refused.

**Risk**: `npx plugins` double-detects `com.anthropic.claude-code/` or per-skill directories in a real package.
- **Impact**: Medium.
- **Likelihood**: Medium.
- **Mitigation**: Probe on the local tree before the release and on the pushed repository after it.
- **Fallback**: Mark C9 FAIL; PRD 00005's portability proof is re-planned before any archival.

**Risk**: The release command clobbers sibling entries or leaves the two repositories inconsistent.
- **Impact**: High.
- **Likelihood**: Medium given the 2026 warden incident.
- **Mitigation**: Diff allowlist, sibling comparison, ordered irreversible steps with refusal before each, fixture rehearsal.
- **Fallback**: The command names the last completed step; the maintainer finishes or reverts by hand.

## Dependency Risks

- PRD 00002 must be complete; the harness reuses its profile isolation and evidence channel, and Portage must not be reimplemented here.
- Autopilot keeps changing until this PRD runs. Every count here is an observed hint from 2026-08-26; the execution-time inventory is authoritative. A count change needs no PRD update; a structural change (a new component type, an MCP server, hook entry points moving into or out of `skills/`) does.
- The real release needs push access to both repositories and a machine with `claude`, `uv`, `node`, and `npx`; the maintainer's own installation will auto-update from the repointed entry, so the harness check before the repoint is not optional.
- `claude plugin` CLI behavior (`update`, `list --json`) is documented only in outline; the harness asserts the minimum and records raw output.

## Scope Risks

- No autopilot behavior or content change beyond layout-required paths; the legacy-red tests and the `user_invocable` frontmatter cleanup stay out.
- No archival of `claude-autopilot`, no README pointer there, and no compatibility-repository slimming; those are PRD 00005.
- No Codex, Cursor, Copilot, or VS Code install proof; the probe stops at discovery because autopilot's skills are Claude-bound.
- No MCP handling and no other plugin.

## References

- `dev/local/discovery/00001-agent-plugins-monorepo.md`
- PRD `00002-portage-client-v1.md`, PRD `00004-agent-plugins-monorepo-v1.md`, PRD `00005-agent-plugins-cutover-v1.md`
- `buvis/claude-autopilot` at version 0.1.2 (inventory re-derives the current state)
- `buvis/claude-plugins/scripts/release-plugin` and `scripts/validate-versions.mjs`
- Claude Code plugin reference and marketplace documentation (`git-subdir` source shape, custom `agents` and `hooks` paths, `claude plugin` subcommands), verified 2026-08-26
- Agent Plugins 1.0.0 and Agent Skills specifications

## Glossary

- **Moved target**: A hook command, agent file, or reference whose file moves under `com.anthropic.claude-code/`; only these are rewritten.
- **Root target**: A path that stays at the package root (`skills/`, `lib/`, `dist/`), left byte-identical.
- **Parity**: Equality of the migrated test outcomes with the recorded legacy baseline, node by node.
- **Old-source profile**: An isolated Claude profile that installed the plugin from the legacy `url` entry before the switch.
- **Claim**: One row of the verdict table (C1 to C9) with a PASS or FAIL outcome and evidence.

## Open Questions

None. Counts are execution-time facts, the evidence channel for live hook execution is inherited from the PRD 00002 fixture gate, and a FAIL claim ends this PRD with the table written rather than an improvised fix.
