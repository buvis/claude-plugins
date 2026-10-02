# Discovery: agent-plugins monorepo (spec-first restructure + provisional Claude client)

## Classification
Depth: comprehensive | Date: 2026-08-25

## Problem
Goal: install our skills (and future MCP servers) into Codex, Cursor,
Copilot CLI and VS Code from one tree, while Claude Code keeps its hooks,
commands and agents.
Eight buvis plugins live in eight repos in Claude Code's proprietary layout
(`.claude-plugin/plugin.json`, `hooks/hooks.json`, `commands/`, `agents/`).
Agent Plugins 1.0 (published 2026-08-06 by a TSC of Amazon, Cursor, Microsoft,
OpenAI, Vercel) standardizes a portable package: root `plugin.json`, `skills/`,
`mcp.json`, with client-specific parts under reverse-domain extension dirs.
Claude Code does not read that layout and Anthropic has not joined the TSC or
published a namespace. Rewriting spec-first now means we need our own
provisional client (loader + validator + Claude emitter) to keep installing
into Claude Code until Anthropic adopts the standard.

## Research facts (verified 2026-08-25)
- Spec 1.0.0 portable core: `plugin.json` (closed schema: `$schema`, `name`,
  `version`, `description`, `author{name,email,url}`, `homepage`, `repository`,
  `license`, `keywords`, `extensions`), `skills/<name>/SKILL.md` (Agent Skills
  spec), `mcp.json` (`$schema` + `mcpServers`; stdio / streamable-http / sse;
  `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` expand only in `args`, `env`, `cwd`).
- Out of scope in v1: hooks, commands, agents, rules, LSP. They live under a
  client namespace dir (`com.example.client/`) and/or `extensions.<ns>`;
  clients ignore unknown namespaces. Spec 1.1.0 is a working draft with no new
  component types.
- Schemas vendored at `agentplugins/agent-plugins-spec/schemas/1.0.0/`.
- The org's `migrate-agent-plugin` skill recommends `com.anthropic.claude-code`
  for Claude but says to use a client namespace only when that client publishes
  it; migration should be additive and reversible; never claim hooks, agents,
  or commands became portable.
- Claude Code reads only `.claude-plugin/plugin.json`; root `plugin.json` and
  `extensions` are ignored. Claude `marketplace.json` supports relative `./path`
  sources, `metadata.pluginRoot`, `git-subdir` sources, and `command` sources
  (v2.1.229+) that run a program to produce the plugin path. `claude plugin
  validate .` checks marketplace + plugin.json only.
- Vercel `npx plugins` CLI installs `.plugin/`-format plugins into Claude Code,
  Cursor, Codex, Copilot CLI, VS Code, Kimi, Grok; no converter from Claude
  layout.
- Conformance checklist (client): load from directory, enforce package
  boundary; select schema rules from `$schema` offline; validate closed
  manifest; report+ignore unknown top-level fields; ignore non-object
  `extensions` and unknown namespaces; discover only from fixed locations;
  missing location = valid absence; isolate invalid components; support at
  least one of skills/MCP; if MCP: stdio or streamable-http, `PLUGIN_ROOT` +
  persistent `PLUGIN_DATA`, expand only the two placeholders, cwd containment;
  require matching versions in `plugin.json` and `mcp.json`.

## Requirements

### Must have
- **[A] Fixture gate**: a hand-written spec-layout fixture with a committed
  shim installs from a local marketplace into stock Claude Code and its hook
  fires, and `npx plugins discover ./<fixture-repo>` (local paths are
  accepted) lists the fixture exactly once; this precedes any portage code.
- **[B] Monorepo `buvis/agent-plugins`** with `plugins/<name>/` per plugin,
  each a conformant Agent Plugins 1.0 package: root `plugin.json` (closed
  schema, `$schema` 1.0.0, no Claude-specific fields), `skills/`, optional
  `mcp.json`, Claude-only components under `com.anthropic.claude-code/`
  (`hooks/` with its scripts and helpers, `commands/`, `agents/`); everything
  else (`rules/`, `dist/`, `lib/`, `src/`, tests, `scripts/`, templates)
  stays at plugin root as extra files the spec ignores; per-plugin
  `CHANGELOG.md` and `README.md`.
