---
catchup: force
rework_cap: 5
design: run
---

# PRD: Agent Plugins cutover and portability proof

## Problem Statement

After the eight plugins have shipped and updated successfully from the monorepo, the old repositories and release/drift tooling become misleading duplicate sources. The migration is not complete until the portable tree is proven in non-Claude clients, install documentation points at the monorepo, legacy repositories are safely archived, and `buvis/claude-plugins` is reduced to its compatibility-marketplace role. Every destructive step must be guarded by current release and marketplace evidence so cutover never archives a source still serving users.

## Target Users

- Existing Claude Code users who retain the `buvis-plugins` marketplace and need uninterrupted updates.
- New Claude, Codex, Cursor, Copilot CLI, and VS Code users who need accurate monorepo install instructions.
- The solo maintainer, who needs one active source of plugin code and release automation.
- Future contributors, who need archived repositories to point unambiguously at `buvis/agent-plugins`.

## Success Metrics

- `npx plugins discover buvis/agent-plugins` reports all nine package identities exactly once.
- `npx plugins add buvis/agent-plugins` installs portable skills into Codex and every other supported client present on the machine; `check-python-compat` triggers and completes successfully in Codex against a synthetic fixture.
- Every legacy `buvis/claude-<name>` repository is archived only after its released monorepo tag, `git-subdir` compatibility entry, auto-update proof, and behavior evidence are re-verified.
- `buvis/claude-plugins` retains only `.claude-plugin/marketplace.json`, `README.md`, and one CI workflow running `claude plugin validate .`; the old release and drift scripts are absent.
- All install docs point to the monorepo or compatibility marketplace and no active developer workflow targets the retired per-plugin layout.

## Capability Tree

### Capability: Cutover readiness

Prove every plugin is already served and verified from the monorepo before removing or archiving anything.

#### Feature: Per-plugin release readiness gate
- **Description**: Re-check the complete migration/release premise for all eight plugins at execution time.
- **Inputs**: Monorepo package versions/tags, compatibility marketplace entries, isolated auto-update evidence, CI and behavior results, legacy repository state.
- **Outputs**: Per-plugin READY or SKIP report and an aggregate go/no-go status.
- **Behavior**: Premise: all eight first monorepo releases (autopilot from PRD 00003, the other seven from PRD 00004) succeeded and are the active compatibility sources. Any missing/mismatched tag, source, version, evidence, or unported legacy commit causes that plugin to be skipped and blocks destructive cutover; never force or infer readiness from the discovery date.

#### Feature: Consumer/reference inventory
- **Description**: Find active documentation, scripts, workflows, marketplaces, and skills that still reference legacy repositories or removed release tools.
- **Inputs**: Monorepo, compatibility repo, eight legacy repos, and `buvis/agent-skills` source repo.
- **Outputs**: Classified reference list and required update/no-op decisions.
- **Behavior**: Distinguish historical changelog/PRD references from active install/release instructions; historical references may remain.

### Capability: Non-Claude portability proof

Demonstrate that the portable core is discoverable, installable, and usable outside Claude.

#### Feature: Unique repository discovery
- **Description**: Run Vercel `npx plugins discover` against `buvis/agent-plugins` and validate the complete package set.
- **Inputs**: Released public monorepo.
- **Outputs**: Normalized list containing portage, checkup, strunk, git-ferry, warden, aegis, loupe, agoge, and autopilot once each.
- **Behavior**: Fail on missing, duplicate, nested-namespace, or unexpected plugin identities.

#### Feature: Present-client installation matrix
- **Description**: Install the repository through `npx plugins add` into Codex and each supported non-Claude client detected on the machine.
- **Inputs**: Released repository, isolated client profiles, installed Codex plus optional Cursor, Copilot CLI, and VS Code.
- **Outputs**: Per-client install evidence and explicit absent-client skips.
- **Behavior**: Codex is mandatory; detected optional clients must pass; never mutate the maintainer's normal profiles when an isolated profile/configuration is supported.

