# buvis plugins — portfolio evolution assessment

Date: 2026-07-08 · Scope: warden, claude-checkup, strunk, git-ferry, aegis · Method: one read-only auditor per plugin (parallel), load-bearing claims re-verified against source.

**Verification legend**

- `✅V` — verified against source by the orchestrator this session.
- `🔬A` — auditor verified by *executing* (ran the test suite / live interpreter / hook subprocess / shellcheck).
- `📖` — auditor read-confirmed with `file:line`, not independently re-run.
- `⚠️` — UNVERIFIED, stated as such.

**Headline**: the portfolio is healthy. Five clean trees, passing CI where it exists, active release cadence. Findings are localized, not structural rot — exactly what a healthy codebase yields under adversarial audit. The one *live production* defect (marketplace version corruption) is already fixed this session. The rest is a prioritized backlog.

---

## P0 — Cross-cutting: the marketplace/release pipeline

### 1. Marketplace version clobber — `✅V` — FIXED this session (commit 2dd7cf3)

`marketplace.json` advertised **all five** plugins at `0.13.0`; actual versions are warden 0.13.0, checkup 0.2.1, strunk 0.1.3, git-ferry 0.2.1, aegis 0.2.1. Root cause: warden's `dev/bin/release:108` rewrites versions with a line-mode `perl` substitution:

```
perl -i -pe "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$MARKETPLACE"
```

`perl -pe` applies the substitution to every line; each plugin's `"version":` is on its own line, so **every** plugin gets stamped with warden's version. The other four plugins use targeted `jq` (`map(if .name == $name ...)`) and are safe — confirmed in checkup/strunk/git-ferry/aegis release scripts.

**This is the third recurrence.** `git log` on `marketplace.json` shows two prior `fix: restore clobbered ... versions` commits (9316340, aa9ed3d); each warden release since re-clobbered. Commit bcbc5e4 ("bump warden to v0.13.0") is the smoking gun — its diff rewrites all five version lines.

**Second failure mode (`✅V`)**: checkup and aegis both shipped `0.2.1`, but `marketplace.json` history has **no** "bump ... to v0.2.1" commit for either — those patch releases never propagated to the marketplace at all. Propagation is unreliable in both directions.

**Fix direction**: (a) swap warden's `perl` for the same targeted `jq` the other four use [P0]; (b) add a consistency guard so drift can't ship silently (see guardrails).

---

## warden (v0.13.0) — TypeScript command-safety hook

Biggest, most mature plugin (560 commits, 466 evaluator tests + fuzz harness). Default posture is genuinely **fail-safe**: parse error, incomplete AST, uncaught throw, oversized stdin all resolve to `ask`, never `allow`. Findings are localized to the parser's blind spots and the security boundary.

> **Reconciliation note**: the architecture pass concluded "no fail-open path exists"; the security-specialized pass found the wrapper-command bypass below, which I **independently verified**. The verified finding stands — warden does have silent-allow bypasses beyond the arithmetic leak. Threat-model caveat: warden is designed to stop *accidental self-harm in a trusted repo*, not to *sandbox a hostile repo*. Findings that defeat warden in its **own** threat model (W1, W2) are true bugs; the hostile-repo hardening items (W5) are a separate design decision.