- **[A] Portage** (`plugins/portage/`): the provisional Claude client, itself
  a spec plugin. Stdlib-only Python 3.10+, runnable as
  `python3 plugins/portage/scripts/portage.py <cmd>` and exposed as a
  `portage` skill that runs `validate` or `check` on a named plugin dir from
  a Claude session and explains each violation. Commands:
  - `validate <plugin-dir>`: offline validation against the vendored 1.0.0
    schemas; every non-MCP item of the client conformance checklist (closed
    manifest, `$schema` selection, report+ignore unknown top-level fields,
    ignore non-object `extensions` and unknown namespaces, fixed-location
    discovery, missing location = valid absence, per-skill isolation, path
    containment incl. symlinks, Agent Skills name/description/dir-match
    rules); a present `mcp.json` is reported as unsupported.
  - `emit <plugin-dir>`: writes the Claude shim `.claude-plugin/plugin.json`
    (name, version, description, author copied from the manifest; `hooks`,
    `commands`, `agents` pointing into `./com.anthropic.claude-code/...` only
    when those dirs exist).
  - `check <plugin-dir>`: exit non-zero when the committed shim differs from
    what `emit` would write (CI gate).
- **[A] Conformance test suite** (pytest) with fixture plugins covering each
  checklist item, valid and invalid cases, and shim golden files (shape is
  the contract, so golden tests are appropriate here).
- **[B] Migration of all 7 plugins** preserving current versions, changelogs
  and behaviour; `${CLAUDE_PLUGIN_ROOT}` references rewritten only where
  their target moved into the namespace dir; warden keeps its committed
  `dist/`; git-ferry keeps its bats tests.
- **[B] Monorepo marketplace** `.claude-plugin/marketplace.json` with relative
  `./plugins/<name>` sources for all 8 plugins; `claude plugin validate .`
  passes.
- **[B] Release tooling**: `dev/bin/release <name> [patch|minor|major]` bumps
  `plugins/<name>/plugin.json` + shim, stamps the plugin CHANGELOG, tags
  `<name>/vX.Y.Z`, pushes, updates the monorepo marketplace entry and the
  compat entry in `buvis/claude-plugins`, repointing that entry to the
  monorepo `git-subdir` source on the plugin's first monorepo release (a
  plugin's first monorepo release is its cutover); refuses to touch other
  plugins.
- **[B] CI**: portage validate + check on every plugin, portage tests, existing
  per-plugin tests (aegis/loupe/checkup pytest, git-ferry bats, warden
  vitest), `claude plugin validate .`.
- **[C] Cutover**, after every plugin has had one monorepo release: the 7
  `claude-<name>` repos archived with a README pointer; install docs
  updated; `buvis/claude-plugins` keeps only `marketplace.json`, README and
  a CI job running `claude plugin validate .`, with `scripts/release-plugin`
  and `scripts/validate-versions.mjs` removed (release and the drift check
  move to the monorepo release script).
- **[C] Portability proof**: `npx plugins discover buvis/agent-plugins` lists
  the plugins; `npx plugins add` installs skills into every non-Claude client
  present on the machine (Codex at minimum; Cursor, Copilot CLI, VS Code
  when installed).

### Nice to have
- `portage migrate <claude-plugin-dir>`: one-shot converter from the legacy
  Claude layout into the spec layout (used once for the 7 migrations, kept
  for future plugins).
- Codex marketplace file (`.agents/plugins/marketplace.json`) in the monorepo
  so `buvis/codex-plugins` can be retired.
- Fix legacy frontmatter during migration: `user_invocable` (underscore) in
  10 command files, `argument-hint` in `git-ferry/catchup-upstream/SKILL.md`.
- MCP: `.mcp.json` emission (`${PLUGIN_ROOT}` rewritten to
  `${CLAUDE_PLUGIN_ROOT}`) and the MCP items of the conformance checklist
  (`plugin.json`/`mcp.json` version match, per-server isolation, placeholder
  rules, cwd containment) once a plugin ships a server.

### Out of scope
- Claiming hooks, agents, commands, or rules are portable; no emitters for
  other clients' hook systems (Codex hooks for warden stay a documented manual
  setup as today).
- MCP servers and `mcp.json` handling (none exist; see Nice to have).
- Spec 1.1.0 (working draft) support.
- Changing plugin behaviour or content beyond what the layout move requires.
- Making skill bodies client-neutral: skills that use `${CLAUDE_SKILL_DIR}`,
  `${CLAUDE_PLUGIN_ROOT}`, plugin-level `lib/` or Claude agents (checkup x5,
  aegis gateguard, agoge run-agoge) stay Claude-only and each plugin README
  lists them.
- Generated compat mirrors in the old repos.
- Windows support beyond what stock Claude Code provides.

## Constraints
- Portage is stdlib-only Python 3.10+ (no jsonschema dependency; hand-written
  validation of the two closed schemas is acceptable and testable).
- Migration is additive and reversible per plugin: a plugin's old repo stays
  installable until its monorepo copy is verified.
