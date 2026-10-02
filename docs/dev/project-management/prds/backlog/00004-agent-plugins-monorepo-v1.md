---
catchup: force
rework_cap: 5
design: run
---

# PRD: Agent Plugins monorepo migration and release model

## Problem Statement

Seven production Claude plugins still live in their own repositories in Claude's proprietary layout after PRD 00003 moved autopilot into `buvis/agent-plugins` and proved the package recipe, the committed shim, the two-marketplace release command, the isolated Claude behavior harness, and the `url` to `git-subdir` cutover on a live plugin. Skills cannot be installed from one portable tree into Codex, Cursor, Copilot CLI, or VS Code, while releases still run through the legacy per-repository scripts. With Portage (PRD 00002) and the autopilot proof of concept (PRD 00003) complete and its verdict clean, the remaining seven plugins must move additively into the monorepo as conformant Agent Plugins 1.0 packages using the same tooling, without changing their observable behavior or breaking existing `buvis-plugins` marketplace users.

## Target Users

- The solo maintainer, who needs one repository, one release command, and independent per-plugin versions.
- Existing Claude Code users, who must receive each plugin's first monorepo release through the marketplace they already use.
- New Claude Code users, who need one installable monorepo marketplace containing Portage and all eight migrated plugins.
- Other-client users and PRD 00005, which need one spec-first source tree for portability proof and final cutover.

## Success Metrics

- All nine packages pass Portage `validate` and `check`; all existing per-plugin tests and Portage tests pass in monorepo CI.
- `claude plugin validate .` passes for a relative-source marketplace containing all nine plugins.
- A clean Claude profile exposes, for each of the seven newly migrated plugins, the same skills, commands, agents, and hook outcomes as its legacy installation, as recorded by its execution-time inventory (observed 2026-08-26: 26 skills, 10 commands, 7 agents, plus the aegis, warden, and loupe hook suites); autopilot keeps its PRD 00003 behavior and Portage adds its own skill.
- Each migrated plugin retains its source version and changelog history until its first monorepo release.
- `dev/bin/release strunk patch` produces one release commit and `strunk/vX.Y.Z`, changes only strunk's package/marketplace entries, and updates the compatibility marketplace without touching siblings.
- Each of the seven first releases repeats the PRD 00003 auto-update observation on an old-source profile and matches the outcome recorded in the PRD 00003 verdict (in-place update, or the documented reinstall fallback); each successful first release becomes that plugin's reversible cutover point.

## Capability Tree

### Capability: Additive plugin migration

Move each legacy plugin into a conformant package while preserving its version, history, tests, and client-specific behavior.

#### Feature: Authoritative source inventory and re-check
- **Description**: Capture the exact legacy manifest version, content classes, tests, uncommitted state, and unreleased commits before copying each plugin, with the PRD 00003 inventory tool.
- **Inputs**: `buvis/claude-{checkup,strunk,git-ferry,warden,aegis,loupe,agoge}` worktrees and origins; `dev/bin/inventory-plugin`.
- **Outputs**: Per-plugin migration inventory, test baseline, and a pass/skip decision.
- **Behavior**: Premise: each legacy repository remains the authoritative installable source until that plugin's first monorepo release. Re-check immediately before migration and release; if a source is dirty, missing, or has newer unported commits, skip that plugin and report rather than overwrite or release stale content. Counts are derived by the tool, never hard-coded in this PRD.

#### Feature: Portable core layout
- **Description**: Give every plugin a closed root `plugin.json`, root `skills/`, optional portable files, and unchanged support/test content at plugin root.
- **Inputs**: Legacy plugin content, preserved manifest metadata, Agent Plugins 1.0.0 schema, the `plugins/autopilot` package as the worked example.
- **Outputs**: `plugins/<name>/` packages for checkup, strunk, git-ferry, warden, aegis, loupe, and agoge.
- **Behavior**: Preserve versions, changelogs, READMEs, tests, source, libraries, templates, rules, and warden `dist/`; keep each repository's `dev/bin/release-checks` and `release-build` as the per-plugin hooks the release command runs; do not claim hooks, commands, agents, or rules are portable.