| # | Sev | Defect | Evidence | Status |
|---|-----|--------|----------|--------|
| W1 | **HIGH** | Transparent runners in `alwaysAllow` bypass the `alwaysDeny` hard-blocks. `timeout 5 sudo rm -rf /`, `env dd …`, `command sudo …`, `nohup/nice/watch <denied>` → the wrapper matches `alwaysAllow`, short-circuits in `PRE_LAYERS`, inner command never seen. Defeats warden's advertised "sudo/dd are always denied". | `✅V` `defaults.ts:137,146,185,188` (command/env/time/timeout/nohup/nice/watch in alwaysAllow) + `evaluator.ts:140-150,199,214` (scopedAlwaysPolicy short-circuits before any unwrap) | NEW |
| W2 | **HIGH** (low likelihood) | Arithmetic-embedded command sub `echo $(( $(rm -rf ~) ))` drops the nested command → enclosing safe cmd resolves to **allow**. The only silent-allow the arch pass found. | `📖` `parser.ts:169-181` (`scanWordPart` ArithmeticExpansion → bare `break`, no `incomplete`); self-documented | NEW |
| W3 | MED | Bundled/reordered shell `-c` flags (`bash -lc`, `sh -ec`, `bash --norc -c`) miss inner-command extraction (recursion gated on exact `args[0]==='-c'`). Fail-safe (→ ask) but a real blind spot. | `📖` `parser.ts:345-349,384-410`; no test for `-lc`/`-ec` | NEW |
| W4 | MED | Committed `dist/*.cjs` with no CI freshness guard; `ci.yml` never builds. 24 manual "rebuild dist" commits; two recent dist commits were partial (one bundle each). Marketplace installs run `dist/`, not `src/`. | `📖` `ci.yml` (typecheck+test only), `auto-release.yml:25` | NEW |
| W5 | MED | Project `.claude/warden.yaml` is fully trusted and **highest-priority**: a repo can set `defaultDecision: allow`, add `alwaysAllow:[sudo,dd]` (overrides default `alwaysDeny`), wildcard `trustedRemotes`, `sessionGuidance` (prompt-injection at SessionStart), or redirect `auditPath` to a shell rc file. Nothing warns the user the repo widened policy. | `📖` `rules.ts:83-116`, `evaluator.ts:141`, `index.ts:20-35`, `audit.ts:17-46` | NEW (design decision — is project config trusted?) |
| W6 | MED | Copilot adapter (`copilot.ts`) calls only `wardenEval` → skips every post-eval transform (unattended ask→deny, yolo, notify, audit); crash path exits 0 with **no** decision (silent-allow vs the Claude hook's fail-to-ask). | `📖` `core.ts:7-16`, `copilot.ts` | NEW |
| W7 | MED | 5 near-identical trusted-remote arg-walkers (~340 lines); each new flag is a fresh leak site (drove Fly `-C`, dash/ksh fixes). | `📖` `remote-exec.ts:95,219,278,349,439` | NEW (refactor) |
| W8 | LOW | Fail-open via the 5s hook timeout: no internal watchdog, unbounded parser recursion on nested `sh -c`, no stdin read timeout. On SIGKILL the `main().catch` can't emit `ask` → command proceeds. | `📖` `hooks.json` timeout:5, `stdin.ts:8-14`, `parser.ts:350` | NEW |

**Gets right**: syntactic/semantic layer split genuinely holds (parser imports no config/rules concepts); the default-deny safety invariant is structural (one gate, `evaluator.ts:212`), not scattered; `safe`-verdict requires positive evidence; clean test seam (engine takes config as a pure param); heredoc/evasion guards show real adversarial care.

**Checked & safe**: standalone `(( $(cmd) ))` → incomplete→ask (tested); `$VAR`→binary auto-allow defers when a rule exists; trusted remotes recurse (no blanket allow without `allowAll`); ReDoS low; WARDEN_UNATTENDED converts ask→deny for the main path.

**Backlog**: `00020` (harden-diagnose, wip) — KEEP, implementation-complete (6 features have fix+test commits, 35-case test file); finish review loop, move to done. `00021` (tighten-suggest-scope) — KEEP, compliant, ready.

**Proposed PRDs** (safety first): `00022` surface arithmetic-embedded command subs (W2, SAFETY); **new: fix transparent-runner bypass (W1)** — remove command/env/timeout/nohup/nice/watch from `alwaysAllow`, give them unwrap-and-recurse evaluators like xargs; this restores the `alwaysDeny` guarantee and is the single highest-value warden fix; `00023` recognize bundled `-c` flags (W3); `00024` dist-freshness CI guard (W4); `00025` extract shared remote arg-walker (W7, needs mini design). W5 warrants a **decision PRD** (trust model for project config) before any code.

**Top-3 wins**: (1) fix W1 wrapper bypass + W2 arithmetic — closes the silent-allows that defeat warden's purpose; (2) dist-freshness CI — guarantees the installed hook equals source; (3) `00021` suggest-scope — stops users over-broadening their allowlist.

---

## claude-checkup (v0.2.1) — Python audit skills

107 tests pass (0 skips, run this session by auditor). `lib/` extraction already happened and is well-documented. The theme: the audit tools **under-report** — they fail open (skip unparseable input silently) and look for data where it no longer lives.

| # | Sev | Defect | Evidence | Status |
|---|-----|--------|----------|--------|
| C1 | **HIGH** | Permission classifier fails open: any unrecognized grant → `LOW` (`:103`), and `check_permissions` **drops every LOW** from the report (`:121-122`). Bare `Bash`/`Write`/`Edit` (≈ `Bash(*)`, which `:84` grades CRITICAL) and `Bash(rm:*)` (DESTRUCTIVE_BASH is only docker/kubectl/git) go unreported. | `✅V` `checks_permissions.py:19,20,103,121-122` | NEW |
| C2 | **HIGH** | audit-sessions skill inventory misses **all** plugin skills: globs `plugins/installed/*/skills/…` but the real layout is `plugins/cache/<mkt>/<plugin>/<ver>/skills/`. On the reference machine the glob returns 0; 45 of 77 skills invisible. | `🔬A` `parser.py:313-314` vs `lib/plugins.py:3-6` (probed live ~/.claude) | NEW |
| C3 | **HIGH** | Fail-open fleet-wide: malformed `settings.json` → clean report, zero findings, no "unparseable" marker; same for unreadable hook script / CLAUDE.md / session / component. Violates the repo's own fail-loud convention. | `📖` `audit_config.py:27-33,62-64`; `checks_hooks.py:64-68`; `checks_security.py:57-61`; `parser.py:295-296`; `audit_context.py:43-45` | NEW |
| C4 | MED | `KNOWN_KEYS` allowlist already rotted: 4 live settings keys (`agentPushNotifEnabled`, `autoMode`, `skillListingBudgetFraction`, `skipAutoPermissionPrompt`) fire false "typo?" findings today. | `🔬A` `checks_settings.py:15-20` | NEW |
| C5 | MED | MCP checks read `settings.json mcpServers` only; real servers live in `~/.claude.json`, `.mcp.json`, plugin manifests → npx/secret/0.0.0.0 checks are near-dead. Settings `env` block never secret-scanned. | `📖` `checks_security.py:33-35,56`; ⚠️ "settings.json can't hold mcpServers at all" UNVERIFIED | NEW |
| C6 | MED | c06ac89's bug class persists: correction tokens ("stop"/"wrong"/"instead"/"actually") matched as substrings anywhere, over a 3-message window spanning hours → false `skill_negative`. | `📖` `analyze.py:82-94,413-414` | partly tracked |
| C7 | MED | Successful tool calls flagged rejected: tool_result content containing "permission denied"/"rejected" fires even when `is_error` is false (e.g. `find` over protected dirs). | `📖` `parser.py:243-249` | NEW |
| C8 | MED | `validate_skill.py` imports **PyYAML** — the only third-party dep, undeclared, via bare `python3`; ImportError-crashes the authoring audit where the rest of the repo is stdlib-only. Also 159-line function, **zero tests** (only untested script). | `🔬A` `validate_skill.py:16,53-211` | NEW |
| C9 | MED | audit-sessions is an island off `lib/`: reimplements iso-parse, jsonl-iter, and a 3rd frontmatter parser; ignores `CLAUDE_CONFIG_DIR` that `lib/claude_paths` exists to honor. Root cause of C2. | `📖` `analyze.py:596`, `parser.py:147,285,306` | NEW |
| C10 | LOW | No CI (`.github` untracked); suite runs in 0.06s. Post-release commits run untested until next release. Shallow `_merge` (`dict.update`) drops global permissions when local defines any. | `📖` repo root; `audit_config.py:36-39` | NEW |

**Gets right**: telemetry-gated unused-grant detection refuses the dangerous false positive; zero bare `except`; frozen dataclasses; one shared Finding schema; fix commits consistently paired with regression tests; `checks_hooks` iterates every event key (opposite of the KNOWN_KEYS mistake, done right).

**Backlog**: `00001` add-safe-delete-remediation — KEEP, run first (premise verified: SKILL offers copy-paste `rm -rf` with no undo). `00002` mcp-connector-rubric — KEEP (LOW), two edits: fix stale PRD ref "00031" → this repo's numbering, and correct the wrong MCP source (C5).

**Proposed PRDs**: `00003` make-audits-fail-loud (C3); `00004` fix-classifier-fail-open (C1+C4); `00005` audit-MCP-where-servers-live (C5); `00006` route-audit-sessions-through-lib (C2+C9); `00007` add-CI (C10); `00008` test-and-slim validate_skill (C8 + rules/ coverage).

**Top-3 wins**: (1) reversible cleanup + undo journal (`00001`, already specced); (2) make "clean" mean clean (C3+C1) — a security audit that silently skips input and under-grades bare `Bash` manufactures false confidence; (3) audit the setup that actually exists (C2+C5) — today 45/77 skills, every MCP server, and the largest always-loaded block are invisible.

---

## strunk (v0.1.3) — docs-only code-craft skills

Content/reference plugin; risk is **wrong or stale guidance**, not runtime bugs. The v0.1.3 collapse (8 skills, 17-68 lines each, rulings-only) was the best decision in its history. Findings verified **live** against CPython 3.10.20-3.14.4.

| # | Sev | Defect | Evidence | Status |
|---|-----|--------|----------|--------|
| S1 | **HIGH** | `isinstance(x, list[int])` flip attributed to 3.12; the flip is actually **3.11** (3.10→True, 3.11→False). Skill tells Claude a 3.11 break won't bite until 3.12. | `🔬A` live 3.10.20/3.11.15; `compat-table.md:85-87`, `SKILL.md:39` | tracked (00004) + SKILL.md out of its scope |
| S2 | **HIGH** | PEP 758 row missing: unparenthesized `except A, B:` compiles on 3.14, SyntaxError on 3.13. Exact trap class the skill exists for. | `🔬A` live 3.13.13/3.14.4 | tracked (00004 must) |
| S3 | **HIGH** | No "Added in 3.13" section at all — table jumps 3.12→3.14. `typing.TypeIs`/`ReadOnly`, PEP 696 defaults, `copy.replace()` pass the check while breaking on ≤3.12. | `🔬A` live 3.12/3.13; `compat-table.md:100,141` | NOT tracked — amend 00004 |
| S4 | MED | Int-str digit-limit row claims 3.10 "works"; **3.10.20 raises** (backported since 3.10.7, 2022). Actively inverted. | `🔬A` live 3.10.20; `:43` | tracked generically |
| S5 | MED | `LiteralString` 3.10 alt says "not available"; `typing_extensions.LiteralString` imports fine on 3.10. | `🔬A` live; `:34` | tracked generically |
| S6 | MED | pytest async-no-marker described as "silently not collected" — pytest ≥8.4 (2025-06) **fails** it instead. | `🔬A` fetched 8.4.0 changelog; `python-testing/SKILL.md:34` | NEW |
| S7 | MED | Blanket coverage mandates ("target 80%", "80/90/100") **contradict your own `rules/testing.md`** ("no blanket coverage target"). Both load together on any pytest/cargo task. | `📖` `python-testing:8`, `rust-testing:8` | NEW |
| S8 | LOW | `.serena/` untracked, not in `.gitignore`. | `✅V` `git status` → `?? .serena/` | NEW (one-line, not PRD-worthy) |
| S9 | LOW | check-python-compat quick-fix tomllib/tomli fallback is invalid syntax + bare except, contradicts the table's own correct pattern. | `📖` `SKILL.md:36` | fold into 00004 |

**Gets right**: right-sizing is a clean pass (progressive disclosure on the 179-line table); frontmatter 8/8 compliant; overlap between apply-design-system↔frontend-patterns explicitly disclaimed; PRD 00004 unusually honest about lost provenance. Large "checked & safe" list of spot-verified-accurate rows (all 3.11 additions, PEP 594 dead batteries, most of 3.14).

**Backlog**: `00003` release-skill-lint — KEEP (compliant, all 8 skills pass today). `00004` fix-compat-table-accuracy — **KEEP, amend, run first. Explicitly NOT done** (only 1 of 9 prior findings fixed; this audit falsified 2 more rows). Amendments: add `SKILL.md:39` quick-ref to scope, add explicit "Added in 3.13" must, paste this audit's findings in as the reconstructed findings list. `00005` add-CI-lint — **MERGE into 00003** (sequential, same domain, one 25-line workflow). `00006` publish-github-releases — KEEP.

**Proposed PRDs**: `00007` add-compat-verify-script (`dev/bin/verify-compat` running ~25 import/compile/behavior probes across 3.10-3.14 via uv, wired into release preflight — converts the churn-leader file from prose recall to tested claims); `00008` raise-compat-floor-to-3.11 (date-blocked: 3.10 EOL Oct 2026, same month 3.15 lands).

**Top-3 wins**: (1) run amended `00004` and release v0.1.4 — the artifact Claude treats as ground truth currently teaches 2 provably false claims and omits a whole version; (2) `00007` verify-compat script — kills the accuracy-treadmill before the Oct 2026 double event; (3) refresh testing-skill facts + reconcile the coverage mandate with your global rule.

---

## git-ferry (v0.2.1) — bash git-workflow skills

Best-tested of the script plugins (33 bats tests, 2-OS CI + shellcheck gate; shellcheck clean at `-S warning`). No critical/exploitable findings — the HIGHs make the flagship skill *wrong on common repos*, not dangerous. Notably, its release script bumps the sibling marketplace with targeted `jq` — **safe**, confirming warden is the sole clobber culprit.

| # | Sev | Defect | Evidence | Status |
|---|-----|--------|----------|--------|
| G1 | **HIGH** | ~18 `\|\| true` / `\|\| echo "(none)"` guards conflate "gh failed" with "empty" → catchup asserts "no issues / CI green" when the query died. | `🔬A` `github-state.sh:33,39,41,46,51,85,103,127,151` | tracked (00003) |
| G2 | **HIGH** | `master` hardcoded across the catchup path (23 mentions): `branch-diff.sh` hard-errors, `github-state.sh` silently queries the wrong branch. Breaks on every `main`-default repo. | `🔬A` `branch-diff.sh:16,22-27`, `github-state.sh:90,102,124` | tracked (00002) |
| G3 | **HIGH** | `gh issue list --label "critical,urgent,P0,P1"` — gh comma-splits and **ANDs** labels → "High Priority" section is permanently empty → false all-clear on urgent bugs. | `🔬A` gh 2.92.0; `github-state.sh:40` | tracked (00003; mechanism wording slightly off) |
| G4 | MED | `\|\| echo` guard defeated by pipe (`gh … \| tail -100 \|\| echo`): no pipefail, `tail` exits 0, guard never fires. | `📖` `github-state.sh:115,138` | fold into 00003 |
| G5 | MED | Release preflight runs only `test_*.py`; the real gate (33 bats + shellcheck) never runs pre-release. No branch/freshness guard — pushes `origin master` regardless of checked-out branch. | `📖` `dev/bin/release:86-92,125-134` | 00004 (+ new branch-guard task) |
| G6 | MED | `git merge-base` failure → `set -e` kills the script mid-run with **no error text** (shallow clones / unrelated histories). | `📖` `branch-diff.sh:36` | fold into 00002 |
| G7 | MED | `review-deps-prs` fires up to 200 serial `gh pr list \|\| continue` → rate-limited repos silently vanish from triage. | `📖` `list-dep-prs.sh:18-24` | proposed 00008 |
| G8 | LOW | All six skill scripts use bare `set -e` (no `-u`/`pipefail`); release does it right. Latent class behind G4. | `📖` `skills/*/scripts/*.sh` | adopt as touched |

**Gets right**: `dev/bin/release` is exemplary bash (`set -euo pipefail`, ERR trap with step names); `list-task-sessions.sh` has a real fail-loud contract (benign-skip vs loud schema-drift) — the in-repo template 00003 should copy; offline gh stub fails loud on unsupported invocations; honest coverage docs. **Checked & safe**: no eval/rm -rf/--force in shipped skills; no injection path (refnames exclude shell metachars); empty-state paths tested.

**Backlog** (all 6 read): `00002` dynamic-default-branch — KEEP+amend (put resolver at plugin root via `CLAUDE_PLUGIN_ROOT`, not under one skill; absorb G6). `00003` failloud-github-state — KEEP (add `set -euo pipefail` + fix G4). `00004` harden-release — KEEP+extend (add branch/`--ff-only` guard, G5); **no material overlap with 00006** (release-time vs CI-time gates). `00005` watch-ci-poll-script — KEEP (textbook ai-app-design fix, ~20 LLM turns → 1 tool call). `00006` plugin-consistency-lint — KEEP. `00007` prune-worktrees — KEEP+amend (consume 00002 resolver; split Phases 0-1/2 if it drags).

**Proposed PRDs**: `00008` search-dep-prs (replace 200-call fan-out with `gh search prs` + loud gap markers, G7); `00009` gate-dep-merges-on-CI (require green `statusCheckRollup` before merge — unprotected repos can batch-merge red PRs).

**Suggested order**: 00002 → 00003 → 00006 → 00004 → 00005 → 00007.

**Top-3 wins**: (1) `00002` dynamic default branch — catchup fails/mis-reports on most repos today; (2) `00003` fail-loud + label fix — "High Priority" is *always* empty right now; (3) `00005` watch-ci script — token/latency win on every push.

---

## aegis (v0.2.1) — Python PreToolUse safety hooks

216 tests pass (0 skips, run by auditor). Fail-open is 95% deliberate and solid. Two themes: the destructive-bash gate is an un-winnable cat-and-mouse (accept a shallow gate, let warden own safety), and shell parsing is reinvented per hook.

> **Live proof of A2**: writing *this report* was initially blocked by aegis's own `block_suppression_markers` hook because the A2 row named the linter-suppression markers — the hook scans prose, exactly the false-positive A2 describes.

| # | Sev | Defect | Evidence | Status |
|---|-----|--------|----------|--------|
| A1 | **MED** | gateguard crashes on a JSON transcript line that parses but isn't a dict → `main()` has no top-level guard → **exit 1 → PreToolUse fail-open** (Edit proceeds ungated). Violates the fn's own docstring. The one safety fail-open. | `🔬A` ran hook, EXIT=1; `gateguard_fact_force.py:367,556-562` | NEW |
| A2 | MED | `block_suppression_markers` scans **any** file incl. prose → editing a doc that merely names linter-suppression markers (Python `noqa`, JS `eslint-disable`) is blocked, including aegis's own `rules/coding-style.md`. | `🔬A` `count_markers(...)`; `:33-41,55-93` | NEW |
| A3 | MED | Destructive-bash gate has live bypasses: `eval "rm -rf /"`, `find . -delete`, `git checkout -f`, `git switch --discard-changes`, `rm -fr`, `rm -r -f`. Ad-hoc parser can't converge. | `🔬A` all 6 `_is_destructive()==False`; `:47-52,67` | 00004/00007 (partial) |
| A4 | MED | Shell parsing reinvented per hook: `QUOTED_RE` byte-identical in 2 hooks, 3 segment-splitters with **different separator sets** (cause of the `&` gap), wrapper-peeling in 1. `_common.py` is 43 lines. | `📖` `gateguard:54`==`prefer_tools:48`; separators differ | NEW |
| A5 | MED | No CI; `_common.py` (imported by all 8 hooks, the fail-open foundation) has only 4 tests; no hooks.json↔filesystem registration test (v0.1.2 silent-unregister bug class, d48ccca — hooks.json fixed 6×). | `📖` no `.github`; `test__common.py` | tracked 00005 |
| A6 | LOW | `prefer_tools` holes: `/bin/cat file` (never basenamed), `sleep 1 & cat` (single `&` not a separator), `timeout 5 grep` (unlisted wrapper). Cost ≈ 0 (style nudge). | `📖` `prefer_tools.py:21-60` | fold into shared-parser PRD |
| A7 | LOW | `block_devlocal_redirects` / `validate_commit_msg` match command-ish text inside quoted strings (`git commit -m "block > dev/local/"`). | `📖` `block_devlocal_redirects.py:11-14`, `validate_commit_msg.py:49` | untracked |

**Gets right**: fail-open is deliberate and mostly airtight (read_input TTY/bad-JSON guards, load/save_state OSError swallow, `_is_destructive` catches shlex ValueError); `block_force_push` is tight (token-based, handles `-fu`, `+refspec`, path-qualified git, quoted `--force`); gateguard literal-form detection is careful (`bash -c` recursion, `-O extglob`, `--` separator); subprocess-based tests assert real exit codes.

**Backlog headline — three gateguard PRDs overlap and one is done**:

- `00002` gateguard-hardening — **DONE, move to done/**. All metrics verified in code + 216 green tests. Its banner says "awaiting sign-off" which contradicts your working-documents rule (move when verified, no approval).
- `00004` close-bash-bypasses — **REWRITE (shrink)**. Phase 0 (operand-flag `-c` scan) already shipped (ec970f6); `bash -O extglob -c` is denied; problem statement + "red test in tree" are stale. Only `eval` + `find -delete` remain.
- `00007` backport-ecc-gating — **KEEP but MERGE with 00004-remainder**. `git checkout -f` / `git switch --discard-changes` are confirmed live **data-loss** bypasses (highest-value gateguard item). Both PRDs edit the same two functions + test file; separately they force two rebases of identical code.
- `00005` add-CI — **KEEP, ship first** (highest leverage; protects all other work; the v0.1.2 manifest incident is real).
- `00006` fix-prefer-tools-stream-FP — **KEEP; issue #1 CANNOT be closed.** The recent 133cdf2 changed only the deny *message*; `cargo test | tail -30` is **still blocked** (`🔬A` verdict==block). Core false-positive persists.
- `00003` exempt-autopilot-loop — KEEP, consider split (the `/tmp` carve-out is independent and always-good). Overlaps 00006 + 00009.
- `00008` block-invisible-unicode — KEEP (genuine gap; ASCII-smuggling vector; clean PRD).
- `00009` dry-run/disable-harness — KEEP, lowest priority; **resolve overlap with 00003** (both add env-gated hook suppression — pick one convention).

**Proposed PRDs**: `00010` guard-gateguard-transcript-parse (A1, SAFETY — highest of the new set); `00011` extract-shared-shell-parser (A4+A6, after 00005 so CI catches migration regressions); `00012` exempt-docs-from-suppression-scan (A2).

**Top-3 wins**: (1) ship `00005` CI + registration test — 216 tests currently run only when the dev remembers, on one OS; a manifest typo silently disabled all hooks once; (2) fix `00006` stream false-positive + close issue #1 — the only open issue, high-frequency; (3) merge 00004+00007 and land git working-tree-discard gating — `git checkout -f` silently destroys uncommitted work today.

---

## Cross-portfolio guardrails & ledger

**Root cause behind the most findings**: the release/versioning pipeline. Two guardrails end the recurrence:

1. **Fix warden's release `perl`→`jq`** (P0). This alone stops the clobber that has now bitten three times.
2. **Add a marketplace-consistency check** in `claude-plugins/.github/` (or each release preflight): assert every `marketplace.json` plugin version equals that plugin's published/tag version. Catches both the clobber and the missed-propagation modes. git-ferry's `00006-plugin-consistency-lint` is the closest existing template — consider generalizing it to the marketplace repo.

**CI gap**: 3 of 5 plugins (checkup, strunk, aegis) have **no CI**; their test suites (107 / 0 / 216) run only at release or when the dev remembers. All three backlogs already propose adding it (checkup 00007, strunk 00005→merge, aegis 00005). This is the cheapest portfolio-wide reliability win.

**Deletion / simplification ledger** (librarization candidates surfaced):

| Plugin | Extract | Deletes |
|--------|---------|---------|
| warden | shared trusted-remote arg-walker | ~340 lines of 5 duplicated parsers → 1 + data tables |
| checkup | route audit-sessions through `lib/` | 3rd frontmatter parser, dup iso/jsonl helpers; fixes C2 |
| aegis | `hooks/shell_parse.py` | dup `QUOTED_RE` + 3 divergent segment splitters |
| git-ferry | plugin-root `lib/` (resolve-base, require_gh) | dup path-encoder + gh-preflight across skills |

**Backlog hygiene actions** (APPLIED 2026-07-08):
- ✅ aegis `00002` → `done/` (verified complete).
- ⏳ warden `00020` → left in `wip/` (finish its review loop first, then move to `done/`) — NOT auto-moved.
- ✅ strunk `00005` → merged into `00003` (Phase 2: CI) and deleted; aegis `00004`+`00007` → merged into `00004` (git-discard forms prioritized, already-shipped operand-flag Phase 0 dropped), `00007` deleted.
- ✅ strunk: `.serena/` added to `.gitignore`.
- ✅ checkup `00002`: stale "00031" refs corrected to "00001".

---

## What was executed (2026-07-08)

**Committed & pushed** (marketplace repo): restored `marketplace.json` to true versions (commit 2dd7cf3) — live production corruption verified against source — plus a `.gitignore` for `dev/local/` (commit 2a577e4).

**Filed into backlogs** (gitignored `dev/local/prds/`, so not committed — the autopilot reads them locally): 20 new create-prd-compliant PRDs, numbered append-only (existing PRDs cross-reference each other, so none were renumbered):
- warden `00022`-`00028` (7): release-clobber fix, transparent-runner bypass, arithmetic command-subs, bundled `-c` flags, dist-freshness CI, project-config trust decision, remote arg-walker refactor.
- checkup `00003`-`00008` (6): fail-loud audits, classifier fail-open, MCP-where-servers-live, route-through-lib, CI, test/slim validate_skill.
- strunk `00007`-`00008` (2): compat-verify script, raise floor to 3.11.
- git-ferry `00008`-`00009` (2): search-dep-prs, gate-dep-merges-on-CI.
- aegis `00010`-`00012` (3): guard transcript parse (safety), shared shell parser, exempt docs from suppression scan.

**Amended** (existing PRDs): strunk `00004` (SKILL.md scope + "Added in 3.13" must + reconstructed S1-S9 findings), git-ferry `00002`/`00003`/`00004`/`00007` (plugin-root resolver, merge-base guard, pipefail, release branch-guard, resolver dependency).

**Left for you** (not auto-done): warden `00020` stays in `wip/` until its review loop finishes; the warden `00027` project-config-trust question is a decision PRD (needs your call before code); nothing here was code-fixed — every fix is a filed PRD for the autopilot to execute.