- `${CLAUDE_PLUGIN_ROOT}` keeps working: Claude sets it to the plugin root,
  which is the spec plugin root, so paths inside the namespace dir are
  `${CLAUDE_PLUGIN_ROOT}/com.anthropic.claude-code/...`.
- House rules apply: `master` default branch, MIT, Keep a Changelog per
  plugin, conventional commits, tests ship with behaviour.
- `com.anthropic.claude-code` is not owned by us; if Anthropic publishes the
  namespace with different semantics, portage and the tree follow theirs.

## Codebase Context
- **Current repos** (`~/git/src/github.com/buvis/claude-<name>`):
  - checkup: 7 skills, Python `lib/` helpers, no hooks.
  - strunk: 11 skills only.
  - git-ferry: 6 skills, bats tests (bats-core submodule), `argument-hint` key
    in `catchup-upstream/SKILL.md`.
  - warden: TypeScript hook binary `dist/index.cjs` (tsup, dep `unbash`),
    PreToolUse + SessionStart, 4 commands, `.codex/hooks.json` template,
    `codex:export-rules` script; also works natively as a Codex hook.
  - aegis: 8 Python PreToolUse hooks + `_common.py`, 1 skill (gateguard),
    `rules/*.md`.
  - loupe: Python hooks (SessionStart, PreToolUse, PostToolUse, Stop) as a
    `hooks/loupe/` package, 6 commands, 57 ast-grep rules; release script is
    the drifted 148-line inline copy.
  - agoge: 7 agents (`tools:`, `model: inherit`, `color:`), 1 skill.
  - autopilot: 9 skills with `scripts/`, `cli/`, `references/` and fixtures,
    14 agents, PreToolUse/PostToolUse/Stop hooks whose entry points sit in
    `hooks/` and in `skills/run-autopilot/scripts/`; pytest and `test_*.sh`
    suites inside the skills. Published 2026-08-25 as `buvis/claude-autopilot`.
  - No MCP servers anywhere. `${CLAUDE_PLUGIN_ROOT}` appears in hooks.json and
    in command/skill markdown (warden 15, aegis 11, loupe 12); autopilot has
    138 across 34 files (hooks.json, skills, references, tests); only the
    `hooks/` and `agents/` targets move into the namespace, the rest stay
    root-relative under `skills/`.
  - Command frontmatter uses `user_invocable:` (underscore) in 10 files.
- **Central marketplace**: `buvis/claude-plugins/.claude-plugin/marketplace.json`
  (8 `url` sources), `scripts/release-plugin` (bumps plugin.json, self
  marketplace, package.json, CHANGELOG; tags; bumps central entry),
  `scripts/validate-versions.mjs` (drift check against upstream plugin.json).
- **Codex**: `buvis/codex-plugins` scaffold (`plugins/<name>/.codex-plugin/
  plugin.json`, `.agents/plugins/marketplace.json`), currently one unavailable
  placeholder plugin (`ovcaq-autopilot`).
- **Conventions**: `dev/bin/release` shim per repo, Keep a Changelog, MIT,
  `master` default branch, evocative single-word names.

## Approach
- **Chosen**: spec-first monorepo where each plugin is a conformant Agent
  Plugins 1.0 package; Claude-only components live under
  `com.anthropic.claude-code/`; portage (a spec plugin in the same repo)
  validates every package offline and emits a small committed
  `.claude-plugin/` shim that makes stock Claude Code load the spec tree via
  `git-subdir` marketplace sources. Three sequenced PRDs: A portage, B
  monorepo + migration + release model, C cutover + portability proof.
- **Why**: keeps auto-update, bulk install, older Claude Code, the existing
  `buvis-plugins` marketplace URL, and Windows working; no runtime bootstrap;
  the shim is the only generated artifact and is a few lines per plugin;
  `skills/` is read by both layouts unchanged; the day Anthropic reads root
  `plugin.json`, the shims are deleted and nothing else moves.
- **Rejected alternatives**:
  - Install-time `command` marketplace source running portage (Q4/Q9):
    refused by Claude Code on background auto-update and bulk install;
    compat marketplace clone lacks the monorepo; Windows unsupported.
  - Committed full `dist/claude/<name>/` trees: duplicates every file;
    rebuild commit per change; nothing the shim does not already give.
  - PyPI package via `uvx`: extra release channel, uv required on targets,
    version drift between client and plugins.
  - Wrapping the Vercel `plugins` CLI: reads its own `.plugin/` format, drops
    namespace dirs, no control.
  - `net.buvis.claude` namespace: spec-cleaner, but user chose alignment with
    the spec org's suggested Claude namespace.

