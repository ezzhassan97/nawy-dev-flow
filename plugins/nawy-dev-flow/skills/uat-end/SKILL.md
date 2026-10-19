---
name: uat-end
description: Finishes a UAT session started with /uat-start, run as /uat-end with an optional session name. Moves stories with open bugs back for fixes and passes clean ones once the user confirms, comments the result on each, then removes the UAT copies. Never changes code. Use when the user says UAT or the re-test is done, to return a story for fixes, pass it, or clean up the UAT copies.
argument-hint: [name]
---

# /uat-end [<name>]

Settings: `dev-flow.json` in the workspace named in `~/.nawy-dev-flow`. Still no code changes, pushes or PRs. It
handles the stories tested in this session.

## 1. Move each story

Its `[Bug]` sub-tasks that are not Done decide:
- any open → move the story to `jira.statuses.returned`;
- none → ask "<KEY>-<n> passed UAT — move it to <jira.statuses.passed>?"; on yes, move it.

List the story's transitions and pick by the status it leads **to**. None leads there → tell the user what is
available.

## 2. Comment the result on the story

Three short lines at most:
```
UAT on staging (<repo> abc1234, …): 12 of 14 checks passed.
Bugs: KEY-2330, KEY-2331.            (or: No bugs — passed.)
Re-tested: KEY-2329 fixed; KEY-2332 still open.   (re-tests only)
```

## 3. Remove the copies

`node scripts/dev-flow.mjs uat-end <name>` (`node scripts/dev-flow.mjs list` shows the `uat-…` copies). It refuses
when a file in a copy changed: that broke the rule. Show the user `git -C <copy> status`, and remove it
(`git -C <clone> worktree remove --force <copy>`) only once they say so. `UAT-TEST` records stay on staging.

## 4. Report

Per story: its new status with its link, and the bugs filed (links).