#### Feature: Claude namespace relocation
- **Description**: Move Claude-only hooks, commands, and agents under `com.anthropic.claude-code/` and generate the committed shim.
- **Inputs**: Legacy Claude-only component directories and Portage `emit`.
- **Outputs**: Namespaced component trees and current `.claude-plugin/plugin.json` files.
- **Behavior**: Rewrite `${CLAUDE_PLUGIN_ROOT}` only where its target moved into the namespace directory; keep references to root `lib/`, `dist/`, rules, templates, and skills unchanged; preserve component behavior. Loupe's six commands and aegis's `gateguard` skill name `hooks/` paths that move; warden's `hooks.json` targets `dist/index.cjs`, which stays.

#### Feature: Plugin-specific preservation
- **Description**: Retain the non-uniform artifacts that make each plugin buildable and testable.
- **Inputs**: checkup helpers, git-ferry bats-core, warden build output, aegis/loupe hook packages, agoge agent metadata.
- **Outputs**: Runnable tests/builds inside the monorepo.
- **Behavior**: Initialize git-ferry's submodule recursively, compare fresh warden builds with committed `dist/`, keep loupe's `hooks/loupe/` package and its `hooks/tests/` beside the hook scripts they exercise, and retain every existing per-plugin test command.

### Capability: Monorepo marketplace and Claude compatibility

Install all nine spec packages in stock Claude through relative sources and committed shims.

#### Feature: Native monorepo marketplace
- **Description**: Extend the two-entry `buvis-agent-plugins` marketplace from PRD 00003 to one relative `./plugins/<name>` source per package.
- **Inputs**: Nine package manifests and shims.
- **Outputs**: A stock-Claude-valid nine-entry marketplace.
- **Behavior**: Preserve plugin identities from their manifests, use only relative sources, and keep marketplace versions equal to package/shim versions.

#### Feature: Compatibility marketplace transition
- **Description**: Repoint each of the seven remaining `buvis/claude-plugins` entries from its legacy repository URL to the released monorepo subdirectory.
- **Inputs**: Existing `buvis-plugins` marketplace entry, monorepo repository URL, plugin subdirectory, released version.
- **Outputs**: Same marketplace/plugin identity with `git-subdir` source and synchronized version.
- **Behavior**: Change one entry only on that plugin's first monorepo release so existing installations can auto-update without re-adding a marketplace; the compatibility drift check already resolves `git-subdir` entries since PRD 00003.

#### Feature: Isolated Claude behavior verification
- **Description**: Run the PRD 00003 behavior harness for each migrated plugin against its inventory and legacy installation.
- **Inputs**: Monorepo marketplace, `dev/bin/verify-claude-install`, per-plugin inventories, per-plugin hook fixtures.
- **Outputs**: Machine-checkable component inventory and hook behavior evidence per plugin.
- **Behavior**: Extend the harness fixtures to warden (Bash allow/deny and SessionStart), aegis (each PreToolUse block), and loupe (Write/Edit, Read, Stop); skill-only plugins are checked on inventory alone.

### Capability: Per-plugin release automation

Release one package without coupling sibling versions or content.

#### Feature: Release command extension
- **Description**: Extend `dev/bin/release <name> [patch|minor|major]` from PRD 00003 with the plugin-specific steps the remaining packages need.
- **Inputs**: Plugin name, bump, `plugins/<name>/dev/bin/{release-checks,release-build}`, git-ferry's submodule state, both marketplace entries.
- **Outputs**: One conventional release commit and `<name>/vX.Y.Z` tag, exactly as for autopilot.
- **Behavior**: Run `release-build` after the bump and before the commit (warden rebuilds `dist/`), refuse a release when a fresh warden build differs from the committed `dist/` after the rebuild, refuse when git-ferry's `tests/lib/bats-core` submodule is empty, and keep every existing refusal (unknown name, dirty tree, empty `[Unreleased]`, out-of-scope diff, existing tag, harness failure before repoint, push failure).