## Success Criteria
- [A] `python3 plugins/portage/scripts/portage.py validate plugins/<name>`
  exits 0 for all 8 plugins and exits non-zero with a named violation for
  every invalid fixture in the conformance suite; suite green in CI.
- [B] `claude plugin validate .` passes in the monorepo.
- [B] On a clean Claude profile, `/plugin marketplace add buvis/agent-plugins`
  then installing all 8 plugins, the 7 migrated ones show the same
  observable behaviour as today: aegis and warden hooks block the same
  commands, loupe fires on Write/Edit and at Stop, all 10 commands are
  listed, 7 agoge agents resolve, all 26 migrated skills (27 with portage)
  load.
- [B] Existing `buvis-plugins` marketplace users receive the next release of
  each plugin through auto-update without re-adding anything.
- [C] `npx plugins discover buvis/agent-plugins` lists the plugins; `npx
  plugins add buvis/agent-plugins` installs their skills into Codex (and any
  other supported client present) and one skill with no Claude-only
  references (a strunk skill) triggers and completes there.
- [B] Per-plugin release: `dev/bin/release strunk patch` produces one commit,
  tag `strunk/vX.Y.Z`, and touches only strunk's entries in both
  marketplaces.

## Risks
- **Claude Code chokes on unknown root files** (`plugin.json`,
  `com.anthropic.claude-code/`): unverified assumption; PRD A installs a
  fixture plugin locally before anything else is built.
- **`hooks`/`commands`/`agents` path fields in the shim behave differently
  from default locations** (documented as "replaces default"): verified by
  the same fixture install, including a hook that actually fires.
- **`npx plugins` misreads the tree**: its discovery falls back to a 2-level
  content scan where any dir holding skills/commands/agents/rules/hooks
  counts as a plugin, and it translates its own `.plugin/` format; unknown
  whether it reads our marketplace or root `plugin.json`, whether
  `com.anthropic.claude-code/` is double-detected, and whether skill-less
  plugins (warden, loupe) appear. The PRD A fixture gate runs `npx plugins
  discover ./<fixture-repo>` (local paths are accepted) and must list the
  fixture exactly once.
- **Anthropic publishes `com.anthropic.claude-code` with other semantics**:
  portage's emitter is the single place to adapt; tree changes are mechanical.
- **Monorepo release script clobbers sibling entries** (the 2026 warden
  incident): the script diff-checks that only the named plugin's entries
  changed, as `release-plugin` does today.
- **git-ferry bats-core submodule in a monorepo**: submodule init on clone
  is easy to forget; CI clones with `--recursive` and the release check
  refuses an empty submodule.
- **Warden `dist/` staleness**: `release-build` hook rebuilds before commit;
  CI compares a fresh build to the committed `dist/`.
- **Source-type switch (`url` to `git-subdir`) may not update in place**:
  unverified; before the first per-plugin cutover, a profile that installed
  from the old entry is repointed, bumped, and watched through auto-update;
  fallback is a documented one-time reinstall.

## Open Questions
- Marketplace name for the monorepo (`buvis-agent-plugins`?) and whether the
  same repo also carries the Codex marketplace file, retiring
  `buvis/codex-plugins` (whose only plugin is an unavailable placeholder).
- Priority: inferred "next autopilot batch", PRDs ordered A, B, C in
  `dev/local/prds/backlog/` of the new repo once it exists (A can start in
  the monorepo skeleton since portage lives there).
- Fate of the `extract-plugin` skill: it targets the old per-repo layout and
  must be re-pointed at `plugins/<name>/` in the monorepo (follow-up PRD or
  part of C).

## Discovery Log

### Q1: What is the primary goal driving the spec-first rewrite?
**Answer**: Portability to other clients. Skills (and future MCP servers)
should install into Cursor, Codex, Copilot, VS Code from one tree; hooks and
agents remain Claude-only extensions.

### Q2: Which clients must the monorepo serve at launch?
**Answer**: Claude (via our provisional client) plus everything the Vercel
`npx plugins` CLI reaches (Cursor, Codex, Copilot CLI, VS Code, Kimi, Grok).
Install proof is expected for those, not just spec-clean files.

### Q3: Which reverse-domain namespace holds the Claude-only parts?
**Answer**: `com.anthropic.claude-code` (the name the spec org's migration
skill suggests). Accepted risk: we do not control that domain; if Anthropic
publishes different semantics under it, our layout must follow theirs.

