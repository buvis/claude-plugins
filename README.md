# buvis-plugins

Claude Code plugin marketplace for buvis org.

Also home of the shared release tooling: each plugin repo's `dev/bin/release`
is a thin shim around [`scripts/release-plugin`](scripts/release-plugin) here,
which bumps the plugin, tags it, and updates its entry in
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) - never
any other plugin's entry. Plugin development expects this repo cloned at
`../claude-plugins`, beside the plugin repos.

`scripts/validate-versions.mjs` (run by CI) checks every marketplace version
against each plugin's upstream `plugin.json`.
