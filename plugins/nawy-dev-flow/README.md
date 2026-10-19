# Nawy dev flow

A Claude Code plugin for product managers who build features in their product's real code with Claude. You say
what to build; Claude handles the setup around it: the Jira story, the branch, a private copy of every repo
running on its own ports with real data, the checks, the PRs, the reviewer, and UAT on staging. You focus on the
feature.

## Install

You need Claude Code: the Code tab of the Claude desktop app, or the `claude` terminal app. Mac or Linux.

**From GitHub** (recommended, you get updates). In a terminal:

```
claude plugin marketplace add ezzhassan97/nawy-dev-flow
claude plugin install nawy-dev-flow@nawy-dev-flow
```

**From the zip**: unzip it and move the five folders inside `skills/` (`dev-setup`, `dev-start`, `dev-end`,
`uat-start`, `uat-end`) into `~/.claude/skills/`. They load in your next Claude Code session.

Then open a new Claude Code session and say: **"Set up my dev flow"** (or `/dev-setup`). About 30 minutes, most of
it waiting for installs.

## What's inside

| Command | What it does |
|---|---|
| `/dev-setup` | Asks where your code should live, checks and installs Git, Node and GitHub's command-line tool, connects Jira and GitHub, clones the repos you pick and works out how each one installs, starts and talks to the others, sets up the database tunnels and your SSH key, your branch and PR rules, your reviewer (GitHub, Jira, Slack) and staging for UAT, then does a test run. Run it again any time to change a setting. |
| `/dev-start <folder> <story or title>` | Files the Jira story the first time (or reads it), names the branch after it, makes your own copy of every repo on free ports from the latest main, opens the tunnels, starts the apps and checks real data shows before saying ready. Several at once is fine: each piece of work has its own folder. |
| `/dev-end <folder>` | Runs the repo's checks, completes the Jira story from what was built, pushes, opens one PR per repo with only your reviewer, links them, moves the story to review, messages your reviewer on Slack, removes the copies. Never merges. |
| `/uat-start [story keys]` | Tests stories on staging against their requirements: the screens, the API calls, the data. Reports findings; files the ones you approve as `[Bug]` sub-tasks with the screenshot. Never changes code. |
| `/uat-end` | Moves tested stories on (back for fixes, or passed once you confirm), comments the result, cleans up. |

## What it needs

- **Jira**: the Atlassian connector in Claude. Required.
- **GitHub**: an account that sees your company's repos, and GitHub's command-line tool (setup installs it).
- **From your tech lead**: each repo's local `.env` file, and, if the apps need a database through a bastion, access
  for your SSH key (setup creates the key and tells you what to send).
- **Slack** (optional): the Slack connector, so `/dev-end` can message your reviewer.

## Make it yours

Everything lives in `dev-flow.json` in your workspace (default `~/dev/<product>/`): the repos and how they run,
the branches, Jira statuses, your reviewer, tunnels, staging, and your own rules in plain sentences. Ask Claude to
change any of it, or run `/dev-setup` again. `CLAUDE.md` in the workspace holds the rules every session there follows.

## Safe by default

Never merges or approves a PR, never pushes to main/staging/prod, never resolves conflicts with staging (lists them
for the reviewer), stops and asks before any database schema change, never commits `.env` files, never reads your
passwords into the chat, and never checks a database tunnel by connecting through it (that locks the bastion).

## Update

GitHub install: `claude plugin marketplace update nawy-dev-flow`, then
`claude plugin update nawy-dev-flow@nawy-dev-flow`, restart Claude Code, and run `/dev-setup` once (it refreshes the
workspace's script). Zip install: replace the five folders with the new ones.