#### Feature: Release regression harness extension
- **Description**: Add the new refusal and build paths to `dev/tests/test_release.py`.
- **Inputs**: Temporary Git repositories, fake remotes, fixture marketplaces, a fixture `release-build`, a fixture submodule.
- **Outputs**: Deterministic integration test results.
- **Behavior**: Cover the build hook, stale-build refusal, empty-submodule refusal, and repeat the sibling-entry clobber class with seven remaining `url` entries beside autopilot's `git-subdir` entry.

### Capability: Monorepo continuous integration

Run portable validation, Claude compatibility checks, and every preserved test suite on each change.

#### Feature: Package-wide Portage gates
- **Description**: Keep the PRD 00003 glob-based discovery running Portage validation and shim checking on every `plugins/*/plugin.json` package.
- **Inputs**: Monorepo plugin directories.
- **Outputs**: Per-package validation/check status with no hard-coded omission.
- **Behavior**: Fail when a package is invalid, a shim is stale, or a new package lacks a marketplace entry.

#### Feature: Preserved plugin test matrix
- **Description**: Run checkup, aegis, loupe, git-ferry, and warden tests using their required runtimes beside the existing Portage and autopilot jobs.
- **Inputs**: Python pytest suites, bats-core submodule, Node/vitest project, committed warden build.
- **Outputs**: One CI status covering all maintained behavior.
- **Behavior**: Clone recursively, compare warden's fresh build with `dist/`, run each plugin's `dev/bin/release-checks`, and expose skipped/missing toolchains as failures unless the job explicitly provisions them.

#### Feature: Claude marketplace validation
- **Description**: Validate the repository marketplace and every shim with stock Claude tooling.
- **Inputs**: Repository root, marketplace, nine packages.
- **Outputs**: Passing `claude plugin validate .` result.
- **Behavior**: Run after Portage gates so errors identify whether the portable package, generated shim, or marketplace failed.

## Repository Structure

```text
agent-plugins/
├── .claude-plugin/marketplace.json        # nine entries
├── .github/workflows/ci.yml
├── dev/
│   ├── bin/inventory-plugin               # PRD 00003
│   ├── bin/verify-migration               # PRD 00003
│   ├── bin/verify-claude-install          # PRD 00003, fixtures extended
│   ├── bin/release                        # PRD 00003, build and submodule steps added
│   ├── local/migration-inventory/         # gitignored, one inventory and baseline per plugin
│   └── tests/test_release.py              # PRD 00003, cases added
├── plugins/
│   ├── portage/                           # PRD 00002
│   ├── autopilot/                         # PRD 00003
│   ├── checkup/
│   ├── strunk/
│   ├── git-ferry/
│   ├── warden/
│   ├── aegis/
│   ├── loupe/
│   └── agoge/
│       ├── plugin.json
│       ├── .claude-plugin/plugin.json
│       ├── CHANGELOG.md
│       ├── README.md
│       ├── dev/bin/{release-checks,release-build}   # When the legacy repo has them
│       ├── skills/                        # When the plugin has skills
│       ├── com.anthropic.claude-code/
│       │   ├── hooks/                     # When the plugin has Claude hooks
│       │   ├── commands/                  # When the plugin has Claude commands
│       │   └── agents/                    # When the plugin has Claude agents
│       ├── lib|src|dist|rules|scripts|templates/
│       └── tests/
├── README.md
└── LICENSE

claude-plugins/
└── .claude-plugin/marketplace.json        # Compatibility entries updated per release
```

## Module Definitions

### Module: Migration Inventory
- **Maps to capability**: Additive plugin migration
- **Responsibility**: Establish and re-check each legacy repository as the source of truth before copy or release, using the PRD 00003 tool.
- **File structure**:
  ```text
  dev/bin/inventory-plugin
  dev/local/migration-inventory/
  ```
- **Exports**:
  - Per-plugin inventory records - versions, commits, content counts, tests, references, baseline, and pass/skip state.

### Module: Portable Plugin Packages
- **Maps to capability**: Additive plugin migration
- **Responsibility**: Hold the Agent Plugins 1.0 portable manifests, skills, support content, docs, and tests for the seven newly migrated plugins.
- **File structure**:
  ```text
  plugins/{checkup,strunk,git-ferry,warden,aegis,loupe,agoge}/
  ```