#### Feature: Portable skill execution
- **Description**: Invoke strunk's `check-python-compat` skill in Codex to prove an installed skill can trigger and complete without Claude-only paths.
- **Inputs**: Isolated Codex installation and a synthetic Python file containing a known Python 3.11-only construct while targeting Python 3.10.
- **Outputs**: Completed skill result identifying the incompatibility and remediation.
- **Behavior**: Assert actual skill execution, not only file presence; keep the fixture synthetic and deterministic.

### Capability: Legacy repository retirement

Make the monorepo the sole active plugin-code source while preserving readable history and rollback.

#### Feature: Legacy README pointers
- **Description**: Put a prominent monorepo migration notice and install pointer in each legacy repository before archival.
- **Inputs**: Eight legacy READMEs and final monorepo package paths.
- **Outputs**: Committed/pushed notices that name the package's new source and release/tag convention.
- **Behavior**: Preserve historical content below the notice; do not delete legacy source history.

#### Feature: Guarded GitHub archival
- **Description**: Archive each legacy repository only after its readiness and README checks pass.
- **Inputs**: Per-plugin READY state, pushed README commit, GitHub repository settings.
- **Outputs**: Eight read-only archived repositories.
- **Behavior**: Re-run the plugin's readiness check immediately before archival; on failure skip and report that repository while leaving it writable.

### Capability: Compatibility marketplace simplification

Remove obsolete implementation/release machinery while retaining the stable Claude marketplace endpoint.

#### Feature: Minimal compatibility repository
- **Description**: Reduce `buvis/claude-plugins` to marketplace JSON, install/migration README, and one validation workflow.
- **Inputs**: Current compatibility repository and proven monorepo release tooling.
- **Outputs**: Minimal repository with no package release or upstream-version drift implementation.
- **Behavior**: Premise: release/version synchronization is active in monorepo `dev/bin/release`, and every entry already uses the monorepo. Immediately re-check consumers and CI before removing `scripts/release-plugin`, `scripts/validate-versions.mjs`, obsolete package metadata, and superseded workflow/content; if any active consumer remains, skip removal and report.

#### Feature: Marketplace-only CI
- **Description**: Keep one CI job that runs `claude plugin validate .` against the compatibility marketplace.
- **Inputs**: Minimal repository and stock Claude CLI.
- **Outputs**: Required passing validation status.
- **Behavior**: Remove the old upstream drift check because the monorepo release command now updates the compatibility entry.

### Capability: Documentation and workflow closure

Point all active workflows at the monorepo and prevent the old layout from reappearing.

#### Feature: Install and maintenance documentation
- **Description**: Update monorepo and compatibility READMEs with Claude and portable-client install paths, client-specific limits, release ownership, and legacy-repo status.
- **Inputs**: Verified commands and results from the portability/install gates.
- **Outputs**: Accurate user and maintainer instructions.
- **Behavior**: State that hooks, commands, agents, rules, and named Claude-dependent skills are not portable; do not claim other-client hook support.

#### Feature: Extract-plugin workflow audit
- **Description**: Ensure no active `extract-plugin` skill still creates the retired one-plugin-per-repository layout.
- **Inputs**: Active and archived skill inventories plus the `buvis/agent-skills` source repository.
- **Outputs**: Updated/validated source skill when present, or a recorded no-op when absent.
- **Behavior**: Premise: no active `extract-plugin` skill was found during PRD authoring on 2026-08-25. Re-check at execution; if a source skill now exists and targets legacy paths, update it in `buvis/agent-skills`, validate it, and run `braid --check`; if absent or already monorepo-aware, skip and report without creating a replacement.

## Repository Structure