### Q4: Where does the Claude-native output live and how do installers reach it?
**Answer**: Install-time `command` marketplace source (Claude Code v2.1.229+):
the marketplace entry runs our provisional client on the installer's machine,
which emits the Claude-native plugin; nothing generated is committed.
Consequences: the client must be installable as a runnable on every target
machine; `claude plugin validate` cannot check command sources; older Claude
Code versions cannot install.
Command-source contract (docs, verified 2026-08-25): `command` (<=500 ASCII
chars) runs under `sh` with cwd = `$HOME`, env stripped of names containing
TOKEN/SECRET/KEY/AUTH, with `CLAUDE_CODE_PLUGIN_NAME` and
`CLAUDE_CODE_PLUGIN_ARCHIVE_URL` set; must print exactly one absolute
directory path on stdout and exit 0; `timeout` default 60 s (max 600);
`mode` `copy` (default, hashed into the versioned cache, max 256 MiB /
20 000 entries) or `link` (used in place). Runs on install, on update, once
per session in the background, and when the cache entry is missing; skipped
under `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. Interactive install shows
the command string and records acceptance; bulk installs and auto-update
refuse command sources; not supported on Windows; admins can block via
`disableCommandPluginSources`.

### Q5: Fate of the 7 claude-<name> repos and buvis/claude-plugins?
**Answer**: Archive the 7 plugin repos after migration; keep
`buvis/claude-plugins` alive as the compat marketplace with its entries
repointed to the monorepo's command sources. Direct installs from
`claude-<name>` repo URLs stop receiving updates (accepted).

### Q6: How is the provisional client implemented and invoked?
**Answer**: Python package published to PyPI, invoked from the marketplace
command as `uvx agent-plugins-claude emit <name>` (working name). It
validates against the vendored 1.0.0 schemas, discovers components, applies
the `com.anthropic.claude-code` extension, and emits a Claude-native plugin
directory whose absolute path it prints. Requires uv on target machines;
about one second cold start per session is accepted.

### Q7: One PRD or split?
**Answer**: Three sequenced PRDs: (A) the Python client, (B) the monorepo
with all 7 plugins migrated plus its release model, (C) cutover (repoint
`buvis/claude-plugins` to command sources, archive old repos, prove installs
through `npx plugins`). B pins a published client version from A.

### Q8: Where does the Python client live?
**Answer**: Shipped as a plugin of the monorepo (dogfooding: the client is
itself an Agent Plugin carrying the loader/validator/emitter as scripts plus
a skill). Bootstrap consequence: the marketplace command that installs the
other plugins must reach the client before any plugin is installed; see Q9.

### Q9: Q6 (uvx from PyPI) vs Q8 (client is a plugin): which invocation wins?
**Answer**: Run the client from the marketplace clone. Claude Code clones
every added marketplace to `~/.claude/plugins/marketplaces/<name>/`
(verified in `known_marketplaces.json` on 2026-08-25), so the marketplace
command is `python3 .claude/plugins/marketplaces/<mp>/plugins/<client>/
scripts/emit.py <name>` with cwd `$HOME`. Supersedes Q6: no PyPI, no uvx,
stdlib-only Python. Accepted dependencies: clone path convention, the
marketplace name the user picks when adding it, `python3` on PATH under `sh`.

### Q10: Name for the client plugin?
**Answer**: `portage` (carrying a boat overland between waterways: moving a
plugin between clients). Path: `plugins/portage/`, entry
`plugins/portage/scripts/emit.py` (renamed `portage.py` with
`validate`/`emit`/`check` subcommands in Q12).

### Q11: Versioning and release model inside the monorepo?
**Answer**: Per-plugin semver in each `plugins/<name>/plugin.json`, per-plugin
`CHANGELOG.md`, tags `<name>/vX.Y.Z`, one `dev/bin/release <name> [bump]`
that bumps, stamps, tags, pushes, and repoints both marketplaces.

### Q12 (contradiction check): command sources vs auto-update and the compat clone
**Facts raised**: Claude Code refuses command-sourced plugins on background
auto-update and bulk installs (buvis-plugins has `autoUpdate: true`); the
compat marketplace clone (claude-plugins repo) does not contain the monorepo;
Claude's `.claude-plugin/plugin.json` accepts custom `commands`, `agents`,
`hooks` paths, and `skills/` is shared by both layouts.
**Answer**: Portage emits a small committed `.claude-plugin/` shim per plugin
that points into `com.anthropic.claude-code/`; both marketplaces use
`git-subdir` sources into the monorepo. Supersedes Q4 and Q9: no command
sources, no runtime bootstrap, no clone-path dependency. CI fails when a
shim is stale. Portage remains the conformance client (validate, discover,
emit); its emit target is the shim, not a copied tree.