- **Exports**:
  - Root `plugin.json` - per-plugin portable identity/version contract.
  - Root `skills/` - portable component location.
  - Existing plugin libraries, builds, rules, scripts, templates, tests, and release hooks.

### Module: Claude Extension Packages
- **Maps to capability**: Additive plugin migration
- **Responsibility**: Isolate Claude-only components and expose them through Portage-generated shims.
- **File structure**:
  ```text
  plugins/<name>/com.anthropic.claude-code/{hooks,commands,agents}/
  plugins/<name>/.claude-plugin/plugin.json
  ```
- **Exports**:
  - Namespaced hook, command, and agent components.
  - Claude shim consumable by stock Claude Code.

### Module: Marketplace Integration
- **Maps to capability**: Monorepo marketplace and Claude compatibility
- **Responsibility**: Keep native and compatibility marketplaces synchronized with independently released packages.
- **File structure**:
  ```text
  agent-plugins/.claude-plugin/marketplace.json
  claude-plugins/.claude-plugin/marketplace.json
  ```
- **Exports**:
  - `buvis-agent-plugins` marketplace with nine relative sources.
  - `buvis-plugins` compatibility entries with per-plugin `git-subdir` cutover.

### Module: Release Tooling
- **Maps to capability**: Per-plugin release automation
- **Responsibility**: Extend the PRD 00003 release command with build and submodule steps and keep it scoped to exactly one plugin.
- **File structure**:
  ```text
  dev/bin/release
  dev/tests/test_release.py
  ```
- **Exports**:
  - `dev/bin/release <name> [patch|minor|major]` - public release command.

### Module: Monorepo CI
- **Maps to capability**: Monorepo continuous integration
- **Responsibility**: Run all portable, Claude, build-freshness, and migrated behavior gates.
- **File structure**:
  ```text
  .github/workflows/ci.yml
  ```
- **Exports**:
  - Required CI status covering all nine packages and existing test suites.

### Module: Claude Behavior Harness
- **Maps to capability**: Monorepo marketplace and Claude compatibility
- **Responsibility**: Run the PRD 00003 harness per plugin with fixtures for each hook-bearing package.
- **File structure**:
  ```text
  dev/bin/verify-claude-install
  dev/tests/fixtures/claude-behavior/
  ```
- **Exports**:
  - `dev/bin/verify-claude-install` - repeatable install and behavior proof.

## Dependency Chain

### Foundation Layer (Phase 0)
No dependencies inside this PRD; external prerequisites PRD 00002 and PRD 00003 (verdict clean) must be complete.

- **Migration Inventory**: Establishes source versions, commits, counts, references, baselines, and tests for the seven plugins.
- **Portage and PRD 00003 tooling**: Provide the validator, emitter, checker, inventory tool, migration verifier, behavior harness, release command, and CI base.

### Core Layer (Phase 1)
- **Portable Plugin Packages**: Depends on [Migration Inventory, Portage].
- **Claude Extension Packages**: Depends on [Migration Inventory, Portable Plugin Packages, Portage].

### Integration Layer (Phase 2)
- **Marketplace Integration**: Depends on [Portable Plugin Packages, Claude Extension Packages].
- **Monorepo CI**: Depends on [Portable Plugin Packages, Claude Extension Packages, Portage].
- **Claude Behavior Harness**: Depends on [Marketplace Integration, Claude Extension Packages].

### Release Layer (Phase 3)
- **Release Tooling**: Depends on [Marketplace Integration, Monorepo CI, Portage].
- **Staged Plugin Releases**: Depends on [Release Tooling, Claude Behavior Harness, Monorepo CI].

## Development Phases

### Phase 0: Inventory and guard the legacy sources
**Goal**: Freeze a reproducible migration baseline for the seven plugins without making legacy repositories unavailable.

**Entry Criteria**: PRD 00002 is complete; PRD 00003 is complete and `dev/bin/poc-verdict` exits 0; the seven legacy repositories and `buvis/claude-plugins` are readable.