```text
agent-plugins/
├── .claude-plugin/marketplace.json
├── .github/workflows/ci.yml
├── dev/
│   ├── bin/prove-portability
│   └── tests/test_portability_proof.py
├── docs/migration.md
├── plugins/{portage,checkup,strunk,git-ferry,warden,aegis,loupe,agoge,autopilot}/
└── README.md

claude-plugins/
├── .claude-plugin/marketplace.json
├── .github/workflows/validate.yml
└── README.md

claude-{checkup,strunk,git-ferry,warden,aegis,loupe,agoge,autopilot}/
└── README.md                         # Migration pointer committed before archive

agent-skills/
└── skills/extract-plugin/           # Conditional: update only if present at execution
```

## Module Definitions

### Module: Readiness Auditor
- **Maps to capability**: Cutover readiness
- **Responsibility**: Reconcile releases, sources, evidence, unported commits, and active references before destructive work.
- **File structure**:
  ```text
  agent-plugins/dev/bin/cutover-readiness
  agent-plugins/dev/tests/test_cutover_readiness.py
  ```
- **Exports**:
  - `dev/bin/cutover-readiness` - per-plugin READY/SKIP report and aggregate status.

### Module: Portability Proof
- **Maps to capability**: Non-Claude portability proof
- **Responsibility**: Extend the PRD 00003 discovery probe to all nine packages, install into isolated present clients, and execute one portable skill in Codex.
- **File structure**:
  ```text
  agent-plugins/dev/bin/prove-portability
  agent-plugins/dev/tests/test_portability_proof.py
  ```
- **Exports**:
  - `dev/bin/prove-portability` - repeatable discovery/install/execution proof.

### Module: Legacy Retirement
- **Maps to capability**: Legacy repository retirement
- **Responsibility**: Commit migration pointers and archive only repositories that remain READY at the final check.
- **File structure**:
  ```text
  claude-<name>/README.md
  ```
- **Exports**:
  - Migration notices and archived GitHub repository state.

### Module: Compatibility Repository
- **Maps to capability**: Compatibility marketplace simplification
- **Responsibility**: Preserve the stable marketplace endpoint and validate it without duplicating release logic.
- **File structure**:
  ```text
  claude-plugins/.claude-plugin/marketplace.json
  claude-plugins/.github/workflows/validate.yml
  claude-plugins/README.md
  ```
- **Exports**:
  - `buvis-plugins` marketplace and its validation status.

### Module: Migration Documentation
- **Maps to capability**: Documentation and workflow closure
- **Responsibility**: Describe supported installation paths, portability boundaries, release ownership, and legacy status.
- **File structure**:
  ```text
  agent-plugins/README.md
  agent-plugins/docs/migration.md
  claude-plugins/README.md
  ```
- **Exports**:
  - User install guide and maintainer migration/cutover guide.

### Module: Developer Workflow Audit
- **Maps to capability**: Documentation and workflow closure
- **Responsibility**: Prevent an existing extraction skill from recreating the retired repository model.
- **File structure**:
  ```text
  agent-skills/skills/extract-plugin/   # Only when present
  ```
- **Exports**:
  - A validated monorepo-aware skill or an explicit absence result.

## Dependency Chain

### Foundation Layer (Phase 0)
No dependencies inside this PRD; external prerequisites PRD 00003 and PRD 00004 must be complete.

- **Readiness Auditor**: Establishes whether each destructive target is safe now.
- **Consumer/Reference Inventory**: Identifies active instructions and tooling that require updates.

### Core Layer (Phase 1)
- **Portability Proof**: Depends on [Readiness Auditor, released monorepo].
- **Migration Documentation**: Depends on [Consumer/Reference Inventory, Portability Proof].
- **Developer Workflow Audit**: Depends on [Consumer/Reference Inventory].

### Integration Layer (Phase 2)
- **Legacy Retirement**: Depends on [Readiness Auditor, Portability Proof, Migration Documentation].
- **Compatibility Repository**: Depends on [Readiness Auditor, Portability Proof, Migration Documentation, Developer Workflow Audit].

