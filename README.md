# Nawy dev flow

A Claude Code plugin for product managers who build in their product's real code: each piece of work gets its Jira
story, its branch and its own running copy of the repos; when it's done, Claude checks it, opens the PRs and tells
your reviewer. Plus UAT of stories on staging.

```
claude plugin marketplace add ezzhassan97/nawy-dev-flow
claude plugin install nawy-dev-flow@nawy-dev-flow
```

Then, in a new Claude Code session: **"Set up my dev flow"** (or `/dev-setup`).

Everything else (what's inside, what it needs, the zip install, updating): [the plugin's README](plugins/nawy-dev-flow/README.md).