**Tasks**:
- [ ] Inventory each of the seven legacy repositories with `dev/bin/inventory-plugin` (depends on: [PRD 00003]).
  - Acceptance criteria: A machine-readable inventory and test baseline exist per plugin; totals are reported from the tool and reconcile with each plugin's README (observed 2026-08-26: 26 skills, 10 commands, 7 agents, plus the discovered hook suites); dirty/missing/diverged sources are marked skipped and reported.
  - Test strategy: Re-run inventory from a fresh shell and byte-compare normalized output.
- [ ] Record per-plugin migration allowlists (depends on: [inventory]).
  - Acceptance criteria: Each plugin has a diff allowlist naming the layout-required changes (moved hook and command targets, shim, manifest, README install text, changelog entry) that `dev/bin/verify-migration` will accept; anything else must be byte-identical.
  - Test strategy: `verify-migration` on an untouched copy reports only the allowlisted paths as expected differences.

**Exit Criteria**: Every plugin has a verified migration baseline or this PRD stops with a named skipped plugin.

**Delivers**: A safe additive migration starting point.

---

### Phase 1: Migrate the seven packages
**Goal**: Create conformant spec packages and namespaced Claude components without behavior changes.

**Entry Criteria**: Phase 0 complete with no skipped plugin.

**Tasks**:
- [ ] Migrate checkup and strunk (depends on: [migration inventory, Portage]).
  - Acceptance criteria: checkup's skills and Python helpers plus strunk's skills validate; versions/changelogs match their inventories; no Claude-only capability is represented as portable; `verify-migration` passes.
  - Test strategy: Portage validation/check, existing checkup pytest, skill count/content comparisons, and legacy-vs-monorepo diff allowlisting only layout-required changes.
- [ ] Migrate git-ferry (depends on: [migration inventory, Portage]).
  - Acceptance criteria: Skills, bats tests, and bats-core submodule are present; a recursive clone runs the original test suite; version/changelog match inventory; `verify-migration` passes.
  - Test strategy: Fresh recursive clone, bats suite, Portage validation/check, and content comparison.
- [ ] Migrate warden (depends on: [migration inventory, Portage]).
  - Acceptance criteria: Hooks and commands live under the Claude namespace; `dist/`, source, Codex hook template, scripts, and `dev/bin/release-build` remain at root; only moved-target `${CLAUDE_PLUGIN_ROOT}` references change; a fresh build matches committed `dist/`; `verify-migration` passes.
  - Test strategy: vitest, build byte/diff check, shim golden check, and legacy/new hook outcome fixtures.
- [ ] Migrate aegis and loupe (depends on: [migration inventory, Portage]).
  - Acceptance criteria: aegis keeps its hooks, `_common.py`, `gateguard` skill, and root rules; loupe keeps its hook package, commands, tests, and ast-grep rules; both pytest suites pass; every command and skill line naming a moved `hooks/` path is rewritten; versions/changelogs match inventory; `verify-migration` passes.
  - Test strategy: Existing pytest suites, component counts, reference-target checks, Portage validation/check, and behavior fixtures.
- [ ] Migrate agoge (depends on: [migration inventory, Portage]).
  - Acceptance criteria: Agents retain their `tools`, inherited model, and color metadata under the Claude namespace; its skill remains at root; version/changelog match inventory; `verify-migration` passes.
  - Test strategy: Parse/compare agent frontmatter, run Portage validation/check, and verify the skill resolves every agent.

**Exit Criteria**: All seven packages pass Portage and their preserved tests; normalized diffs contain only the allowlisted layout and path-reference changes.

**Delivers**: Nine conformant packages in one repository, including Portage and autopilot.

---

### Phase 2: Integrate marketplace, behavior proof, and CI
**Goal**: Make the full monorepo installable in Claude and gate every package/test automatically.

**Entry Criteria**: Phase 1 complete.

**Tasks**:
- [ ] Generate and commit the seven migrated shims (depends on: [migrated packages, Portage]).
  - Acceptance criteria: Portage `check` passes for all nine packages and every optional path corresponds to an existing namespaced directory.
  - Test strategy: Repository-wide package discovery invokes `validate` then `check` on each manifest parent.
- [ ] Extend the monorepo marketplace to nine entries (depends on: [all current shims]).
  - Acceptance criteria: Each package appears once, versions match manifest/shim, sources are `./plugins/<name>`, and `claude plugin validate .` passes.
  - Test strategy: JSON structural assertions plus stock Claude validation.