### Verification Layer (Phase 3)
- **Final Cutover Verification**: Depends on [Legacy Retirement, Compatibility Repository, Portability Proof].

## Development Phases

### Phase 0: Re-establish cutover premises
**Goal**: Produce current, machine-checkable readiness and consumer inventories.

**Entry Criteria**: PRD 00004 reports the seven remaining first monorepo releases on top of autopilot's from PRD 00003, and a green nine-package regression.

**Tasks**:
- [ ] Implement and run the per-plugin readiness audit (depends on: [PRD 00004]).
  - Acceptance criteria: Each plugin is READY only when package/shim/marketplace versions match a pushed `<name>/vX.Y.Z` tag, the compatibility source is the correct monorepo `git-subdir`, CI/behavior/auto-update evidence is current, and the legacy repo has no unported commit; any mismatch emits SKIP and a non-zero aggregate result.
  - Test strategy: Fixture states independently invalidate every premise and prove no destructive command is reached.
- [ ] Inventory active legacy references across all in-scope repositories and skill sources (depends on: [readiness audit]).
  - Acceptance criteria: Results classify active install/release/workflow references separately from historical text and include the current status of `extract-plugin`.
  - Test strategy: Seed synthetic active/historical references and assert classification plus repository/path provenance.

**Exit Criteria**: All eight plugins are READY and every active reference has a planned update or explicit valid retention.

**Delivers**: A fresh go/no-go basis for cutover.

---

### Phase 1: Prove portable discovery, installation, and execution
**Goal**: Demonstrate real non-Claude value before retiring any source.

**Entry Criteria**: Phase 0 complete.

**Tasks**:
- [ ] Implement a non-destructive isolated portability harness (depends on: [readiness auditor]).
  - Acceptance criteria: The harness uses `npx plugins discover` and `add`, isolates client profiles where supported, requires Codex, detects optional Cursor/Copilot CLI/VS Code clients, and emits a normalized per-client result.
  - Test strategy: Mock only client detection/process boundaries; integration runs use real `npx plugins` and real installed clients.
- [ ] Prove unique discovery of all nine released packages (depends on: [portability harness]).
  - Acceptance criteria: `dev/bin/prove-portability` reports exactly the nine expected plugin identities once each and fails on missing, duplicate, nested, or unexpected results.
  - Test strategy: Parser fixtures cover ordering/noise while the integration assertion uses the public repository.
- [ ] Install into every present target and execute `check-python-compat` in Codex (depends on: [unique discovery]).
  - Acceptance criteria: Codex installation succeeds; every detected optional client installs successfully or fails the phase; an actual Codex run triggers the installed skill against the synthetic Python 3.10 compatibility fixture and reports the intended 3.11-only construct and remedy.
  - Test strategy: Use temporary configuration roots, assert installed file provenance, capture redacted invocation output, and verify normal user profiles remain byte-identical where isolation is supported.

**Exit Criteria**: The released monorepo is uniquely discoverable, installs into all present required clients, and one portable skill completes in Codex.

**Delivers**: Re-runnable portability evidence supporting final cutover.

---

### Phase 2: Update active instructions and archive legacy sources
**Goal**: Direct users and maintainer workflows to the monorepo, then make superseded repositories read-only.

**Entry Criteria**: Phase 1 complete and all eight plugins still READY on a fresh audit.

**Tasks**:
- [ ] Update monorepo and compatibility documentation from verified commands (depends on: [portability proof, reference inventory]).
  - Acceptance criteria: READMEs/documentation cover Claude and non-Claude installs, compatibility marketplace continuity, per-plugin releases, namespace limitations, Claude-dependent skills, and rollback/reinstall guidance without claiming portable hooks/agents/commands/rules.
  - Test strategy: Link/command lint plus `rg` assertions against obsolete active install/release instructions.
- [ ] Re-check and conditionally update `extract-plugin` at its `buvis/agent-skills` source (depends on: [reference inventory]).
  - Acceptance criteria: If present and legacy-targeting, its source is updated, validated, committed in the source repo, and `braid --check` passes; if absent/already current, the task records a no-op and creates no new skill or link.
  - Test strategy: Re-run active/archive/source searches and the repository skill validator/braid consistency checks.
- [ ] Commit/push a migration pointer to every legacy README (depends on: [documentation, fresh readiness audit]).
  - Acceptance criteria: Each README names its exact `plugins/<name>/` path, current tag scheme, and supported install route; all eight commits are pushed before archival.
  - Test strategy: Fetch each default branch and assert pointer/link/version text from the remote state.
- [ ] Archive each READY legacy repository (depends on: [pushed README pointers, fresh per-plugin readiness]).
  - Acceptance criteria: Immediately before each archive call, rerun that plugin's readiness checks; failures skip and report without archiving. Successful repositories report `isArchived: true` and retain readable README/source history.
  - Test strategy: Query GitHub after each action and verify the monorepo/compatibility install paths remain green.

**Exit Criteria**: All eight legacy repositories are read-only with visible monorepo pointers and no active workflow recreates their layout.

**Delivers**: One authoritative plugin-code repository with preserved public history.

---

### Phase 3: Reduce and verify the compatibility repository
**Goal**: Leave `buvis/claude-plugins` as a minimal, validated compatibility endpoint.

**Entry Criteria**: Phase 2 complete; all compatibility entries use released monorepo sources; monorepo release automation owns updates.

**Tasks**:
- [ ] Re-check consumers and remove superseded compatibility-repo tooling/content (depends on: [readiness audit, documentation, developer workflow audit]).
  - Acceptance criteria: Immediately before removal, `rg` and workflow inspection prove no active consumer of `scripts/release-plugin`, `scripts/validate-versions.mjs`, obsolete package metadata, or drift workflow remains; on failed premise, skip removal and report. On success, the repository tree contains only `.claude-plugin/marketplace.json`, `README.md`, and `.github/workflows/validate.yml` outside Git internals.
  - Test strategy: Tree allowlist assertion, no-reference assertions, and git diff review identify every deletion explicitly.
- [ ] Add the marketplace-only validation workflow (depends on: [minimal compatibility repository]).
  - Acceptance criteria: The sole workflow provisions stock Claude and runs `claude plugin validate .`; local invocation and CI pass.
  - Test strategy: Validate workflow syntax, execute the same command locally, and observe the pushed CI result.
- [ ] Run final cross-repository cutover verification (depends on: [archival, minimal compatibility repository, portability proof]).
  - Acceptance criteria: Nine monorepo packages pass Portage/Claude CI; portability proof remains green; eight legacy repos are archived; compatibility repo tree/CI are minimal and valid; active-reference scan has no stale install/release target.
  - Test strategy: One read-only verification command aggregates remote repository settings, tags, marketplace contents, CI statuses, docs references, and portability results.

**Exit Criteria**: All success metrics pass from remote state and no required work remains in legacy sources or compatibility tooling.

**Delivers**: Completed spec-first migration and cutover.

## Test Pyramid

```text
        /\
       /E2E\       <- 45% real discovery, client installs, remote archive/CI state
      /------\
     /Integration\ <- 35% readiness, references, marketplace and repo-tree gates
    /------------\
   /  Unit Tests  \ <- 20% parsers, classification, and refusal branches
  /----------------\
```

## Coverage Requirements
- Line coverage: 90% minimum for new readiness and portability harness logic.
- Branch coverage: 100% for destructive-action skip/refusal branches.
- Function coverage: 100% for public cutover/proof entry points.
- Statement coverage: 90% minimum for new code; existing monorepo thresholds remain unchanged.

## Critical Test Scenarios