- [ ] Extend the behavior harness fixtures and run it per plugin (depends on: [monorepo marketplace]).
  - Acceptance criteria: A fresh profile installs all nine packages; for each migrated plugin the harness reports inventory equality with its legacy installation and identical outcomes on the warden, aegis, and loupe hook fixtures.
  - Test strategy: Invoke representative allow/block/write/read/stop fixtures and compare normalized legacy/new outcomes.
- [ ] Complete the CI matrix (depends on: [shims, marketplace, preserved tests]).
  - Acceptance criteria: CI runs all nine Portage gates, Portage pytest, `dev/tests`, checkup/aegis/loupe pytest, every plugin's `dev/bin/release-checks`, git-ferry bats after recursive checkout, warden vitest and fresh-build comparison, and `claude plugin validate .`.
  - Test strategy: Run each exact job command locally and verify package discovery prevents silent omission.

**Exit Criteria**: A clean Claude profile and CI both prove the nine-package set without using legacy repository sources.

**Delivers**: A release-ready monorepo marketplace.

---

### Phase 3: Extend and test scoped releases
**Goal**: Cover the plugin-specific release steps the remaining packages need without weakening the PRD 00003 guarantees.

**Entry Criteria**: Phase 2 complete.

**Tasks**:
- [ ] Add build and submodule steps to `dev/bin/release` (depends on: [CI, marketplaces, Portage]).
  - Acceptance criteria: The command runs `release-build` after the bump, refuses a stale warden `dist/` and an empty git-ferry submodule, and keeps every existing ordered step and refusal; it still touches only the named plugin and its two marketplace entries.
  - Test strategy: Temporary repositories/fake remotes cover the build hook, stale build, empty submodule, and every pre-existing refusal path.
- [ ] Prove first-release source conversion beside an already-converted entry (depends on: [release command]).
  - Acceptance criteria: Fixture releases switch only the selected compatibility entry from `url` to monorepo `git-subdir` on first release, retain that source thereafter, and leave autopilot's existing `git-subdir` entry and every other byte unchanged.
  - Test strategy: Golden marketplace diffs and tests recreating the prior sibling-entry clobber class.

**Exit Criteria**: The full release flow is tested for every remaining plugin shape without publishing a real version and cannot mutate siblings.

**Delivers**: One safe release command for all packages.

---

### Phase 4: Cut over each plugin through a real release
**Goal**: Publish the migrated packages one at a time while preserving existing users' update path.

**Entry Criteria**: Phase 3 complete; all checks green; isolated old-source installation profiles prepared.

**Tasks**:
- [ ] Release and verify each of the seven plugins sequentially (depends on: [release tooling, Claude behavior harness]).
  - Acceptance criteria: Immediately before each release, re-check the legacy source premise, version, unported commits, target package, selected diff, and compatibility entry; on mismatch skip and report without tag/push. On success, the new `<name>/vX.Y.Z` tag exists, only that plugin's entries changed, and the old-profile installation follows the switch with the outcome recorded in the PRD 00003 verdict and equivalent behavior.
  - Test strategy: Preserve before/after marketplace JSON, git diff scopes, tag/commit IDs, and isolated-profile behavior output per plugin.
- [ ] Run the full nine-package regression after the seventh release (depends on: [seven verified releases]).
  - Acceptance criteria: CI, Portage gates, stock Claude validation, and isolated Claude behavior verification are green against released commits; all eight compatibility entries use the intended monorepo `git-subdir` sources.
  - Test strategy: Execute the same commands as required CI plus marketplace source/version assertions.

**Exit Criteria**: All eight plugins have a verified first monorepo release and legacy repositories remain unarchived but no longer serve compatibility marketplace updates.

**Delivers**: The prerequisite state for PRD 00005 cutover and archival.

## Test Pyramid

```text
        /\
       /E2E\       <- 20% isolated Claude installs and real release verification
      /------\
     /Integration\ <- 40% migrated suites, shims, marketplaces, release fixtures
    /------------\
   /  Unit Tests  \ <- 40% release/version/diff rules and package assertions
  /----------------\
```