### Readiness and Retirement
**Happy path**:
- Released tag, package/shim/marketplace versions, auto-update evidence, behavior, and legacy HEAD all reconcile.
- Expected: Plugin is READY, receives a pushed README pointer, then archives successfully.

**Edge cases**:
- Seven plugins are ready and one has an unported legacy commit or mismatched source.
- Expected: The affected repository is skipped, aggregate cutover fails, and no destructive work is forced.

**Error cases**:
- Remote state changes between initial audit and archive call.
- Expected: Immediate re-check catches the change and leaves the repository writable.

**Integration points**:
- Monorepo tags/packages, compatibility marketplace, GitHub repository settings, and isolated behavior evidence.
- Expected: One plugin identity traces consistently through every system.

### Portability Proof
**Happy path**:
- Nine packages are discovered once, installed into Codex and present clients, and `check-python-compat` completes.
- Expected: Normalized proof exits 0 with client/version/provenance evidence.

**Edge cases**:
- Optional client is absent or a plugin has only Claude-specific components.
- Expected: Absent optional client is explicit; package discovery remains correct; no portable hook claim is made.

**Error cases**:
- Duplicate namespace discovery, missing package, failed install, or skill file present but not invocable.
- Expected: Non-zero result identifying plugin, client, and failed stage.

**Integration points**:
- Public GitHub repository, npm-delivered plugins CLI, isolated client profiles, and real Codex execution.
- Expected: Proof uses the released tree, not a local uncommitted checkout.

### Compatibility Repository Cleanup
**Happy path**:
- All entries use monorepo sources and no old script has a consumer.
- Expected: Only the marketplace, README, and one validation workflow remain.

**Edge cases**:
- Historical PRDs/changelogs mention old repos.
- Expected: They are not mistaken for active install/release consumers.

**Error cases**:
- A workflow or documented command still invokes an old script.
- Expected: Removal is skipped and reported; files remain recoverable.

**Integration points**:
- Monorepo release command updates compatibility JSON and compatibility CI validates it.
- Expected: No duplicated version-drift implementation remains.

## Test Generation Guidelines

Make destructive paths impossible to reach in tests by injecting repository/archive operations behind command boundaries and asserting call absence on every failed premise. Use real read-only remote queries for final verification. Use temporary client configurations and synthetic code fixtures; redact credentials/tokens from captured logs. Classify references semantically so historical evidence does not block cutover while active instructions always do.

## System Components

- Current-state readiness and active-reference auditor.
- `npx plugins` discovery/install harness plus real Codex skill execution.
- Monorepo, compatibility, and legacy documentation updates.
- Guarded GitHub archive operations.
- Minimal compatibility marketplace repository and stock-Claude CI.
- Conditional audit/update of the source-owned `extract-plugin` skill.

## Data Models

- Readiness record: plugin identity, package/shim/marketplace version, source path, released tag/commit, evidence references, legacy HEAD, and READY/SKIP reasons.
- Client proof: client name/version, detected/required state, isolated config location, installed package/skill provenance, execution result, and redacted log reference.
- Active reference: repository/path/line, target legacy concept, classification as active or historical, and disposition.
- Retirement record: legacy repo, final readiness timestamp/result, README commit, archive result, and post-action remote check.
- Compatibility tree allowlist: the three required files and no unapproved extras.

## Technology Stack

- Portage, CI, the discovery probe, and `docs/migration.md` delivered by PRDs 00002-00004.
- Vercel `npx plugins` CLI for discovery and multi-client installation.
- Codex CLI for the mandatory portable skill execution proof.
- Git/GitHub CLI/API for remote state, README pushes, and repository archival.
- Stock Claude Code for compatibility marketplace validation.
- Repository-owned scripts/tests for deterministic readiness and proof aggregation.

**Decision: Proof before retirement**
- **Rationale**: A spec-clean tree is insufficient; users need observed installation and execution before duplicate sources become read-only.
- **Trade-offs**: Cutover depends on available external clients and authenticated remote operations.
- **Alternatives considered**: Schema-only signoff or archiving immediately after code migration.