## Coverage Requirements
- Line coverage: preserve every migrated suite's existing threshold; 90% minimum for new release logic.
- Branch coverage: 90% minimum for release refusal and first-cutover branches.
- Function coverage: 100% for public release command paths.
- Statement coverage: no regression from legacy Python/TypeScript suite baselines.

## Critical Test Scenarios

### Plugin Migration
**Happy path**:
- A clean authoritative legacy plugin is copied, namespaced, minimally reference-rewritten, emitted, and validated.
- Expected: Existing tests and normalized behavior match; manifest version and changelog are preserved.

**Edge cases**:
- Plugin has no skills, has no Claude-only components, uses root helpers, commits build output, or contains a submodule.
- Expected: The package remains conformant and its special artifacts/tests remain usable.

**Error cases**:
- Legacy source is dirty, missing, ahead of inventory, or target differs beyond allowlisted layout changes.
- Expected: That plugin is skipped and reported; no overwrite or release occurs.

**Integration points**:
- Portable package, namespace paths, generated shim, marketplace, and stock Claude loader.
- Expected: Portage and Claude agree on every package.

### Scoped Release
**Happy path**:
- A named patch release updates only that package and its two marketplace entries.
- Expected: One commit/tag/push sequence with equal versions and a current shim.

**Edge cases**:
- First monorepo release changes source type beside autopilot's converted entry; later release retains it; warden needs a fresh build; git-ferry needs a recursive checkout.
- Expected: Required special steps run and sibling files remain byte-identical.

**Error cases**:
- Dirty tree, invalid bump, existing tag, stale shim/dist, empty submodule, failed tests, marketplace mismatch, unrelated diff, or push failure.
- Expected: Non-zero exit before unsafe subsequent steps, with no sibling mutation.

**Integration points**:
- Local monorepo, compatibility checkout, git tags/remotes, CI, and isolated old-source profile.
- Expected: Existing users follow the switch as observed in PRD 00003 and receive equivalent behavior.

## Test Generation Guidelines

Use normalized tree comparisons and behavior fixtures instead of broad snapshots. Preserve each legacy suite rather than replacing it. Test release behavior only against temporary repositories/fake remotes until the explicit real-release phase. Every scope test must compare the complete before/after file set, not merely expected files. Re-run source-premise checks at execution time and treat skips as phase failures requiring a report.

## System Components

- Nine independent Agent Plugins 1.0 package roots under `plugins/`.
- Claude-only namespace directories plus Portage-generated compatibility shims.
- Native monorepo and existing compatibility marketplaces.
- Cross-runtime CI for Python, bats, Node/vitest, Portage, and stock Claude validation.
- The PRD 00003 inventory tool, migration verifier, behavior harness, and scoped release command, extended for the remaining plugin shapes.

## Data Models

- Plugin identity: path, portable manifest name, semantic version, legacy origin/commit, changelog, and first-monorepo-release state.
- Marketplace entry: stable plugin identity, source type/location, description, and version.
- Migration inventory: normalized source facts, component/test counts, and baseline used only after an execution-time freshness check.
- Allowed release diff: selected package version/shim/changelog plus that plugin's entries in the two marketplace files; an empty or additional path set is invalid.
- Release tag: `<name>/vX.Y.Z`, independent from sibling package versions.

## Technology Stack

- Agent Plugins 1.0.0 package/schema and Agent Skills format.
- Portage from PRD 00002 and the `dev/bin` tooling from PRD 00003 on Python 3.10+.
- Existing plugin runtimes: Python/pytest, bats-core, TypeScript/Node/vitest/tsup.
- Git/GitHub, stock Claude Code, and JSON marketplace manifests.
- The `dev/bin/release` interface and implementation language fixed by PRD 00003.

**Decision: Spec-first monorepo with Claude namespace extensions**
- **Rationale**: One tree serves portable clients while committed shims preserve Claude installation, auto-update, bulk install, and older versions.
- **Trade-offs**: Claude-only components remain explicitly non-portable and one generated file per package must stay current.
- **Alternatives considered**: Legacy-only repositories, marketplace command sources, PyPI/`uvx`, Vercel `.plugin/` conversion, and full generated Claude mirrors.