**Decision: Keep `buvis/claude-plugins` as a minimal compatibility endpoint**
- **Rationale**: Existing users keep their marketplace identity and auto-update path while implementation and release ownership move to the monorepo.
- **Trade-offs**: One small second repository and validation workflow remain maintained.
- **Alternatives considered**: Deleting the marketplace, forcing all users to re-add, or keeping duplicated release/drift tooling.

## Technical Risks

**Risk**: `npx plugins` discovery is incomplete or duplicates namespaced content.
- **Impact**: High.
- **Likelihood**: Medium until the released repository proof runs.
- **Mitigation**: Exact nine-identity assertion before archival.
- **Fallback**: Stop cutover and fix package/discovery compatibility in a new attended PRD; keep legacy repos active.

**Risk**: A client install mutates a real user profile or cannot run headlessly.
- **Impact**: High.
- **Likelihood**: Medium.
- **Mitigation**: Detect documented isolated configuration mechanisms and compare normal-profile state before/after.
- **Fallback**: Do not claim that client passed; keep cutover blocked if the mandatory Codex proof cannot complete.

**Risk**: Archival races with an unported legacy change.
- **Impact**: High.
- **Likelihood**: Low to medium.
- **Mitigation**: Re-check legacy HEAD and all readiness evidence immediately before each archive operation.
- **Fallback**: Skip that repository; after correcting the monorepo release, rerun readiness from the beginning.

**Risk**: Compatibility cleanup removes tooling still called elsewhere.
- **Impact**: Medium.
- **Likelihood**: Medium.
- **Mitigation**: Active-reference inventory plus execution-time consumer re-check and explicit tree diff.
- **Fallback**: Skip deletion and report the consumer; retain files until a follow-up removes the dependency.

## Dependency Risks

- PRDs 00003 and 00004 must have completed all eight verified releases; a partial migration is not a valid entry state.
- `npx`, Codex, stock Claude, authenticated GitHub access, and any optional installed clients must be available for their respective proof/action steps.
- Remote repository settings and marketplace entries can change during execution, so cached discovery facts never authorize archival.

## Scope Risks

- Creating or retiring a separate Codex marketplace is excluded; `npx plugins` is the portability path in this PRD.
- No emitter for another client's hook/agent/command system is added.
- No plugin behavior, skill-body portability rewrite, legacy frontmatter cleanup, MCP support, or Agent Plugins 1.1 support is included.
- Historical source and changelog references remain valid evidence and are not mass-rewritten.

## References

- `dev/local/discovery/00001-agent-plugins-monorepo.md`
- PRD `00002-portage-client-v1.md`
- PRD `00003-agent-plugins-poc-autopilot-v1.md`
- PRD `00004-agent-plugins-monorepo-v1.md`
- Released `buvis/agent-plugins` repository and per-plugin `<name>/vX.Y.Z` tags
- Compatibility marketplace `buvis/claude-plugins`
- Legacy `buvis/claude-{checkup,strunk,git-ferry,warden,aegis,loupe,agoge,autopilot}` repositories
- Source-owned skills repository `buvis/agent-skills`

## Glossary

- **Cutover**: The point after verified monorepo releases when legacy code repositories become read-only and active tooling points to the monorepo.
- **READY**: All current package, release, source, evidence, and legacy-HEAD premises pass for one plugin.
- **Present client**: A supported non-Claude client detected on the execution machine; Codex is mandatory regardless.
- **Compatibility endpoint**: The retained `buvis-plugins` marketplace used by existing Claude installations.
- **Historical reference**: Non-executable documentation of past state that does not direct current installation or release behavior.

## Open Questions

None. The optional Codex marketplace is excluded. `extract-plugin` is handled by an execution-time conditional because it was absent from both active and archived skill locations during authoring; absence must not cause a replacement skill to be invented.