**Decision: Per-plugin releases and additive cutover**
- **Rationale**: Plugins retain independent semver and users can be transitioned and verified one at a time.
- **Trade-offs**: The release command coordinates two repositories and first releases need isolated auto-update observation.
- **Alternatives considered**: Lockstep monorepo versions, one irreversible bulk cutover, and generated mirrors in legacy repositories.

## Technical Risks

**Risk**: Layout moves change `${CLAUDE_PLUGIN_ROOT}` behavior or component resolution.
- **Impact**: High.
- **Likelihood**: Low after PRD 00003 for hooks and agents; medium for commands, which autopilot did not exercise.
- **Mitigation**: Rewrite only moved targets, generate shims through Portage, and compare normalized hook/command/agent behavior.
- **Fallback**: Do not release the affected plugin; legacy source remains installable.

**Risk**: Release automation clobbers sibling entries.
- **Impact**: High.
- **Likelihood**: Medium given prior history.
- **Mitigation**: Full before/after diff allowlist, temporary-repo integration tests, and sequential real releases.
- **Fallback**: Abort before commit/tag/push and restore only the release command's temporary changes.

**Risk**: Warden `dist/` or git-ferry's submodule is stale/missing.
- **Impact**: High for those plugins.
- **Likelihood**: Medium.
- **Mitigation**: Fresh build comparison, recursive clone CI, and execution-time premise checks.
- **Fallback**: Skip the affected plugin release and retain its legacy source.

**Risk**: A skill-less package (warden, loupe) is handled differently by `npx plugins` or by Portage than the skill-bearing autopilot package.
- **Impact**: Medium.
- **Likelihood**: Medium.
- **Mitigation**: `dev/bin/probe-discovery` from PRD 00003 runs on the local tree after each migration; Portage fixtures already cover missing `skills/` as valid absence.
- **Fallback**: Record the discovery result for PRD 00005 and keep the Claude path unaffected.

## Dependency Risks

- PRD 00002 and PRD 00003 must be fully complete with a clean verdict; no duplicate validator, emitter, harness, or release implementation belongs here.
- All seven legacy repositories and the compatibility marketplace must remain readable and unarchived through Phase 4.
- Real releases require authenticated push access and a stock-Claude environment capable of observing auto-update; the maintainer's own installations follow each repoint.

## Scope Risks

- No plugin behavior/content change beyond layout-required paths.
- Legacy `user_invocable` and `argument-hint` frontmatter cleanup is deferred; combining it would obscure migration equivalence.
- MCP support, Codex marketplace retirement, and client-neutral rewrites remain out of scope.
- Legacy repository archival and compatibility-repo cleanup belong only to PRD 00005 after all eight releases succeed.

## References

- `dev/local/discovery/00001-agent-plugins-monorepo.md`
- PRD `00002-portage-client-v1.md`
- PRD `00003-agent-plugins-poc-autopilot-v1.md` and its verdict in `docs/migration.md`
- Existing repositories `buvis/claude-{checkup,strunk,git-ferry,warden,aegis,loupe,agoge}`
- Compatibility marketplace `buvis/claude-plugins/.claude-plugin/marketplace.json`
- Agent Plugins 1.0.0 and Agent Skills specifications

## Glossary

- **Portable core**: Root `plugin.json`, `skills/`, and future `mcp.json` understood by Agent Plugins clients.
- **Claude namespace**: `com.anthropic.claude-code/`, the provisional location for non-portable hooks, commands, and agents.
- **First monorepo release**: A plugin's source cutover from its legacy repository to the monorepo `git-subdir`.
- **Compatibility marketplace**: Existing `buvis-plugins` marketplace whose stable identities preserve user update paths.
- **Scoped release**: A release whose complete diff affects only the named plugin and its corresponding marketplace entries.

## Open Questions

None. The native marketplace name `buvis-agent-plugins` and the release command interface were fixed by PRD 00003. The optional Codex marketplace, legacy frontmatter cleanup, MCP support, and repository archival are explicitly outside this unit of work.
